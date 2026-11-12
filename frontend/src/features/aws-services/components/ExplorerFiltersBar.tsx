import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/Button';
import type {
  AwsSupportLevel,
  ServiceSortOption,
  TerraformSupportStatus,
} from '../types/awsService.types';

interface ExplorerFiltersBarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  terraformSupport: TerraformSupportStatus | '';
  onTerraformSupportChange: (value: TerraformSupportStatus | '') => void;
  supportLevel: AwsSupportLevel | '';
  onSupportLevelChange: (value: AwsSupportLevel | '') => void;
  sort: ServiceSortOption;
  onSortChange: (value: ServiceSortOption) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  disabled?: boolean;
}

export function ExplorerFiltersBar({
  searchInput,
  onSearchInputChange,
  terraformSupport,
  onTerraformSupportChange,
  supportLevel,
  onSupportLevelChange,
  sort,
  onSortChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  hasActiveFilters,
  onClearFilters,
  disabled = false,
}: ExplorerFiltersBarProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface/90 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            disabled={disabled}
            placeholder="Search AWS services, abbreviations (EC2, VPC, S3), or keywords..."
            aria-label="Search AWS services"
            className="h-9 w-full rounded-lg border border-border-subtle bg-canvas pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400/50 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Filters:</span>
          </div>

          <select
            aria-label="Filter by Terraform support"
            value={terraformSupport}
            disabled={disabled}
            onChange={(e) =>
              onTerraformSupportChange(e.target.value as TerraformSupportStatus | '')
            }
            className="h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-slate-200 focus:border-sky-400 focus:outline-none disabled:opacity-50"
          >
            <option value="">All Terraform Status</option>
            <option value="SUPPORTED">Terraform Ready</option>
            <option value="PARTIAL">Terraform Partial</option>
            <option value="NOT_IMPLEMENTED">Generator Pending</option>
            <option value="NOT_APPLICABLE">Not Applicable</option>
          </select>

          <select
            aria-label="Filter by CloudForge support level"
            value={supportLevel}
            disabled={disabled}
            onChange={(e) => onSupportLevelChange(e.target.value as AwsSupportLevel | '')}
            className="h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-slate-200 focus:border-sky-400 focus:outline-none disabled:opacity-50"
          >
            <option value="">All Support Levels</option>
            <option value="CORE">Core Services</option>
            <option value="STANDARD">Standard Services</option>
            <option value="EXTENDED">Extended Services</option>
          </select>

          <select
            aria-label="Sort AWS services"
            value={sort}
            disabled={disabled}
            onChange={(e) => onSortChange(e.target.value as ServiceSortOption)}
            className="h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-slate-200 focus:border-sky-400 focus:outline-none disabled:opacity-50"
          >
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="category">Category</option>
          </select>

          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-slate-300 hover:border-border-strong">
            <input
              type="checkbox"
              checked={favoritesOnly}
              disabled={disabled}
              onChange={(e) => onFavoritesOnlyChange(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-600 bg-surface text-sky-500 focus:ring-sky-400"
            />
            <span>Favorites only</span>
          </label>

          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              <X className="h-3.5 w-3.5" />
              <span>Clear</span>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
