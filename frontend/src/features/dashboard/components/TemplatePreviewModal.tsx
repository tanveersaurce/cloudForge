import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { useUiStore } from '@/store/useUiStore';

export function TemplatePreviewModal() {
  const navigate = useNavigate();
  const template = useUiStore((state) => state.selectedTemplate);
  const setSelectedTemplate = useUiStore((state) => state.setSelectedTemplate);

  return (
    <Modal
      open={Boolean(template)}
      onClose={() => setSelectedTemplate(null)}
      title={template?.title ?? 'Blueprint Preview'}
      subtitle={template ? `${template.category} · ${template.complexity} Blueprint` : undefined}
    >
      {template ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Static Reference Blueprint</Badge>
            <span className="text-xs text-slate-400">
              {template.serviceCount} AWS services included
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

          <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
            <Button variant="ghost" onClick={() => setSelectedTemplate(null)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setSelectedTemplate(null);
                navigate('/builder');
              }}
            >
              Inspect Builder Roadmap
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
