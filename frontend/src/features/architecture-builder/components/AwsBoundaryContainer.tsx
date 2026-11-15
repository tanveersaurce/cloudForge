import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertTriangle, Flag, Globe, Lock, ShieldCheck } from 'lucide-react';
import { AwsLogoIcon, SubnetIcon, VpcIcon } from '@/features/aws-services/utils/officialAwsIcons';
import { useArchitectureBuilderStore } from '@/store/useArchitectureBuilderStore';
import { cn } from '@/utils/cn';
import type {
  ArchitectureFlowEdge,
  ArchitectureFlowNode,
  AwsResourceNodeData,
} from '../types/architecture.types';
import { classifySubnet } from '../utils/networkTopology';

const HANDLE_CLASS =
  '!h-2.5 !w-2.5 !rounded-full !border-2 !border-surface !bg-slate-400 hover:!scale-125 hover:!bg-sky-400 transition-all';

interface AwsBoundaryContainerProps {
  id: string;
  data: AwsResourceNodeData;
  selected?: boolean;
}

export type BoundaryType =
  | 'aws-cloud'
  | 'region'
  | 'vpc'
  | 'availability-zone'
  | 'public-subnet'
  | 'private-subnet'
  | 'database-subnet'
  | 'isolated-subnet'
  | 'unknown-subnet';

export function resolveBoundaryType(
  data: AwsResourceNodeData,
  nodeId?: string,
  allNodes?: ArchitectureFlowNode[],
  allEdges?: ArchitectureFlowEdge[],
): BoundaryType {
  const resourceType = (data.resourceType || '').toLowerCase();
  const label = (data.label || '').toLowerCase();
  const metadata = data.metadata || {};
  const explicitType = (metadata.boundaryType as string)?.toLowerCase();

  if (explicitType) {
    if (explicitType.includes('cloud')) return 'aws-cloud';
    if (explicitType.includes('region')) return 'region';
    if (explicitType.includes('az') || explicitType.includes('zone')) return 'availability-zone';
    if (explicitType.includes('db') || explicitType.includes('database')) return 'database-subnet';
    if (explicitType.includes('pub')) return 'public-subnet';
    if (explicitType.includes('priv')) return 'private-subnet';
    if (explicitType.includes('iso')) return 'isolated-subnet';
    if (explicitType.includes('vpc')) return 'vpc';
  }

  if (resourceType === 'aws-cloud' || label.includes('aws cloud')) {
    return 'aws-cloud';
  }
  if (resourceType === 'region' || label.includes('region')) {
    return 'region';
  }
  if (
    resourceType === 'availability-zone' ||
    resourceType === 'az' ||
    label.startsWith('az-') ||
    label.includes('availability zone')
  ) {
    return 'availability-zone';
  }
  if (
    resourceType === 'subnet' ||
    resourceType === 'aws_subnet' ||
    label.includes('subnet')
  ) {
    const classification = classifySubnet(data, nodeId, allNodes, allEdges);
    switch (classification.classification) {
      case 'database':
        return 'database-subnet';
      case 'private':
        return 'private-subnet';
      case 'public':
        return 'public-subnet';
      case 'isolated':
        return 'isolated-subnet';
      case 'unknown':
      default:
        // If metadata explicitly has a label saying "Subnet", but no route evidence is present yet,
        // distinguish between unknown or infer from safe hints
        if (label.includes('public')) return 'public-subnet';
        if (label.includes('private')) return 'private-subnet';
        return 'unknown-subnet';
    }
  }
  if (resourceType === 'vpc' || resourceType === 'aws_vpc' || label.includes('vpc')) {
    return 'vpc';
  }

  return 'vpc';
}

export const AwsBoundaryContainer = memo(function AwsBoundaryContainer({
  id,
  data,
  selected,
}: AwsBoundaryContainerProps) {
  const canvasNodes = useArchitectureBuilderStore((s) => s.nodes);
  const canvasEdges = useArchitectureBuilderStore((s) => s.edges);

  const boundaryType = resolveBoundaryType(data, id, canvasNodes, canvasEdges);
  const metadata = data.metadata || {};

  const width = typeof metadata.width === 'number' ? metadata.width : undefined;
  const height = typeof metadata.height === 'number' ? metadata.height : undefined;
  const cidr = (metadata.cidrBlock as string) || (metadata.cidr_block as string) || '';
  const az = (metadata.availabilityZone as string) || (metadata.az as string) || '';

  // Theme & header styling by boundary hierarchy
  let containerClasses = '';
  let headerBadge = null;
  const title = data.label || 'AWS Boundary';
  let minDimensions = 'min-w-[320px] min-h-[240px]';

  switch (boundaryType) {
    case 'aws-cloud':
      minDimensions = 'min-w-[900px] min-h-[680px]';
      containerClasses = cn(
        'border-2 border-slate-600/80 bg-slate-950/40 rounded-2xl shadow-2xl',
        selected && 'ring-2 ring-sky-400 border-sky-400',
      );
      headerBadge = (
        <div className="flex items-center gap-2 rounded-md bg-[#232F3E] px-2.5 py-1 text-white shadow-sm">
          <AwsLogoIcon size={18} />
          <span className="text-xs font-bold tracking-wide">AWS Cloud</span>
        </div>
      );
      break;

    case 'region':
      minDimensions = 'min-w-[840px] min-h-[620px]';
      containerClasses = cn(
        'border-2 border-sky-600/70 border-dashed bg-sky-950/15 rounded-xl shadow-lg',
        selected && 'ring-2 ring-sky-400 border-sky-400',
      );
      headerBadge = (
        <div className="flex items-center gap-1.5 rounded-md bg-sky-600/20 border border-sky-500/40 px-2.5 py-1 text-sky-200">
          <Flag className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-xs font-semibold">Region: {data.metadata?.region as string || 'us-east-1'}</span>
        </div>
      );
      break;

    case 'vpc':
      minDimensions = 'min-w-[760px] min-h-[540px]';
      containerClasses = cn(
        'border-2 border-[#8C4FFF]/80 bg-[#8C4FFF]/5 rounded-xl shadow-xl',
        selected && 'ring-2 ring-[#8C4FFF] shadow-[#8C4FFF]/20',
      );
      headerBadge = (
        <div className="flex items-center gap-2 rounded-md bg-[#8C4FFF]/20 border border-[#8C4FFF]/40 px-2.5 py-1 text-purple-200">
          <VpcIcon size={18} />
          <span className="text-xs font-bold">Virtual Private Cloud (VPC)</span>
          {cidr ? <span className="font-mono text-[11px] text-purple-300">[{cidr}]</span> : null}
        </div>
      );
      break;

    case 'availability-zone':
      minDimensions = 'min-w-[340px] min-h-[460px]';
      containerClasses = cn(
        'border-2 border-dashed border-slate-500/60 bg-slate-900/25 rounded-lg shadow-md',
        selected && 'ring-2 ring-sky-400 border-sky-400',
      );
      headerBadge = (
        <div className="flex items-center gap-1.5 rounded-md bg-slate-800/80 border border-slate-700 px-2.5 py-0.5 text-slate-300">
          <Globe className="h-3 w-3 text-sky-400" />
          <span className="text-[11px] font-medium tracking-wide uppercase">
            {title.includes('Availability Zone') ? title : `Availability Zone ${az || title}`}
          </span>
        </div>
      );
      break;

    case 'public-subnet':
      minDimensions = 'min-w-[300px] min-h-[220px]';
      containerClasses = cn(
        'border-2 border-emerald-500/60 bg-emerald-950/20 rounded-lg shadow-sm',
        selected && 'ring-2 ring-emerald-400 border-emerald-400',
      );
      headerBadge = (
        <div className="flex items-center gap-1.5 rounded-md bg-emerald-600/20 border border-emerald-500/40 px-2 py-0.5 text-emerald-200">
          <SubnetIcon size={14} />
          <Lock className="h-3 w-3 text-emerald-400" />
          <span className="text-[11px] font-semibold">Public Subnet</span>
          {cidr ? <span className="font-mono text-[10px] text-emerald-300">({cidr})</span> : null}
        </div>
      );
      break;

    case 'private-subnet':
      minDimensions = 'min-w-[300px] min-h-[220px]';
      containerClasses = cn(
        'border-2 border-sky-500/60 bg-sky-950/20 rounded-lg shadow-sm',
        selected && 'ring-2 ring-sky-400 border-sky-400',
      );
      headerBadge = (
        <div className="flex items-center gap-1.5 rounded-md bg-sky-600/20 border border-sky-500/40 px-2 py-0.5 text-sky-200">
          <SubnetIcon size={14} />
          <Lock className="h-3 w-3 text-sky-400" />
          <span className="text-[11px] font-semibold">Private Subnet</span>
          {cidr ? <span className="font-mono text-[10px] text-sky-300">({cidr})</span> : null}
        </div>
      );
      break;

    case 'database-subnet':
      minDimensions = 'min-w-[300px] min-h-[220px]';
      containerClasses = cn(
        'border-2 border-indigo-500/60 bg-indigo-950/20 rounded-lg shadow-sm',
        selected && 'ring-2 ring-indigo-400 border-indigo-400',
      );
      headerBadge = (
        <div className="flex items-center gap-1.5 rounded-md bg-indigo-600/20 border border-indigo-500/40 px-2 py-0.5 text-indigo-200">
          <ShieldCheck className="h-3 w-3 text-indigo-400" />
          <span className="text-[11px] font-semibold">Database Subnet</span>
          {cidr ? <span className="font-mono text-[10px] text-indigo-300">({cidr})</span> : null}
        </div>
      );
      break;

    case 'isolated-subnet':
      minDimensions = 'min-w-[300px] min-h-[220px]';
      containerClasses = cn(
        'border-2 border-slate-600/60 bg-slate-900/30 rounded-lg shadow-sm',
        selected && 'ring-2 ring-slate-400 border-slate-400',
      );
      headerBadge = (
        <div className="flex items-center gap-1.5 rounded-md bg-slate-800 border border-slate-600 px-2 py-0.5 text-slate-300">
          <ShieldCheck className="h-3 w-3 text-slate-400" />
          <span className="text-[11px] font-semibold">Isolated Subnet</span>
          {cidr ? <span className="font-mono text-[10px] text-slate-400">({cidr})</span> : null}
        </div>
      );
      break;

    case 'unknown-subnet':
      minDimensions = 'min-w-[300px] min-h-[220px]';
      containerClasses = cn(
        'border-2 border-amber-500/60 bg-amber-950/15 rounded-lg shadow-sm',
        selected && 'ring-2 ring-amber-400 border-amber-400',
      );
      headerBadge = (
        <div className="flex items-center gap-1.5 rounded-md bg-amber-600/20 border border-amber-500/40 px-2 py-0.5 text-amber-200">
          <AlertTriangle className="h-3 w-3 text-amber-400" />
          <span className="text-[11px] font-semibold">Subnet (Needs Route Association)</span>
          {cidr ? <span className="font-mono text-[10px] text-amber-300">({cidr})</span> : null}
        </div>
      );
      break;
  }

  return (
    <div
      className={cn('relative p-3.5 transition-all duration-150', minDimensions, containerClasses)}
      style={{
        width: width ? `${width}px` : undefined,
        height: height ? `${height}px` : undefined,
      }}
    >
      {/* Handles on boundary perimeter for structural connections */}
      <Handle id="target-top" type="target" position={Position.Top} className={HANDLE_CLASS} />
      <Handle id="target-left" type="target" position={Position.Left} className={HANDLE_CLASS} />
      <Handle id="source-right" type="source" position={Position.Right} className={HANDLE_CLASS} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={HANDLE_CLASS} />

      {/* Boundary Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          {headerBadge}
          {data.label ? (
            <span className="truncate text-xs font-semibold text-slate-200">
              {data.label}
            </span>
          ) : null}
        </div>

        {az && boundaryType !== 'availability-zone' ? (
          <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            {az}
          </span>
        ) : null}
      </div>

      {/* Interior container canvas area for child resources */}
      <div className="pointer-events-none mt-2 h-full min-h-[140px] w-full" />
    </div>
  );
});
