import { Boxes, CloudCog, DollarSign, FolderKanban } from 'lucide-react';
import { Card } from '@/components/Card';
import type { DashboardOverviewData } from '../types/dashboard.types';

interface StatCardsRowProps {
  metrics: DashboardOverviewData['metrics'];
}

export function StatCardsRow({ metrics }: StatCardsRowProps) {
  const cards = [
    {
      id: 'total-architectures',
      label: 'Total Architectures',
      value: String(metrics.totalArchitectures),
      sublabel: 'Persisted in PostgreSQL',
      badge: 'LIVE DB',
      available: true,
      Icon: Boxes,
    },
    {
      id: 'aws-services-explored',
      label: 'AWS Services Explored',
      value: '—',
      sublabel: metrics.awsServicesExplored.statusLabel,
      badge: 'PHASE 03',
      available: false,
      Icon: CloudCog,
    },
    {
      id: 'saved-projects',
      label: 'Saved Projects',
      value: String(metrics.savedProjects),
      sublabel: 'Active workspace projects',
      badge: 'LIVE DB',
      available: true,
      Icon: FolderKanban,
    },
    {
      id: 'estimated-monthly-cost',
      label: 'Estimated Monthly Cost',
      value: '—',
      sublabel: metrics.estimatedMonthlyCost.statusLabel,
      badge: 'PHASE 04',
      available: false,
      Icon: DollarSign,
    },
  ];

  return (
    <section
      aria-label="Workspace metrics"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map(({ id, label, value, sublabel, badge, available, Icon }) => (
        <Card key={id} className="p-4 transition-colors hover:border-border-strong">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-medium text-slate-400">{label}</span>
            <div className="rounded-md border border-border-subtle bg-surface-elevated p-1.5 text-sky-400">
              <Icon className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span
              className={
                available
                  ? 'text-2xl font-semibold tracking-tight text-slate-100'
                  : 'text-2xl font-semibold tracking-tight text-slate-500'
              }
            >
              {value}
            </span>
            <span
              className={
                available
                  ? 'rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300'
                  : 'rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-400'
              }
            >
              {badge}
            </span>
          </div>

          <div className="mt-2 border-t border-border-subtle/70 pt-2.5 text-[11px] text-slate-400">
            <span className="line-clamp-1">{sublabel}</span>
          </div>
        </Card>
      ))}
    </section>
  );
}
