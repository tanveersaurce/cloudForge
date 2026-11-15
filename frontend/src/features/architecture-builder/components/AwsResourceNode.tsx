import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AwsServiceIcon } from '@/features/aws-services/components/AwsServiceIcon';
import { useArchitectureBuilderStore } from '@/store/useArchitectureBuilderStore';
import { cn } from '@/utils/cn';
import type { ArchitectureFlowNode } from '../types/architecture.types';
import { AwsBoundaryContainer } from './AwsBoundaryContainer';

const HANDLE_BASE_CLASS =
  '!h-2.5 !w-2.5 !rounded-full !border-2 !border-slate-800 !bg-slate-400 opacity-60 transition-all duration-150 group-hover:opacity-100 hover:!scale-125 hover:!bg-sky-400';

function extractConfigSummary(data: ArchitectureFlowNode['data']): string[] {
  const meta = data.metadata || {};
  const tags: string[] = [];

  // EC2
  if (meta.instanceType || meta.instance_type) {
    tags.push(String(meta.instanceType || meta.instance_type));
  }
  if (meta.operatingSystem || meta.operating_system) {
    const os = String(meta.operatingSystem || meta.operating_system);
    if (os.toLowerCase().includes('linux')) tags.push('Linux');
    else if (os.toLowerCase().includes('windows')) tags.push('Windows');
  }

  // RDS
  if (meta.engine) {
    tags.push(String(meta.engine));
  }
  if (meta.multiAz || meta.multi_az) {
    tags.push('Multi-AZ');
  }
  if (meta.instanceClass || meta.instance_class) {
    tags.push(String(meta.instanceClass || meta.instance_class));
  }

  // S3 / Storage
  if (meta.volumeType || meta.volume_type) {
    tags.push(String(meta.volumeType || meta.volume_type));
  }
  if (meta.storageSizeGb || meta.allocatedStorageGb || meta.allocated_storage) {
    const size = meta.storageSizeGb || meta.allocatedStorageGb || meta.allocated_storage;
    tags.push(`${size} GB`);
  }

  // Lambda
  if (meta.runtime) {
    tags.push(String(meta.runtime));
  }
  if (meta.memoryMb || meta.memory_size) {
    tags.push(`${meta.memoryMb || meta.memory_size}MB`);
  }

  // DynamoDB
  if (meta.billingMode || meta.billing_mode) {
    const mode = String(meta.billingMode || meta.billing_mode);
    tags.push(mode.includes('PAY_PER') || mode.includes('PAY') ? 'On-Demand' : 'Provisioned');
  }

  // CloudFront
  if (meta.priceClass || meta.price_class) {
    tags.push('Global CDN');
  }

  // Default fallback if no specific metadata
  if (tags.length === 0 && data.resourceType && data.resourceType !== 'awsResource') {
    tags.push(data.resourceType);
  }

  return tags.slice(0, 3);
}

export const AwsResourceNode = memo(function AwsResourceNode({
  id,
  data,
  selected,
}: NodeProps<ArchitectureFlowNode>) {
  const isValidationHighlighted = useArchitectureBuilderStore((s) =>
    s.highlightedValidationNodeIds.includes(id),
  );

  // Check if this node is an AWS boundary container
  const isBoundary =
    Boolean(data.metadata?.isBoundary) ||
    data.resourceType === 'vpc' ||
    data.resourceType === 'aws_vpc' ||
    data.resourceType === 'subnet' ||
    data.resourceType === 'aws_subnet' ||
    data.resourceType === 'availability-zone' ||
    data.resourceType === 'az' ||
    data.resourceType === 'region' ||
    data.resourceType === 'aws-cloud';

  if (isBoundary) {
    return <AwsBoundaryContainer id={id} data={data} selected={selected} />;
  }

  const configTags = extractConfigSummary(data);
  const resourceTitle = data.label || data.resourceName || data.serviceName;
  const serviceSubtitle = data.serviceName || 'AWS Service';

  return (
    <div
      className={cn(
        'group relative w-60 rounded-xl border bg-slate-900/90 text-slate-100 shadow-md shadow-black/40 backdrop-blur-md transition-all duration-150',
        isValidationHighlighted
          ? 'border-rose-500 ring-4 ring-rose-500/50 shadow-rose-950/60'
          : selected
            ? 'border-sky-400 ring-2 ring-sky-400/70 shadow-sky-950/40'
            : 'border-slate-700/80 hover:border-slate-500 hover:shadow-lg',
      )}
    >
      {/* Target Handles (Left & Top) */}
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className={cn(HANDLE_BASE_CLASS, selected && '!bg-sky-400 !opacity-100')}
      />
      <Handle
        id="target-left"
        type="target"
        position={Position.Left}
        className={cn(HANDLE_BASE_CLASS, selected && '!bg-sky-400 !opacity-100')}
      />

      <div className="p-3">
        {/* Main Header with Official AWS Icon */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 transition-transform group-hover:scale-105">
            <AwsServiceIcon
              serviceSlug={data.serviceSlug}
              resourceType={data.resourceType}
              iconKey={data.iconKey}
              size="lg"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <h3 className="truncate text-xs font-bold tracking-tight text-slate-100">
                {resourceTitle}
              </h3>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            </div>

            <p className="truncate text-[11px] font-medium text-slate-400">
              {serviceSubtitle}
            </p>

            <span className="mt-0.5 inline-block font-mono text-[10px] text-slate-500">
              {data.resourceType}
            </span>
          </div>
        </div>

        {/* Configuration summary pills */}
        {configTags.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1 border-t border-slate-800/80 pt-2">
            {configTags.map((tag) => (
              <span
                key={tag}
                className="rounded border border-slate-700/70 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Source Handles (Right & Bottom) */}
      <Handle
        id="source-right"
        type="source"
        position={Position.Right}
        className={cn(HANDLE_BASE_CLASS, selected && '!bg-sky-400 !opacity-100')}
      />
      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        className={cn(HANDLE_BASE_CLASS, selected && '!bg-sky-400 !opacity-100')}
      />
    </div>
  );
});
