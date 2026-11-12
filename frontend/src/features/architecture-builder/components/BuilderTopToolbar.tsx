import { useEffect, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  Maximize2,
  PanelLeft,
  PanelRight,
  Pencil,
  Redo2,
  Save,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { SaveStatus } from '@/features/architecture-builder/types/architecture.types';
import {
  serializeFlowEdges,
  serializeFlowNodes,
  useArchitectureBuilderStore,
} from '@/store/useArchitectureBuilderStore';

export interface BuilderTopToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  isLibraryOpen?: boolean;
  onToggleLibrary?: () => void;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
}

const SAVE_STATUS_CONFIG: Record<
  SaveStatus,
  { label: string; className: string }
> = {
  idle: {
    label: 'All changes saved',
    className: 'border-slate-700/80 bg-slate-800/70 text-slate-300',
  },
  unsaved: {
    label: 'Unsaved changes',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  saving: {
    label: 'Saving...',
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  },
  saved: {
    label: 'All changes saved',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  error: {
    label: 'Save failed',
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
};

export function BuilderTopToolbar({
  onZoomIn,
  onZoomOut,
  onFitView,
  isLibraryOpen = true,
  onToggleLibrary,
  isInspectorOpen = true,
  onToggleInspector,
}: BuilderTopToolbarProps) {
  const architecture = useArchitectureBuilderStore((s) => s.architecture);
  const nodes = useArchitectureBuilderStore((s) => s.nodes);
  const edges = useArchitectureBuilderStore((s) => s.edges);
  const viewport = useArchitectureBuilderStore((s) => s.viewport);
  const saveStatus = useArchitectureBuilderStore((s) => s.saveStatus);
  const saveError = useArchitectureBuilderStore((s) => s.saveError);
  const isSavingInFlight = useArchitectureBuilderStore((s) => s.isSavingInFlight);
  const pastCount = useArchitectureBuilderStore((s) => s.past.length);
  const futureCount = useArchitectureBuilderStore((s) => s.future.length);

  const undo = useArchitectureBuilderStore((s) => s.undo);
  const redo = useArchitectureBuilderStore((s) => s.redo);
  const saveCanvas = useArchitectureBuilderStore((s) => s.saveCanvas);
  const renameArchitecture = useArchitectureBuilderStore((s) => s.renameArchitecture);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [exportedRecently, setExportedRecently] = useState(false);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(architecture?.name ?? '');
    }
  }, [architecture?.name, isEditingTitle]);

  const startEditingTitle = () => {
    if (!architecture) return;
    setTitleDraft(architecture.name);
    setIsEditingTitle(true);
  };

  const commitTitle = async () => {
    if (!architecture) {
      setIsEditingTitle(false);
      return;
    }
    const trimmed = titleDraft.trim();
    setIsEditingTitle(false);
    if (!trimmed || trimmed === architecture.name) {
      setTitleDraft(architecture.name);
      return;
    }
    const ok = await renameArchitecture(trimmed);
    if (!ok) {
      setTitleDraft(architecture.name);
    }
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commitTitle();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setTitleDraft(architecture?.name ?? '');
      setIsEditingTitle(false);
    }
  };

  const handleExportJson = () => {
    const payload = {
      name: architecture?.name ?? 'Untitled Architecture',
      region: architecture?.region ?? 'us-east-1',
      nodes: serializeFlowNodes(nodes),
      edges: serializeFlowEdges(edges),
      viewport,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeSlug = (architecture?.name ?? 'cloudforge-architecture')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    link.href = url;
    link.download = `${safeSlug || 'cloudforge-architecture'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportedRecently(true);
    window.setTimeout(() => setExportedRecently(false), 1800);
  };

  const statusMeta = SAVE_STATUS_CONFIG[saveStatus];
  const zoomPercent = Math.round(viewport.zoom * 100);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-3 text-slate-100 backdrop-blur sm:px-4">
      {/* Left: Back link, inline title, region badge, save status */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          to="/"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
          title="Back to Dashboard"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        <div className="h-4 w-px bg-slate-800" />

        {isEditingTitle ? (
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => void commitTitle()}
            onKeyDown={handleTitleKeyDown}
            autoFocus
            maxLength={120}
            aria-label="Architecture title"
            className="h-8 w-44 rounded-md border border-sky-500/60 bg-slate-900 px-2.5 text-sm font-semibold text-white outline-none ring-2 ring-sky-500/20 sm:w-64"
          />
        ) : (
          <button
            type="button"
            onClick={startEditingTitle}
            disabled={!architecture}
            title="Click to rename architecture"
            className="group flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left transition hover:bg-slate-900 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className="truncate text-sm font-semibold text-slate-100">
              {architecture?.name ?? 'Loading Architecture...'}
            </span>
            {architecture && (
              <Pencil className="h-3 w-3 shrink-0 text-slate-500 opacity-0 transition group-hover:opacity-100" />
            )}
          </button>
        )}

        {architecture?.region && (
          <span className="hidden rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-medium text-sky-300 md:inline-flex">
            {architecture.region}
          </span>
        )}

        <span
          title={saveError ?? undefined}
          className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium sm:inline-flex ${statusMeta.className}`}
        >
          {saveStatus === 'saving' && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {statusMeta.label}
        </span>
      </div>

      {/* Right: Panel toggles, Undo/Redo, Zoom controls, Export, Save */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {onToggleLibrary && (
          <button
            type="button"
            onClick={onToggleLibrary}
            aria-pressed={isLibraryOpen}
            title="Toggle Resource Library"
            className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition lg:hidden ${
              isLibraryOpen
                ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Undo / Redo */}
        <div className="flex items-center rounded-md border border-slate-800 bg-slate-900 p-0.5">
          <button
            type="button"
            onClick={undo}
            disabled={pastCount === 0}
            title="Undo (Ctrl/Cmd + Z)"
            aria-label="Undo"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={futureCount === 0}
            title="Redo (Ctrl/Cmd + Shift + Z)"
            aria-label="Redo"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="hidden items-center rounded-md border border-slate-800 bg-slate-900 p-0.5 md:flex">
          <button
            type="button"
            onClick={onZoomOut}
            disabled={!onZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-40"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3.25rem] px-1.5 text-center font-mono text-[11px] font-medium text-slate-300">
            {zoomPercent}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            disabled={!onZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-40"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <div className="mx-0.5 h-4 w-px bg-slate-800" />
          <button
            type="button"
            onClick={onFitView}
            disabled={!onFitView}
            title="Fit View"
            aria-label="Fit View"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-40"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Export JSON */}
        <button
          type="button"
          onClick={handleExportJson}
          disabled={!architecture}
          title="Export Architecture JSON"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exportedRecently ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline text-emerald-300">Exported</span>
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export JSON</span>
            </>
          )}
        </button>

        {/* Manual Save */}
        <button
          type="button"
          onClick={() => void saveCanvas()}
          disabled={!architecture || isSavingInFlight}
          title="Save Canvas (Ctrl/Cmd + S)"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSavingInFlight ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span>{isSavingInFlight ? 'Saving...' : 'Save'}</span>
        </button>

        {onToggleInspector && (
          <button
            type="button"
            onClick={onToggleInspector}
            aria-pressed={isInspectorOpen}
            title="Toggle Property Inspector"
            className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition lg:hidden ${
              isInspectorOpen
                ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <PanelRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </header>
  );
}
