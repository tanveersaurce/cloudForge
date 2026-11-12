import { ArrowRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { cn } from '@/utils/cn';
import type { AwsServiceListItemDto } from '../types/awsService.types';
import { AwsServiceIcon } from './AwsServiceIcon';
import { SupportLevelBadge } from './SupportLevelBadge';
import { TerraformStatusBadge } from './TerraformStatusBadge';

interface ServiceCardProps {
  service: AwsServiceListItemDto;
  onToggleFavorite: (service: AwsServiceListItemDto) => void;
  isFavoriteMutating?: boolean;
  exploredMeta?: {
    viewCount: number;
    lastExploredAt: string;
  };
}

export function ServiceCard({
  service,
  onToggleFavorite,
  isFavoriteMutating = false,
  exploredMeta,
}: ServiceCardProps) {
  return (
    <article className="group flex h-full flex-col rounded-xl border border-border-subtle bg-surface/90 p-4 transition-colors hover:border-border-strong hover:bg-surface-elevated/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AwsServiceIcon
            iconKey={service.iconKey}
            categoryIconKey={service.category.iconKey}
            size="md"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                to={`/services/${service.slug}`}
                className="truncate text-sm font-semibold text-slate-100 transition-colors group-hover:text-sky-300"
              >
                {service.name}
              </Link>
              <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400">
                {service.shortName}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">{service.category.name}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleFavorite(service)}
          disabled={isFavoriteMutating}
          aria-label={
            service.isFavorite
              ? `Remove ${service.name} from favorites`
              : `Add ${service.name} to favorites`
          }
          aria-pressed={service.isFavorite}
          className={cn(
            'shrink-0 rounded-lg border p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:opacity-50',
            service.isFavorite
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              : 'border-border-subtle bg-canvas/70 text-slate-400 hover:border-border-strong hover:text-slate-200',
          )}
        >
          <Star className={cn('h-3.5 w-3.5', service.isFavorite ? 'fill-amber-300' : '')} />
        </button>
      </div>

      <p className="mt-3 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-300">
        {service.shortDescription}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <TerraformStatusBadge status={service.terraformSupport} compact />
        <SupportLevelBadge level={service.supportLevel} />
        {service.terraformProviderAvailable ? (
          <Badge variant="muted" className="text-[10px]">
            AWS Provider
          </Badge>
        ) : null}
      </div>

      {exploredMeta ? (
        <div className="mt-3 flex items-center justify-between border-t border-border-subtle/70 pt-2.5 text-[11px] text-slate-400">
          <span>
            Viewed {exploredMeta.viewCount} {exploredMeta.viewCount === 1 ? 'time' : 'times'}
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            {new Date(exploredMeta.lastExploredAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
        <span className="truncate text-[11px] text-slate-500">{service.officialServiceName}</span>
        <Link
          to={`/services/${service.slug}`}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-sky-400 transition-colors hover:text-sky-300"
        >
          <span>View Details</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}
