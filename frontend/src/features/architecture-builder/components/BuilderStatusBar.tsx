import { useArchitectureBuilderStore } from '@/store/useArchitectureBuilderStore';
import type { SaveStatus } from '@/features/architecture-builder/types/architecture.types';

const STATUS_LABELS: Record<SaveStatus, string> = {
  idle: 'Ready',
  unsaved: 'Unsaved changes',
  saving: 'Saving...',
  saved: 'Saved',
  error: 'Save failed',
};

function formatLastSaved(isoTimestamp: string | null): string {
  if (!isoTimestamp) return 'Not saved yet';
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function BuilderStatusBar() {
  const nodeCount = useArchitectureBuilderStore((s) => s.nodes.length);
  const edgeCount = useArchitectureBuilderStore((s) => s.edges.length);
  const saveStatus = useArchitectureBuilderStore((s) => s.saveStatus);
  const lastSavedAt = useArchitectureBuilderStore((s) => s.lastSavedAt);
  const viewport = useArchitectureBuilderStore((s) => s.viewport);

  const zoomPercent = Math.round(viewport.zoom * 100);

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-slate-800 bg-slate-950 px-3 text-[11px] text-slate-400 sm:px-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="font-mono">
          Nodes: <strong className="font-semibold text-slate-200">{nodeCount}</strong>
        </span>
        <span className="font-mono">
          Connections: <strong className="font-semibold text-slate-200">{edgeCount}</strong>
        </span>
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              saveStatus === 'error'
                ? 'bg-rose-400'
                : saveStatus === 'unsaved'
                  ? 'bg-amber-400'
                  : saveStatus === 'saving'
                    ? 'bg-sky-400 animate-pulse'
                    : 'bg-emerald-400'
            }`}
          />
          <span className="text-slate-300">{STATUS_LABELS[saveStatus]}</span>
          <span className="text-slate-600">•</span>
          <span>Last saved: {formatLastSaved(lastSavedAt)}</span>
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <span className="hidden text-slate-500 md:inline">
          Validation Engine: Phase 07
        </span>
        <span className="font-mono text-slate-300">Zoom: {zoomPercent}%</span>
      </div>
    </footer>
  );
}
