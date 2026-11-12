import { ArrowRight, Clock, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader } from '@/components/Card';
import { AwsServiceIcon } from '@/features/aws-services/components/AwsServiceIcon';
import { TerraformStatusBadge } from '@/features/aws-services/components/TerraformStatusBadge';
import type { DashboardServicePreview } from '../types/dashboard.types';

interface ServicesSnapshotSectionProps {
  favoriteServices: DashboardServicePreview[];
  recentlyExploredServices: DashboardServicePreview[];
}

function ServiceMiniList({
  services,
  emptyTitle,
  emptyDescription,
  emptyIcon,
}: {
  services: DashboardServicePreview[];
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: 'star' | 'clock';
}) {
  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-8 text-center">
        <div className="rounded-lg border border-border-subtle bg-canvas p-2 text-slate-400">
          {emptyIcon === 'star' ? (
            <Star className="h-4 w-4 text-amber-400" />
          ) : (
            <Clock className="h-4 w-4 text-sky-400" />
          )}
        </div>
        <p className="mt-2.5 text-xs font-medium text-slate-200">{emptyTitle}</p>
        <p className="mt-1 max-w-[260px] text-[11px] leading-relaxed text-slate-400">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-subtle">
      {services.map((svc) => (
        <Link
          key={svc.id}
          to={`/services/${svc.slug}`}
          className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-elevated/40"
        >
          <div className="flex min-w-0 items-center gap-3">
            <AwsServiceIcon iconKey={svc.iconKey} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium text-slate-100">{svc.name}</span>
                <span className="rounded bg-canvas px-1 py-0.5 font-mono text-[10px] text-slate-400">
                  {svc.shortName}
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-400">{svc.categoryName}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <TerraformStatusBadge status={svc.terraformSupport} compact />
            <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
          </div>
        </Link>
      ))}
    </div>
  );
}

export function ServicesSnapshotSection({
  favoriteServices,
  recentlyExploredServices,
}: ServicesSnapshotSectionProps) {
  return (
    <section aria-label="AWS Services Snapshot" className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card>
        <CardHeader
          title="Favorite AWS Services"
          description="Pinned services from your catalog"
          action={
            <Link
              to="/services?view=favorites"
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <ServiceMiniList
          services={favoriteServices}
          emptyTitle="No favorite services yet"
          emptyDescription="Star AWS services in the Explorer to bookmark them here."
          emptyIcon="star"
        />
      </Card>

      <Card>
        <CardHeader
          title="Recently Explored Services"
          description="Latest AWS documentation & resource views"
          action={
            <Link
              to="/services?view=recent"
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"
            >
              <span>Explore catalog</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <ServiceMiniList
          services={recentlyExploredServices}
          emptyTitle="No services explored yet"
          emptyDescription="Inspect any AWS service page to track exploration history."
          emptyIcon="clock"
        />
      </Card>
    </section>
  );
}
