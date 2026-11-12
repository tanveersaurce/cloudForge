import { ArrowRight, Cpu, Network, Server, Zap } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Card, CardHeader } from '@/components/Card';
import { useUiStore } from '@/store/useUiStore';
import type { DashboardQuickStartTemplate } from '../types/dashboard.types';

const CATEGORY_ICONS: Record<DashboardQuickStartTemplate['category'], typeof Server> = {
  'Web & Compute': Server,
  Serverless: Zap,
  Networking: Network,
  'Storage & Edge': Cpu,
};

interface QuickStartTemplatesSectionProps {
  templates: DashboardQuickStartTemplate[];
}

export function QuickStartTemplatesSection({ templates }: QuickStartTemplatesSectionProps) {
  const searchQuery = useUiStore((state) => state.searchQuery);
  const setSelectedTemplate = useUiStore((state) => state.setSelectedTemplate);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTemplates = templates.filter((template) => {
    if (!normalizedQuery) return true;
    return (
      template.title.toLowerCase().includes(normalizedQuery) ||
      template.category.toLowerCase().includes(normalizedQuery) ||
      template.description.toLowerCase().includes(normalizedQuery) ||
      template.services.some((s) => s.toLowerCase().includes(normalizedQuery))
    );
  });

  return (
    <Card>
      <CardHeader
        title="Quick Start Templates"
        description="Curated AWS reference blueprints (static starter catalog)"
        action={<Badge variant="muted">Static Blueprints</Badge>}
      />

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        {filteredTemplates.length === 0 ? (
          <div className="col-span-full py-6 text-center text-xs text-slate-400">
            No templates match &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          filteredTemplates.map((template) => {
            const Icon = CATEGORY_ICONS[template.category];

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplate(template)}
                className="group flex flex-col justify-between rounded-lg border border-border-subtle bg-canvas/50 p-4 text-left transition-colors hover:border-sky-500/40 hover:bg-surface-elevated"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-sky-300">
                      <Icon className="h-3.5 w-3.5" />
                      <span>{template.category}</span>
                    </div>
                    <Badge variant="neutral">{template.complexity}</Badge>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 group-hover:text-sky-300">
                      {template.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400 line-clamp-2">
                      {template.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border-subtle/70 pt-3 text-[11px] text-slate-400">
                  <span>{template.serviceCount} AWS services</span>
                  <span className="inline-flex items-center gap-1 font-medium text-sky-400">
                    Preview
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </Card>
  );
}
