import { Clock, Layers, Star } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { AwsCategoryDto } from '../types/awsService.types';
import { AwsServiceIcon } from './AwsServiceIcon';

export type ExplorerViewMode = 'catalog' | 'favorites' | 'recent';

interface ExplorerSidebarProps {
  categories: AwsCategoryDto[];
  totalCatalogCount: number;
  selectedCategory: string;
  viewMode: ExplorerViewMode;
  onSelectCategory: (slug: string) => void;
  onSelectViewMode: (mode: ExplorerViewMode) => void;
}

export function ExplorerSidebar({
  categories,
  totalCatalogCount,
  selectedCategory,
  viewMode,
  onSelectCategory,
  onSelectViewMode,
}: ExplorerSidebarProps) {
  return (
    <aside
      aria-label="AWS Service Categories"
      className="rounded-xl border border-border-subtle bg-surface/90 p-3"
    >
      <div className="space-y-1 border-b border-border-subtle pb-3">
        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Workspace Views
        </p>
        <button
          type="button"
          onClick={() => {
            onSelectViewMode('catalog');
            onSelectCategory('all');
          }}
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors',
            viewMode === 'catalog' && selectedCategory === 'all'
              ? 'bg-sky-500/15 text-sky-300'
              : 'text-slate-300 hover:bg-surface-elevated hover:text-slate-100',
          )}
        >
          <span className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-sky-400" />
            <span>All Services</span>
          </span>
          <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            {totalCatalogCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectViewMode('favorites')}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors',
            viewMode === 'favorites'
              ? 'bg-amber-500/15 text-amber-300'
              : 'text-slate-300 hover:bg-surface-elevated hover:text-slate-100',
          )}
        >
          <Star className="h-3.5 w-3.5 text-amber-400" />
          <span>Favorite Services</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectViewMode('recent')}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors',
            viewMode === 'recent'
              ? 'bg-sky-500/15 text-sky-300'
              : 'text-slate-300 hover:bg-surface-elevated hover:text-slate-100',
          )}
        >
          <Clock className="h-3.5 w-3.5 text-sky-400" />
          <span>Recently Explored</span>
        </button>
      </div>

      <div className="pt-3">
        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          AWS Categories ({categories.length})
        </p>
        <div className="max-h-[480px] space-y-1 overflow-y-auto pr-0.5">
          {categories.map((category) => {
            const active = viewMode === 'catalog' && selectedCategory === category.slug;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  onSelectViewMode('catalog');
                  onSelectCategory(category.slug);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors',
                  active
                    ? 'bg-sky-500/15 font-medium text-sky-300'
                    : 'text-slate-300 hover:bg-surface-elevated hover:text-slate-100',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <AwsServiceIcon iconKey={category.iconKey} size="sm" />
                  <span className="truncate">{category.name}</span>
                </span>
                <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  {category.serviceCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
