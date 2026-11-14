import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import {
  createArchitecture,
  saveArchitectureCanvas,
} from '@/features/architecture-builder/services/architectureService';
import { getTemplateBlueprint } from '../data/templateBlueprints';
import { useUiStore } from '@/store/useUiStore';

export function TemplatePreviewModal() {
  const navigate = useNavigate();
  const template = useUiStore((state) => state.selectedTemplate);
  const setSelectedTemplate = useUiStore((state) => state.setSelectedTemplate);
  const [isLaunching, setIsLaunching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLaunchTemplate = async () => {
    if (!template) return;
    setIsLaunching(true);
    setErrorMessage(null);

    try {
      // 1. Create a real Architecture instance in the database
      const created = await createArchitecture({
        name: template.title,
        description: template.description,
        region: 'us-east-1',
      });

      // 2. Fetch the corresponding blueprint topology
      const blueprint = getTemplateBlueprint(template.id);
      if (blueprint && blueprint.nodes.length > 0) {
        await saveArchitectureCanvas(created.id, {
          nodes: blueprint.nodes,
          edges: blueprint.edges,
          viewport: blueprint.viewport,
        });
      }

      // 3. Close the modal and immediately route the user to the builder canvas
      setSelectedTemplate(null);
      navigate(`/architecture-builder/${created.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to launch template into builder';
      setErrorMessage(msg);
      setIsLaunching(false);
    }
  };

  return (
    <Modal
      open={Boolean(template)}
      onClose={() => {
        if (!isLaunching) {
          setErrorMessage(null);
          setSelectedTemplate(null);
        }
      }}
      title={template?.title ?? 'Blueprint Preview'}
      subtitle={template ? `${template.category} · ${template.complexity} Blueprint` : undefined}
    >
      {template ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Ready-to-Deploy Blueprint</Badge>
            <span className="text-xs text-slate-400">
              {template.serviceCount} AWS services pre-wired
            </span>
          </div>

          <p className="text-sm leading-relaxed text-slate-300">{template.description}</p>

          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
              Key AWS Services
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {template.services.map((service) => (
                <span
                  key={service}
                  className="rounded-md border border-border-subtle bg-canvas px-2.5 py-1 text-xs text-slate-200"
                >
                  {service}
                </span>
              ))}
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
            <Button
              variant="ghost"
              disabled={isLaunching}
              onClick={() => {
                setErrorMessage(null);
                setSelectedTemplate(null);
              }}
            >
              Close
            </Button>
            <Button
              variant="primary"
              disabled={isLaunching}
              onClick={handleLaunchTemplate}
            >
              {isLaunching ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-white" />
                  <span>Loading Blueprint into Builder...</span>
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4 text-sky-200" />
                  <span>Use Template in Builder</span>
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
