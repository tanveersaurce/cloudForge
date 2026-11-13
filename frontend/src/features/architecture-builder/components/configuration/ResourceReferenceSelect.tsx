import { useMemo } from 'react';
import { AlertCircle, Layers } from 'lucide-react';
import type { ArchitectureFlowNode } from '../../types/architecture.types';
import { cn } from '@/utils/cn';

export interface ResourceReferenceSelectProps {
  id: string;
  label: string;
  value: string | string[];
  isMulti?: boolean;
  targetResourceTypes?: string[];
  canvasNodes: ArchitectureFlowNode[];
  currentNodeId: string;
  onChange: (nextValue: string | string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ResourceReferenceSelect({
  id,
  value,
  isMulti = false,
  targetResourceTypes = [],
  canvasNodes,
  currentNodeId,
  onChange,
  placeholder = 'Select canvas resource...',
  className,
  disabled = false,
}: ResourceReferenceSelectProps) {
  // Compatible canvas nodes (excluding self)
  const candidateNodes = useMemo(() => {
    return canvasNodes.filter((node) => {
      if (node.id === currentNodeId) return false;
      if (targetResourceTypes.length === 0) return true;
      return targetResourceTypes.some(
        (t) =>
          t.toLowerCase() === (node.data.resourceType || '').toLowerCase() ||
          t.toLowerCase() === (node.data.serviceSlug || '').toLowerCase(),
      );
    });
  }, [canvasNodes, currentNodeId, targetResourceTypes]);

  // Handle single reference
  if (!isMulti) {
    const singleValue = typeof value === 'string' ? value : '';
    const selectedNodeExists = candidateNodes.some((n) => n.id === singleValue);
    const isMissing = Boolean(singleValue && !selectedNodeExists);

    return (
      <div className="space-y-1">
        <select
          id={id}
          value={singleValue}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full rounded-lg border border-border-subtle bg-canvas/80 px-3 py-2 text-xs text-slate-100 transition-colors focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40 disabled:opacity-50',
            isMissing && 'border-rose-500/50 text-rose-300',
            className,
          )}
        >
          <option value="">{placeholder}</option>
          {isMissing ? (
            <option value={singleValue} disabled>
              ⚠️ Missing resource ({singleValue})
            </option>
          ) : null}
          {candidateNodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.data.label || n.data.resourceName} ({n.data.resourceType})
            </option>
          ))}
        </select>

        {candidateNodes.length === 0 && !singleValue ? (
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <Layers className="h-3 w-3" />
            <span>No matching {targetResourceTypes.join('/') || 'resources'} on canvas yet.</span>
          </p>
        ) : null}

        {isMissing ? (
          <p className="flex items-center gap-1 text-[11px] text-rose-400">
            <AlertCircle className="h-3 w-3" />
            <span>Referenced resource has been deleted from the canvas.</span>
          </p>
        ) : null}
      </div>
    );
  }

  // Handle multi-select
  const multiValue = Array.isArray(value) ? value : [];

  const handleToggle = (nodeId: string) => {
    if (multiValue.includes(nodeId)) {
      onChange(multiValue.filter((id) => id !== nodeId));
    } else {
      onChange([...multiValue, nodeId]);
    }
  };

  return (
    <div className="space-y-1.5">
      {candidateNodes.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-canvas/40 p-2.5 text-center text-[11px] text-slate-500">
          No {targetResourceTypes.join('/') || 'resources'} on canvas to select.
        </div>
      ) : (
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border-subtle bg-canvas/60 p-2">
          {candidateNodes.map((node) => {
            const isChecked = multiValue.includes(node.id);
            return (
              <label
                key={node.id}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-surface-elevated/70',
                  isChecked && 'bg-sky-500/10 text-sky-200',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-200">
                    {node.data.label || node.data.resourceName}
                  </p>
                  <p className="font-mono text-[10px] text-slate-400">
                    {node.data.resourceType}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => handleToggle(node.id)}
                  className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40"
                />
              </label>
            );
          })}
        </div>
      )}

      {multiValue.length > 0 ? (
        <p className="text-[11px] text-slate-400">
          {multiValue.length} {multiValue.length === 1 ? 'resource' : 'resources'} selected
        </p>
      ) : null}
    </div>
  );
}
