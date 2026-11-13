import type { ReactFlowInstance } from '@xyflow/react';
import { AlertCircle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/Button';
import { ApiClientError } from '@/services/apiClient';
import { useArchitectureBuilderStore } from '@/store/useArchitectureBuilderStore';
import { ArchitectureCanvas } from '../components/ArchitectureCanvas';
import { AwsResourceLibrarySidebar } from '../components/AwsResourceLibrarySidebar';
import { BuilderStatusBar } from '../components/BuilderStatusBar';
import { BuilderTopToolbar } from '../components/BuilderTopToolbar';
import { NodeInspectorSidebar } from '../components/NodeInspectorSidebar';
import { ValidationDashboardDrawer } from '@/features/validation/components/ValidationDashboardDrawer';
import { getArchitectureById } from '../services/architectureService';
import type {
  ArchitectureFlowEdge,
  ArchitectureFlowNode,
} from '../types/architecture.types';

const AUTOSAVE_DELAY_MS = 1500;

export function ArchitectureBuilderPage() {
  const { architectureId } = useParams<{ architectureId: string }>();

  const hydrateArchitecture = useArchitectureBuilderStore((s) => s.hydrateArchitecture);
  const resetBuilder = useArchitectureBuilderStore((s) => s.resetBuilder);
  const addResourceNode = useArchitectureBuilderStore((s) => s.addResourceNode);
  const saveCanvas = useArchitectureBuilderStore((s) => s.saveCanvas);
  const isDirty = useArchitectureBuilderStore((s) => s.isDirty);
  const isSavingInFlight = useArchitectureBuilderStore((s) => s.isSavingInFlight);
  const architecture = useArchitectureBuilderStore((s) => s.architecture);
  const isValidationDrawerOpen = useArchitectureBuilderStore((s) => s.isValidationDrawerOpen);
  const setValidationDrawerOpen = useArchitectureBuilderStore((s) => s.setValidationDrawerOpen);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<
    ArchitectureFlowNode,
    ArchitectureFlowEdge
  > | null>(null);

  const loadArchitecture = useCallback(async () => {
    if (!architectureId) {
      setError('Architecture ID is missing.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const detail = await getArchitectureById(architectureId);
      hydrateArchitecture(detail);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Unable to load architecture.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [architectureId, hydrateArchitecture]);

  useEffect(() => {
    void loadArchitecture();
    return () => {
      resetBuilder();
    };
  }, [loadArchitecture, resetBuilder]);

  // Debounced autosave when canvas has unsaved changes
  useEffect(() => {
    if (!isDirty || isSavingInFlight || !architecture) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveCanvas();
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [isDirty, isSavingInFlight, architecture, saveCanvas]);

  // Warn before closing tab if unsaved changes remain
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-canvas text-slate-300">
        <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
        <p className="text-xs font-medium">Loading architecture canvas...</p>
      </div>
    );
  }

  if (error || !architecture) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
        <div className="max-w-md rounded-xl border border-rose-500/30 bg-surface p-6">
          <AlertCircle className="mx-auto h-7 w-7 text-rose-400" />
          <h1 className="mt-3 text-base font-semibold text-slate-100">
            Unable to open architecture
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {error ?? 'The requested architecture could not be loaded.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void loadArchitecture()}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </Button>
            <Link to="/architectures">
              <Button variant="primary" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>My Architectures</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-slate-100">
      <BuilderTopToolbar
        onZoomIn={() => rfInstance?.zoomIn({ duration: 150 })}
        onZoomOut={() => rfInstance?.zoomOut({ duration: 150 })}
        onFitView={() => rfInstance?.fitView({ padding: 0.2, duration: 200 })}
        isLibraryOpen={!libraryCollapsed}
        onToggleLibrary={() => setLibraryCollapsed((prev) => !prev)}
        isInspectorOpen={!inspectorCollapsed}
        onToggleInspector={() => setInspectorCollapsed((prev) => !prev)}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <AwsResourceLibrarySidebar
          onAddResource={(item) => addResourceNode(item)}
          collapsed={libraryCollapsed}
          onToggleCollapse={() => setLibraryCollapsed((prev) => !prev)}
        />

        <main className="relative flex min-w-0 flex-1 flex-col">
          <ArchitectureCanvas onReactFlowInit={setRfInstance} />
        </main>

        <NodeInspectorSidebar
          isCollapsed={inspectorCollapsed}
          onToggleCollapse={() => setInspectorCollapsed((prev) => !prev)}
        />
      </div>

      <ValidationDashboardDrawer
        isOpen={isValidationDrawerOpen}
        onClose={() => setValidationDrawerOpen(false)}
      />

      <BuilderStatusBar />
    </div>
  );
}
