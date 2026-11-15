import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  X,
} from 'lucide-react';
import { AwsServiceIcon } from '@/features/aws-services/components/AwsServiceIcon';
import type {
  AwsCategoryDto,
  AwsServiceListItemDto,
} from '@/features/aws-services/types/awsService.types';
import { cn } from '@/utils/cn';
import type { AwsResourceRegistryItem } from '../types/architecture.types';
import {
  AWS_RESOURCE_DND_MIME,
  getCachedServiceResources,
  getCategoryAccent,
  loadAwsCatalogIndex,
  loadServiceResources,
  mapServiceListItemToPrimaryRegistryItem,
} from '../utils/awsNodeRegistry';

export interface AwsResourceLibrarySidebarProps {
  onAddResource: (item: AwsResourceRegistryItem) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

const AWS_BOUNDARIES: AwsResourceRegistryItem[] = [
  {
    key: 'boundary-vpc',
    serviceId: 'svc-amazon-vpc',
    serviceSlug: 'amazon-vpc',
    serviceName: 'Amazon VPC',
    shortName: 'VPC',
    categorySlug: 'networking-content-delivery',
    categoryName: 'Networking',
    categoryIconKey: 'vpc',
    iconKey: 'vpc',
    resourceName: 'Virtual Private Cloud',
    resourceType: 'vpc',
    description: 'Enclosing network boundary spanning Availability Zones.',
  },
  {
    key: 'boundary-az',
    serviceId: 'svc-amazon-vpc',
    serviceSlug: 'amazon-vpc',
    serviceName: 'Availability Zone',
    shortName: 'AZ',
    categorySlug: 'networking-content-delivery',
    categoryName: 'Networking',
    categoryIconKey: 'vpc',
    iconKey: 'vpc',
    resourceName: 'Availability Zone',
    resourceType: 'availability-zone',
    description: 'Isolated physical fault domain container.',
  },
  {
    key: 'boundary-pub-subnet',
    serviceId: 'svc-amazon-vpc',
    serviceSlug: 'amazon-vpc',
    serviceName: 'VPC Subnet',
    shortName: 'Public Subnet',
    categorySlug: 'networking-content-delivery',
    categoryName: 'Networking',
    categoryIconKey: 'subnet',
    iconKey: 'subnet',
    resourceName: 'Public Subnet',
    resourceType: 'subnet',
    description: 'Internet-facing subnet routing through an IGW.',
  },
  {
    key: 'boundary-priv-subnet',
    serviceId: 'svc-amazon-vpc',
    serviceSlug: 'amazon-vpc',
    serviceName: 'VPC Subnet',
    shortName: 'Private Subnet',
    categorySlug: 'networking-content-delivery',
    categoryName: 'Networking',
    categoryIconKey: 'subnet',
    iconKey: 'subnet',
    resourceName: 'Private Subnet',
    resourceType: 'subnet',
    description: 'Protected subnet routing outbound traffic via NAT.',
  },
  {
    key: 'boundary-db-subnet',
    serviceId: 'svc-amazon-vpc',
    serviceSlug: 'amazon-vpc',
    serviceName: 'VPC Subnet',
    shortName: 'Database Subnet',
    categorySlug: 'networking-content-delivery',
    categoryName: 'Networking',
    categoryIconKey: 'subnet',
    iconKey: 'subnet',
    resourceName: 'Database Subnet',
    resourceType: 'subnet',
    description: 'Isolated database tier subnet with strict security access.',
  },
  {
    key: 'boundary-cloud',
    serviceId: 'svc-amazon-vpc',
    serviceSlug: 'amazon-vpc',
    serviceName: 'AWS Cloud',
    shortName: 'AWS Cloud',
    categorySlug: 'networking-content-delivery',
    categoryName: 'Networking',
    categoryIconKey: 'vpc',
    iconKey: 'vpc',
    resourceName: 'AWS Cloud Scope',
    resourceType: 'aws-cloud',
    description: 'Global cloud boundary container.',
  },
  {
    key: 'boundary-region',
    serviceId: 'svc-amazon-vpc',
    serviceSlug: 'amazon-vpc',
    serviceName: 'AWS Region',
    shortName: 'Region',
    categorySlug: 'networking-content-delivery',
    categoryName: 'Networking',
    categoryIconKey: 'vpc',
    iconKey: 'vpc',
    resourceName: 'AWS Region Scope',
    resourceType: 'region',
    description: 'Regional infrastructure boundary container.',
  },
];

export function AwsResourceLibrarySidebar({
  onAddResource,
  collapsed: controlledCollapsed,
  onToggleCollapse,
  className,
}: AwsResourceLibrarySidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed ?? internalCollapsed;

  const handleToggleCollapse = useCallback(() => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  }, [onToggleCollapse]);

  const [categories, setCategories] = useState<AwsCategoryDto[]>([]);
  const [services, setServices] = useState<AwsServiceListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isBoundariesExpanded, setIsBoundariesExpanded] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [serviceResources, setServiceResources] = useState<
    Record<string, AwsResourceRegistryItem[]>
  >({});
  const [loadingServices, setLoadingServices] = useState<Record<string, boolean>>({});

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const index = await loadAwsCatalogIndex();
      setCategories(index.categories);
      setServices(index.services);
      if (index.categories.length > 0) {
        setExpandedCategories((prev) =>
          Object.keys(prev).length === 0 ? { [index.categories[0].slug]: true } : prev,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load AWS resource catalog.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const ensureServiceResourcesLoaded = useCallback(async (serviceSlug: string) => {
    const cached = getCachedServiceResources(serviceSlug);
    if (cached) {
      setServiceResources((prev) =>
        prev[serviceSlug] ? prev : { ...prev, [serviceSlug]: cached },
      );
      return;
    }

    setLoadingServices((prev) => ({ ...prev, [serviceSlug]: true }));
    try {
      const items = await loadServiceResources(serviceSlug);
      setServiceResources((prev) => ({ ...prev, [serviceSlug]: items }));
    } catch {
      // Keep empty if load fails
    } finally {
      setLoadingServices((prev) => ({ ...prev, [serviceSlug]: false }));
    }
  }, []);

  const toggleCategory = useCallback((slug: string) => {
    setExpandedCategories((prev) => ({ ...prev, [slug]: !prev[slug] }));
  }, []);

  const toggleService = useCallback(
    (serviceSlug: string) => {
      setExpandedServices((prev) => {
        const nextOpen = !prev[serviceSlug];
        if (nextOpen) {
          void ensureServiceResourcesLoaded(serviceSlug);
        }
        return { ...prev, [serviceSlug]: nextOpen };
      });
    },
    [ensureServiceResourcesLoaded],
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const servicesByCategory = useMemo(() => {
    const grouped = new Map<string, AwsServiceListItemDto[]>();

    for (const service of services) {
      const loadedItems = serviceResources[service.slug];

      if (normalizedQuery) {
        const matchesService =
          service.name.toLowerCase().includes(normalizedQuery) ||
          service.shortName.toLowerCase().includes(normalizedQuery) ||
          service.slug.toLowerCase().includes(normalizedQuery) ||
          service.shortDescription.toLowerCase().includes(normalizedQuery) ||
          service.category.name.toLowerCase().includes(normalizedQuery);

        const matchesSubResource = loadedItems?.some(
          (item) =>
            item.resourceName.toLowerCase().includes(normalizedQuery) ||
            item.resourceType.toLowerCase().includes(normalizedQuery),
        );

        if (!matchesService && !matchesSubResource) {
          continue;
        }
      }

      const catSlug = service.category.slug;
      const list = grouped.get(catSlug) ?? [];
      list.push(service);
      grouped.set(catSlug, list);
    }

    return grouped;
  }, [services, serviceResources, normalizedQuery]);

  const visibleCategories = useMemo(() => {
    return categories.filter((cat) => (servicesByCategory.get(cat.slug)?.length ?? 0) > 0);
  }, [categories, servicesByCategory]);

  const filteredBoundaries = useMemo(() => {
    if (!normalizedQuery) return AWS_BOUNDARIES;
    return AWS_BOUNDARIES.filter(
      (b) =>
        b.resourceName.toLowerCase().includes(normalizedQuery) ||
        b.resourceType.toLowerCase().includes(normalizedQuery) ||
        b.description.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLElement>, item: AwsResourceRegistryItem) => {
      event.dataTransfer.setData(AWS_RESOURCE_DND_MIME, JSON.stringify(item));
      event.dataTransfer.effectAllowed = 'copy';
    },
    [],
  );

  if (isCollapsed) {
    return (
      <aside
        aria-label="AWS Resource Library (collapsed)"
        className={cn(
          'flex h-full w-11 shrink-0 flex-col items-center border-r border-border-subtle bg-surface py-3',
          className,
        )}
      >
        <button
          type="button"
          onClick={handleToggleCollapse}
          aria-label="Expand AWS Resource Library"
          title="Expand AWS Resource Library"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-elevated text-slate-300 transition-colors hover:border-sky-400/50 hover:text-sky-400"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="AWS Resource Library"
      className={cn(
        'flex h-full w-80 shrink-0 flex-col border-r border-border-subtle bg-surface text-slate-100',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-3.5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-slate-200">
            AWS Resource Library
          </h2>
          <p className="truncate text-[11px] text-slate-400">
            Drag onto canvas or click + to add
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleCollapse}
          aria-label="Collapse AWS Resource Library"
          title="Collapse sidebar"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-surface-hover hover:text-slate-100"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="border-b border-border-subtle p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search services or resources..."
            aria-label="Search AWS services or resources"
            className="w-full rounded-lg border border-border-subtle bg-canvas py-1.5 pl-8 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400/50"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
            <p className="text-xs text-slate-400">Loading AWS catalog...</p>
          </div>
        ) : error ? (
          <div className="m-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-center">
            <AlertCircle className="mx-auto h-5 w-5 text-rose-400" />
            <p className="mt-2 text-xs font-medium text-rose-200">
              Unable to load AWS catalog
            </p>
            <p className="mt-1 text-[11px] text-rose-300/80">{error}</p>
            <button
              type="button"
              onClick={() => void fetchCatalog()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-rose-400/30 bg-rose-500/20 px-2.5 py-1 text-xs font-medium text-rose-100 transition-colors hover:bg-rose-500/30"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* AWS Network Boundaries Section */}
            {filteredBoundaries.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-purple-500/30 bg-purple-950/10">
                <button
                  type="button"
                  onClick={() => setIsBoundariesExpanded((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors hover:bg-purple-900/20"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {isBoundariesExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-purple-300" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-purple-300" />
                    )}
                    <Layers className="h-3.5 w-3.5 text-purple-400" />
                    <span className="truncate text-xs font-bold tracking-wide text-purple-200">
                      AWS Network Boundaries
                    </span>
                  </div>
                  <span className="shrink-0 rounded bg-purple-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-purple-300">
                    CONTAINERS
                  </span>
                </button>

                {isBoundariesExpanded && (
                  <div className="space-y-1.5 border-t border-purple-500/20 bg-canvas/30 p-2">
                    {filteredBoundaries.map((item) => (
                      <div
                        key={item.key}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        className="group flex cursor-grab items-start gap-2 rounded-md border border-purple-500/20 bg-surface-elevated/70 p-2 transition-colors hover:border-purple-400/50 hover:bg-purple-950/30 active:cursor-grabbing"
                      >
                        <GripVertical
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-purple-300"
                          aria-hidden="true"
                        />
                        <AwsServiceIcon
                          serviceSlug={item.serviceSlug}
                          resourceType={item.resourceType}
                          iconKey={item.iconKey}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-semibold text-slate-100">
                              {item.resourceName}
                            </p>
                            <button
                              type="button"
                              onClick={() => onAddResource(item)}
                              aria-label={`Add ${item.resourceName} boundary`}
                              title={`Add ${item.resourceName}`}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-purple-500/40 bg-purple-950/40 text-purple-200 transition-colors hover:border-purple-300 hover:text-white"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-400">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Standard AWS Services Catalog */}
            {visibleCategories.length === 0 && filteredBoundaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <SearchX className="h-6 w-6 text-slate-500" />
                <p className="text-xs font-medium text-slate-300">
                  No matching AWS resources
                </p>
                <p className="text-[11px] text-slate-500">
                  Try a different service name, resource type, or category.
                </p>
              </div>
            ) : (
              visibleCategories.map((category) => {
                const catServices = servicesByCategory.get(category.slug) ?? [];
                const isCategoryExpanded =
                  Boolean(normalizedQuery) || Boolean(expandedCategories[category.slug]);
                const accent = getCategoryAccent(category.slug);

                return (
                  <div
                    key={category.id}
                    className="overflow-hidden rounded-lg border border-border-subtle bg-surface-elevated/40"
                  >
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.slug)}
                      aria-expanded={isCategoryExpanded}
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {isCategoryExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        )}
                        <span
                          className={cn('h-2 w-2 shrink-0 rounded-full', accent.barClassName)}
                          aria-hidden="true"
                        />
                        <span className="truncate text-xs font-semibold text-slate-200">
                          {category.name}
                        </span>
                      </div>
                      <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                        {catServices.length}
                      </span>
                    </button>

                    {isCategoryExpanded ? (
                      <div className="space-y-1.5 border-t border-border-subtle bg-canvas/30 p-1.5">
                        {catServices.map((service) => {
                          const isServiceExpanded =
                            Boolean(normalizedQuery) || Boolean(expandedServices[service.slug]);
                          const loadedResources = serviceResources[service.slug];
                          const isLoadingSubResources = Boolean(loadingServices[service.slug]);

                          return (
                            <div
                              key={service.id}
                              className="overflow-hidden rounded-md border border-border-subtle/80 bg-surface/70"
                            >
                              <div className="flex items-center justify-between gap-1.5 p-2">
                                <button
                                  type="button"
                                  onClick={() => toggleService(service.slug)}
                                  aria-expanded={isServiceExpanded}
                                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                >
                                  {isServiceExpanded ? (
                                    <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
                                  )}
                                  <AwsServiceIcon
                                    serviceSlug={service.slug}
                                    iconKey={service.iconKey}
                                    categoryIconKey={service.category.slug}
                                    size="sm"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium text-slate-100">
                                      {service.name}
                                    </p>
                                    <p className="truncate font-mono text-[10px] text-slate-400">
                                      {service.shortName}
                                    </p>
                                  </div>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onAddResource(mapServiceListItemToPrimaryRegistryItem(service))
                                  }
                                  aria-label={`Add ${service.name} to canvas`}
                                  title={`Add ${service.name}`}
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border-subtle bg-surface-elevated text-slate-300 transition-colors hover:border-sky-400 hover:text-sky-400"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {isServiceExpanded ? (
                                <div className="space-y-1.5 border-t border-border-subtle/60 bg-canvas/60 p-2">
                                  {isLoadingSubResources ? (
                                    <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-slate-400">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                                      <span>Loading service resource types...</span>
                                    </div>
                                  ) : !loadedResources || loadedResources.length === 0 ? (
                                    <p className="py-1 text-center text-[11px] text-slate-500">
                                      Primary resource only
                                    </p>
                                  ) : (
                                    loadedResources.map((item) => (
                                      <div
                                        key={item.key}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item)}
                                        className="group flex cursor-grab items-start gap-2 rounded-md border border-border-subtle/70 bg-surface-elevated/70 p-2 transition-colors hover:border-sky-400/50 hover:bg-surface-hover active:cursor-grabbing"
                                      >
                                        <GripVertical
                                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-slate-300"
                                          aria-hidden="true"
                                        />
                                        <AwsServiceIcon
                                          serviceSlug={item.serviceSlug}
                                          resourceType={item.resourceType}
                                          iconKey={item.iconKey}
                                          categoryIconKey={item.categoryIconKey}
                                          size="sm"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-1">
                                            <p className="truncate text-xs font-medium text-slate-100">
                                              {item.resourceName}
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() => onAddResource(item)}
                                              aria-label={`Add ${item.resourceName} to canvas`}
                                              title={`Add ${item.resourceName}`}
                                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border-subtle bg-surface text-slate-300 transition-colors hover:border-sky-400 hover:text-sky-400"
                                            >
                                              <Plus className="h-3 w-3" />
                                            </button>
                                          </div>
                                          <span className="mt-0.5 inline-block max-w-full truncate rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                                            {item.resourceType}
                                          </span>
                                          {item.description ? (
                                            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">
                                              {item.description}
                                            </p>
                                          ) : null}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
