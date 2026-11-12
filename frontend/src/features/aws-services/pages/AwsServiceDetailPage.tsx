import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  ExternalLink,
  Globe,
  Info,
  Layers,
  Settings2,
  Star,
  Terminal,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { ApiClientError } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import { AwsServiceIcon } from '../components/AwsServiceIcon';
import { SupportLevelBadge } from '../components/SupportLevelBadge';
import { TerraformStatusBadge } from '../components/TerraformStatusBadge';
import {
  addFavoriteService,
  fetchAwsServiceBySlug,
  recordServiceExploration,
  removeFavoriteService,
} from '../services/awsCatalogService';
import type { AwsServiceDetailDto } from '../types/awsService.types';

export function AwsServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const [service, setService] = useState<AwsServiceDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavoriteMutating, setIsFavoriteMutating] = useState<boolean>(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!slug) {
      setError('Service slug is missing.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const detail = await fetchAwsServiceBySlug(slug);
      setService(detail);
      void recordServiceExploration(detail.id).catch(() => {
        // Non-blocking history recording: detail page remains usable even if telemetry fails.
      });
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Unable to load AWS service details.';
      setError(message);
      setService(null);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleToggleFavorite = async () => {
    if (!service) return;
    setFavoriteError(null);
    setIsFavoriteMutating(true);
    const nextFavorite = !service.isFavorite;

    try {
      if (nextFavorite) {
        await addFavoriteService(service.id);
      } else {
        await removeFavoriteService(service.id);
      }
      setService((prev) => (prev ? { ...prev, isFavorite: nextFavorite } : prev));
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Failed to update favorite status.';
      setFavoriteError(message);
    } finally {
      setIsFavoriteMutating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-800" />
        <div className="h-40 animate-pulse rounded-xl border border-border-subtle bg-surface/70" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl border border-border-subtle bg-surface/70" />
          <div className="h-64 animate-pulse rounded-xl border border-border-subtle bg-surface/70" />
        </div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="space-y-4">
        <Link
          to="/services"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to AWS Services Explorer</span>
        </Link>
        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-500/30 bg-surface/90 px-6 py-14 text-center">
          <AlertTriangle className="h-7 w-7 text-rose-400" />
          <h1 className="mt-3 text-base font-semibold text-slate-100">Service not available</h1>
          <p className="mt-1 max-w-md text-xs text-slate-400">
            {error ?? 'The requested AWS service could not be found in the catalog.'}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void loadDetail()}>
              Retry
            </Button>
            <Link to="/services">
              <Button variant="primary" size="sm">
                Browse Catalog
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const requiredProps = service.configurationSchema?.requiredProperties ?? [];
  const optionalProps = service.configurationSchema?.optionalProperties ?? [];
  const dependencies = service.configurationSchema?.dependencies ?? [];
  const verificationNote = service.configurationSchema?.verificationNote;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/services"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to AWS Services Explorer</span>
        </Link>

        <Link
          to={`/services?category=${encodeURIComponent(service.category.slug)}`}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          Category: <span className="font-medium text-slate-200">{service.category.name}</span>
        </Link>
      </div>

      {/* Hero Header */}
      <Card className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <AwsServiceIcon
              iconKey={service.iconKey}
              categoryIconKey={service.category.iconKey}
              size="lg"
            />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
                  {service.name}
                </h1>
                <span className="rounded-md border border-border-subtle bg-canvas px-2 py-0.5 font-mono text-xs font-medium text-slate-300">
                  {service.shortName}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official AWS Name:{' '}
                <span className="font-medium text-slate-200">{service.officialServiceName}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="info">{service.category.name}</Badge>
                <SupportLevelBadge level={service.supportLevel} />
                <TerraformStatusBadge status={service.terraformSupport} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={service.isFavorite ? 'secondary' : 'secondary'}
              size="sm"
              onClick={() => void handleToggleFavorite()}
              disabled={isFavoriteMutating}
              className={cn(
                service.isFavorite &&
                  'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20',
              )}
            >
              <Star className={cn('h-3.5 w-3.5', service.isFavorite && 'fill-amber-300 text-amber-300')} />
              <span>{service.isFavorite ? 'Favorited' : 'Add to Favorites'}</span>
            </Button>

            <a
              href={service.officialDocumentationUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-elevated px-3 text-xs font-medium text-slate-200 transition-colors hover:border-border-strong hover:bg-surface-hover"
            >
              <BookOpen className="h-3.5 w-3.5 text-sky-400" />
              <span>AWS Docs</span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>

            <a
              href={service.awsConsoleUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-elevated px-3 text-xs font-medium text-slate-200 transition-colors hover:border-border-strong hover:bg-surface-hover"
            >
              <span>AWS Console</span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          </div>
        </div>

        {favoriteError ? (
          <p className="mt-3 text-xs text-rose-300">{favoriteError}</p>
        ) : null}

        <p className="mt-5 text-sm leading-relaxed text-slate-200">{service.detailedDescription}</p>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border-subtle pt-4 md:grid-cols-2">
          <div className="rounded-lg border border-border-subtle bg-canvas/70 px-3.5 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Pricing Model
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{service.pricingModel}</p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-canvas/70 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              <Globe className="h-3 w-3 text-sky-400" />
              <span>Supported Regions</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{service.supportedRegions}</p>
          </div>
        </div>
      </Card>

      {/* Primary Use Cases & Key Features */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Primary Use Cases"
            description="Common architectural workloads served by this AWS service"
          />
          <ul className="space-y-2.5 p-5">
            {service.primaryUseCases.map((useCase) => (
              <li key={useCase} className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                <span>{useCase}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Key Capabilities"
            description="Core operational features and AWS platform integrations"
          />
          <ul className="space-y-2.5 p-5">
            {service.keyFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-300">
                <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Common Resources vs AWS Service Distinction */}
      <Card>
        <CardHeader
          title="Common AWS Resources"
          description="Underlying infrastructure resources managed under this AWS service boundary"
          action={<Badge variant="muted">{service.commonResources.length} Resources</Badge>}
        />
        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
          {service.commonResources.map((resource) => (
            <div
              key={resource.name}
              className="rounded-lg border border-border-subtle bg-canvas/70 p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Boxes className="h-3.5 w-3.5 text-sky-400" />
                  <h3 className="text-xs font-semibold text-slate-100">{resource.name}</h3>
                </div>
                {resource.terraformResourceType ? (
                  <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                    {resource.terraformResourceType}
                  </code>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{resource.description}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Configuration Overview & Terraform Mapping */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Configuration Overview"
            description="Key architectural properties and upstream dependencies prepared for Phase 04 & Phase 05"
            action={
              <Badge variant="muted">
                <Settings2 className="h-3 w-3" />
                <span>Schema Metadata</span>
              </Badge>
            }
          />
          <div className="space-y-5 p-5">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Required Properties ({requiredProps.length})
              </h3>
              {requiredProps.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">No mandatory input properties listed.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {requiredProps.map((prop) => (
                    <div
                      key={prop.name}
                      className="rounded-lg border border-border-subtle bg-canvas/70 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <code className="font-mono text-xs font-semibold text-sky-300">
                          {prop.name}
                        </code>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                            {prop.type}
                          </span>
                          <Badge variant="warning">Required</Badge>
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-300">{prop.description}</p>
                      {prop.example ? (
                        <p className="mt-1 font-mono text-[11px] text-slate-500">
                          Example: {prop.example}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Optional Properties ({optionalProps.length})
              </h3>
              {optionalProps.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">No optional properties documented yet.</p>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {optionalProps.map((prop) => (
                    <div
                      key={prop.name}
                      className="rounded-lg border border-border-subtle bg-canvas/60 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <code className="font-mono text-xs text-slate-200">{prop.name}</code>
                        <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                          {prop.type}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                        {prop.description}
                      </p>
                      {prop.example ? (
                        <p className="mt-1 font-mono text-[10px] text-slate-500">
                          e.g. {prop.example}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {dependencies.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Typical Infrastructure Dependencies
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dependencies.map((dep) => (
                    <Badge key={dep} variant="neutral">
                      {dep}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {verificationNote ? (
              <div className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-300">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                <span>{verificationNote}</span>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Terraform Readiness"
            description="Provider availability vs CloudForge Phase 05 generator"
            action={
              <Badge variant="muted">
                <Terminal className="h-3 w-3" />
                <span>HCL Mapping</span>
              </Badge>
            }
          />
          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-border-subtle bg-canvas/70 p-3.5">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">
                CloudForge Generator Status
              </p>
              <div className="mt-2">
                <TerraformStatusBadge status={service.terraformSupport} />
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                {service.terraformCloudForgeStatusNote}
              </p>
            </div>

            <div className="rounded-lg border border-border-subtle bg-canvas/70 p-3.5">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">
                HashiCorp AWS Provider
              </p>
              <p className="mt-1 text-xs font-medium text-slate-200">
                {service.terraformProviderAvailable
                  ? 'Supported by registry.terraform.io/hashicorp/aws'
                  : 'Not provided directly as standard AWS Terraform resource'}
              </p>
              {service.terraformResourceTypes.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {service.terraformResourceTypes.map((rt) => (
                    <code
                      key={rt}
                      className="rounded border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-[10px] text-emerald-300"
                    >
                      {rt}
                    </code>
                  ))}
                </div>
              ) : null}
              {service.terraformDocsUrl ? (
                <a
                  href={service.terraformDocsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"
                >
                  <span>Terraform Registry Documentation</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>

            <div className="rounded-lg border border-border-subtle bg-canvas/50 p-3.5">
              <p className="text-[11px] font-medium text-slate-300">Architecture Builder Integration</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Adding services directly onto the visual React Flow canvas opens in Phase 04.
              </p>
              <Link to="/builder" className="mt-2.5 inline-block">
                <Button variant="secondary" size="sm">
                  <span>View Builder Roadmap</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Related Services */}
      <Card>
        <CardHeader
          title="Related AWS Services"
          description="Services commonly paired with this workload in production architectures"
        />
        {service.relatedServices.length === 0 ? (
          <p className="p-5 text-xs text-slate-400">
            No related services mapped in this catalog entry.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 lg:grid-cols-3">
            {service.relatedServices.map((related) => (
              <Link
                key={related.id}
                to={`/services/${related.slug}`}
                className="group flex items-start gap-3 rounded-lg border border-border-subtle bg-canvas/70 p-3.5 transition-colors hover:border-sky-500/40 hover:bg-surface-elevated/50"
              >
                <AwsServiceIcon
                  iconKey={related.iconKey}
                  categoryIconKey={related.category.iconKey}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-slate-100 group-hover:text-sky-300">
                      {related.name}
                    </span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-slate-500 group-hover:text-sky-400" />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">{related.category.name}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                    {related.shortDescription}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
