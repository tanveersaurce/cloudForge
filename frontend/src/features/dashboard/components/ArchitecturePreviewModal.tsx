import { Globe, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { useUiStore } from '@/store/useUiStore';

export function ArchitecturePreviewModal() {
  const navigate = useNavigate();
  const architecture = useUiStore((state) => state.selectedArchitecture);
  const setSelectedArchitecture = useUiStore((state) => state.setSelectedArchitecture);

  return (
    <Modal
      open={Boolean(architecture)}
      onClose={() => setSelectedArchitecture(null)}
      title={architecture?.name ?? 'Architecture Details'}
      subtitle="Persisted PostgreSQL architecture record"
    >
      {architecture ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{architecture.status}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Globe className="h-3.5 w-3.5 text-slate-500" />
              {architecture.region}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              {architecture.resourceCount} resources
            </span>
          </div>

          <p className="text-sm leading-relaxed text-slate-300">
            {architecture.description || 'No description provided for this architecture.'}
          </p>

          <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
            <Button variant="ghost" onClick={() => setSelectedArchitecture(null)}>
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedArchitecture(null);
                navigate('/builder');
              }}
            >
              Architecture Builder (Phase 03)
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
