import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AwsServiceIcon } from '@/features/aws-services/components/AwsServiceIcon';
import { useArchitectureBuilderStore } from '@/store/useArchitectureBuilderStore';
import { cn } from '@/utils/cn';
import type { ArchitectureFlowNode } from '../types/architecture.types';
import { getCategoryAccent } from '../utils/awsNodeRegistry';

const HANDLE_BASE_CLASS =
  '!h-2.5 !w-2.5 !rounded-full !border-2 !border-surface !bg-slate-500 transition-all duration-150 hover:!scale-125 hover:!bg-sky-400';

export const AwsResourceNode = memo(function AwsResourceNode({
  id,
  data,
  selected,
}: NodeProps<ArchitectureFlowNode>) {
  const isValidationHighlighted = useArchitectureBuilderStore((s) =>
    s.highlightedValidationNodeIds.includes(id),
  );
  const accent = getCategoryAccent(data.categorySlug);
  const showResourceSubtitle =
    Boolean(data.resourceName) && data.resourceName !== data.label;

  return (
    <div
      className={cn(
        'group relative w-64 overflow-hidden rounded-xl border bg-surface text-slate-100 shadow-lg shadow-black/30 transition-all duration-150',
        isValidationHighlighted
          ? 'border-rose-500 ring-4 ring-rose-500/60 shadow-rose-950/50'
          : selected
            ? 'border-sky-400 ring-2 ring-sky-400/70'
            : 'border-border-subtle hover:border-border-strong',
      )}
    >
      {/* Category-aware top accent bar */}
      <div className={cn('h-1 w-full', accent.barClassName)} aria-hidden="true" />

      {/* Target Handles (Left & Top) */}
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className={cn(HANDLE_BASE_CLASS, selected && '!bg-sky-400')}
      />
      <Handle
        id="target-left"
        type="target"
        position={Position.Left}
        className={cn(HANDLE_BASE_CLASS, selected && '!bg-sky-400')}
      />

      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <AwsServiceIcon
            iconKey={data.iconKey}
            categoryIconKey={data.categorySlug}
            size="md"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <h3 className="truncate text-sm font-semibold text-slate-100">
                {data.label}
              </h3>
            </div>

            <p className="truncate text-xs text-slate-400">
              {showResourceSubtitle ? data.resourceName : data.serviceName}
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5">
          <span
            className={cn(
              'inline-block max-w-full truncate rounded border px-1.5 py-0.5 font-mono text-[11px] leading-tight',
              accent.badgeClassName,
            )}
            title={data.resourceType}
          >
            {data.resourceType}
          </span>
        </div>

        {data.description ? (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">
            {data.description}
          </p>
        ) : null}
      </div>

      {/* Source Handles (Right & Bottom) */}
      <Handle
        id="source-right"
        type="source"
        position={Position.Right}
        className={cn(HANDLE_BASE_CLASS, selected && '!bg-sky-400')}
      />
      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        className={cn(HANDLE_BASE_CLASS, selected && '!bg-sky-400')}
      />
    </div>
  );
});
