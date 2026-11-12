import { ArrowUpRight, Boxes, Globe, Layers, Plus, SearchX } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { useUiStore } from '@/store/useUiStore';
import type { DashboardArchitectureSummary } from '../types/dashboard.types';

const STATUS_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  validated: { label: 'Validated', variant: 'success' },
  review: { label: 'Needs Review', variant: 'warning' },
  draft: { label: 'Draft', variant: 'neutral' },
};

interface RecentArchitecturesSectionProps {
  architectures: DashboardArchitectureSummary[];
}

export function RecentArchitecturesSection({ architectures }: RecentArchitecturesSectionProps) {
  const searchQuery = useUiStore((state) => state.searchQuery);
  const setSearchQuery = useUiStore((state) => state.setSearchQuery);
  const setSelectedArchitecture = useUiStore((state) => state.setSelectedArchitecture);
  const setCreateModalOpen = useUiStore((state) => state.setCreateModalOpen);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredArchitectures = architectures.filter((arch) => {
    if (!normalizedQuery) return true;
    return (
      arch.name.toLowerCase().includes(normalizedQuery) ||
      arch.region.toLowerCase().includes(normalizedQuery) ||
      (arch.description ?? '').toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <Card>
      <CardHeader
        title="Recent Architectures"
        description="Persisted AWS architecture projects associated with your account"
        action={<Badge variant="muted">{architectures.length} saved</Badge>}
      />

      {architectures.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <div className="rounded-xl border border-border-subtle bg-canvas p-3 text-sky-400">
            <Boxes className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-200">No architectures saved yet</p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Your workspace starts clean. Full architecture persistence and the visual canvas launch
            in Phases 02–03; meanwhile, explore the Quick Start blueprints below.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Preview Architecture Setup</span>
          </Button>
        </div>
      ) : filteredArchitectures.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <SearchX className="h-8 w-8 text-slate-500" />
          <p className="mt-3 text-sm font-medium text-slate-200">
            No architectures match &ldquo;{searchQuery}&rdquo;
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setSearchQuery('')}
          >
            Clear search filter
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle">
          {filteredArchitectures.map((arch) => {
            const statusInfo = STATUS_BADGE[arch.status] ?? STATUS_BADGE.draft;
            const formattedDate = new Date(arch.updatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={arch.id}
                className="flex flex-col justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface-elevated/60 md:flex-row md:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium text-slate-100">
                      {arch.name}
                    </span>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Globe className="h-3 w-3 text-slate-500" />
                      {arch.region}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">
                    {arch.description || 'No description provided'}
                  </p>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-5 md:justify-end">
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-1 text-xs font-medium text-slate-200">
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
                        <span>{arch.resourceCount}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">resources</span>
                    </div>
                    <span className="text-[11px] text-slate-500">{formattedDate}</span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedArchitecture(arch)}
                  >
                    <span>Inspect</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
