import { useState } from 'react';
import {
  ArrowRight,
  Copy,
  GitBranch,
  Info,
  Layers,
  MapPin,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AwsServiceIcon } from '@/features/aws-services/components/AwsServiceIcon';
import { useArchitectureBuilderStore } from '@/store/useArchitectureBuilderStore';
import { cn } from '@/utils/cn';
import type {
  ArchitectureFlowEdge,
  ArchitectureFlowNode,
} from '../types/architecture.types';

interface NodeInspectorSidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  draft: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  published: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  archived: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
};

const CANVAS_USAGE_TIPS = [
  {
    action: 'Add resources',
    detail: 'Drag or click AWS resources from the left library onto the canvas.',
  },
  {
    action: 'Connect nodes',
    detail: 'Drag from a node handle to another node handle to create a connection.',
  },
  {
    action: 'Remove items',
    detail: 'Select a node or connection and press Delete or Backspace.',
  },
  {
    action: 'Save canvas',
    detail: 'Press Ctrl+S (or Cmd+S on macOS) to persist layout and metadata.',
  },
] as const;

export function NodeInspectorSidebar({
  className,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}: NodeInspectorSidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed ?? internalCollapsed;

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const architecture = useArchitectureBuilderStore((s) => s.architecture);
  const nodes = useArchitectureBuilderStore((s) => s.nodes);
  const edges = useArchitectureBuilderStore((s) => s.edges);
  const selectedNodeId = useArchitectureBuilderStore((s) => s.selectedNodeId);
  const selectedEdgeId = useArchitectureBuilderStore((s) => s.selectedEdgeId);
  const updateNodeMetadata = useArchitectureBuilderStore((s) => s.updateNodeMetadata);
  const duplicateNode = useArchitectureBuilderStore((s) => s.duplicateNode);
  const deleteNode = useArchitectureBuilderStore((s) => s.deleteNode);
  const deleteEdge = useArchitectureBuilderStore((s) => s.deleteEdge);

  const selectedNode: ArchitectureFlowNode | undefined = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : undefined;

  const selectedEdge: ArchitectureFlowEdge | undefined =
    !selectedNode && selectedEdgeId
      ? edges.find((e) => e.id === selectedEdgeId)
      : undefined;

  if (isCollapsed) {
    return (
      <aside
        aria-label="Properties Inspector (Collapsed)"
        className={cn(
          'flex h-full w-11 shrink-0 flex-col items-center border-l border-border-subtle bg-surface/95 py-3 backdrop-blur-md',
          className,
        )}
      >
        <button
          type="button"
          onClick={handleToggleCollapse}
          title="Expand Properties Inspector"
          aria-label="Expand Properties Inspector"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-elevated text-slate-300 transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-slate-100"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>

        <div className="mt-4 flex flex-col items-center gap-2 text-slate-500">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="text-[10px] font-medium uppercase tracking-widest [writing-mode:vertical-rl]">
            Inspector
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Properties Inspector"
      className={cn(
        'flex h-full w-72 shrink-0 flex-col border-l border-border-subtle bg-surface/95 backdrop-blur-md lg:w-80',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-sky-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            {selectedNode
              ? 'Node Inspector'
              : selectedEdge
                ? 'Connection Inspector'
                : 'Architecture Overview'}
          </h2>
        </div>

        <button
          type="button"
          onClick={handleToggleCollapse}
          title="Collapse Properties Inspector"
          aria-label="Collapse Properties Inspector"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-surface-hover hover:text-slate-100"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedNode ? (
          <SelectedNodePanel
            node={selectedNode}
            onUpdateMetadata={updateNodeMetadata}
            onDuplicate={duplicateNode}
            onDelete={deleteNode}
          />
        ) : selectedEdge ? (
          <SelectedEdgePanel
            edge={selectedEdge}
            nodes={nodes}
            onDelete={deleteEdge}
          />
        ) : (
          <EmptySelectionPanel
            name={architecture?.name ?? 'Untitled Architecture'}
            region={architecture?.region ?? 'us-east-1'}
            status={architecture?.status ?? 'draft'}
            nodeCount={nodes.length}
            edgeCount={edges.length}
          />
        )}
      </div>
    </aside>
  );
}

interface EmptySelectionPanelProps {
  name: string;
  region: string;
  status: string;
  nodeCount: number;
  edgeCount: number;
}

function EmptySelectionPanel({
  name,
  region,
  status,
  nodeCount,
  edgeCount,
}: EmptySelectionPanelProps) {
  const normalizedStatus = status.toLowerCase();
  const statusStyle =
    STATUS_BADGE_STYLES[normalizedStatus] ??
    'border-slate-600/40 bg-slate-800/60 text-slate-300';

  return (
    <div className="space-y-5">
      {/* Architecture Summary Card */}
      <section className="rounded-xl border border-border-subtle bg-surface-elevated/80 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Architecture
            </p>
            <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-100" title={name}>
              {name}
            </h3>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
              statusStyle,
            )}
          >
            {status}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <MapPin className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-mono text-slate-300">{region}</span>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border-subtle bg-canvas/60 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Layers className="h-3.5 w-3.5 text-sky-400" />
              <span>Nodes</span>
            </div>
            <p className="mt-1 font-mono text-base font-semibold text-slate-100">
              {nodeCount}
            </p>
          </div>

          <div className="rounded-lg border border-border-subtle bg-canvas/60 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <GitBranch className="h-3.5 w-3.5 text-indigo-400" />
              <span>Connections</span>
            </div>
            <p className="mt-1 font-mono text-base font-semibold text-slate-100">
              {edgeCount}
            </p>
          </div>
        </div>
      </section>

      {/* Canvas Usage Guide */}
      <section className="rounded-xl border border-border-subtle bg-surface-elevated/50 p-3.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Info className="h-3.5 w-3.5 text-sky-400" />
          <span>Canvas Usage Guide</span>
        </div>

        <ul className="mt-3 space-y-2.5">
          {CANVAS_USAGE_TIPS.map((tip) => (
            <li
              key={tip.action}
              className="rounded-lg border border-border-subtle/70 bg-canvas/40 px-3 py-2"
            >
              <p className="text-xs font-medium text-slate-200">{tip.action}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                {tip.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

interface SelectedNodePanelProps {
  node: ArchitectureFlowNode;
  onUpdateMetadata: (
    nodeId: string,
    patch: { label?: string; description?: string },
  ) => void;
  onDuplicate: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
}

function SelectedNodePanel({
  node,
  onUpdateMetadata,
  onDuplicate,
  onDelete,
}: SelectedNodePanelProps) {
  const { data, position } = node;

  return (
    <div className="space-y-5">
      {/* Identity Header */}
      <section className="rounded-xl border border-border-subtle bg-surface-elevated/80 p-3.5">
        <div className="flex items-start gap-3">
          <AwsServiceIcon iconKey={data.iconKey} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-400">
              {data.serviceName}
            </p>
            <h3
              className="mt-0.5 truncate text-sm font-semibold text-slate-100"
              title={data.resourceName}
            >
              {data.resourceName}
            </h3>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 font-mono text-[11px] text-sky-300">
            {data.resourceType}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border-subtle/80 pt-2.5 text-[11px]">
          <span className="text-slate-400">Node ID</span>
          <span className="font-mono text-slate-300" title={node.id}>
            {node.id}
          </span>
        </div>
      </section>

      {/* Editable Metadata */}
      <section className="space-y-3.5">
        <div>
          <label
            htmlFor="inspector-node-label"
            className="block text-xs font-medium text-slate-300"
          >
            Display Label
          </label>
          <input
            id="inspector-node-label"
            type="text"
            value={data.label}
            onChange={(e) => onUpdateMetadata(node.id, { label: e.target.value })}
            placeholder="Enter display label"
            className="mt-1.5 w-full rounded-lg border border-border-subtle bg-canvas/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
          />
        </div>

        <div>
          <label
            htmlFor="inspector-node-description"
            className="block text-xs font-medium text-slate-300"
          >
            Description
          </label>
          <textarea
            id="inspector-node-description"
            rows={3}
            value={data.description}
            onChange={(e) => onUpdateMetadata(node.id, { description: e.target.value })}
            placeholder="Describe this resource's role in the architecture..."
            className="mt-1.5 w-full resize-none rounded-lg border border-border-subtle bg-canvas/80 px-3 py-2 text-xs leading-relaxed text-slate-200 placeholder-slate-500 transition-colors focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
          />
        </div>
      </section>

      {/* Coordinates Readout */}
      <section className="rounded-xl border border-border-subtle bg-surface-elevated/60 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          Canvas Position
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between rounded-md border border-border-subtle bg-canvas/60 px-2.5 py-1.5 text-xs">
            <span className="text-slate-400">X</span>
            <span className="font-mono text-slate-200">{Math.round(position.x)}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border-subtle bg-canvas/60 px-2.5 py-1.5 text-xs">
            <span className="text-slate-400">Y</span>
            <span className="font-mono text-slate-200">{Math.round(position.y)}</span>
          </div>
        </div>
      </section>

      {/* Phase 06 Notice */}
      <section className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
          <p className="text-[11px] leading-relaxed text-slate-300">
            Dynamic AWS resource configuration forms (EC2, RDS, VPC, IAM, and Terraform
            attributes) arrive in <span className="font-semibold text-indigo-300">Phase 06</span>.
          </p>
        </div>
      </section>

      {/* Node Actions */}
      <section className="grid grid-cols-2 gap-2 border-t border-border-subtle pt-4">
        <button
          type="button"
          onClick={() => onDuplicate(node.id)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-surface-elevated px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-surface-hover hover:text-white"
        >
          <Copy className="h-3.5 w-3.5" />
          <span>Duplicate</span>
        </button>

        <button
          type="button"
          onClick={() => onDelete(node.id)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20 hover:text-rose-200"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete</span>
        </button>
      </section>
    </div>
  );
}

interface SelectedEdgePanelProps {
  edge: ArchitectureFlowEdge;
  nodes: ArchitectureFlowNode[];
  onDelete: (edgeId: string) => void;
}

function SelectedEdgePanel({ edge, nodes, onDelete }: SelectedEdgePanelProps) {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  const sourceLabel = sourceNode?.data.label || sourceNode?.data.resourceName || edge.source;
  const targetLabel = targetNode?.data.label || targetNode?.data.resourceName || edge.target;
  const relationshipType = edge.data?.relationshipType ?? 'traffic-flow';

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border-subtle bg-surface-elevated/80 p-3.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <GitBranch className="h-4 w-4 text-sky-400" />
          <span>Resource Connection</span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-canvas/70 px-3 py-2.5">
          <span className="min-w-0 truncate text-xs font-medium text-slate-100" title={sourceLabel}>
            {sourceLabel}
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <span className="min-w-0 truncate text-xs font-medium text-slate-100" title={targetLabel}>
            {targetLabel}
          </span>
        </div>

        <div className="mt-3 space-y-2 border-t border-border-subtle/80 pt-3 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Relationship</span>
            <span className="rounded border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 font-mono text-sky-300">
              {relationshipType}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">Edge ID</span>
            <span className="truncate font-mono text-slate-300" title={edge.id}>
              {edge.id}
            </span>
          </div>
        </div>
      </section>

      <section className="border-t border-border-subtle pt-4">
        <button
          type="button"
          onClick={() => onDelete(edge.id)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20 hover:text-rose-200"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete Connection</span>
        </button>
      </section>
    </div>
  );
}
