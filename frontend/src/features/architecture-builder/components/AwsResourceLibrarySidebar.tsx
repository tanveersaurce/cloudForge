import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GripVertical,
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
      // Fall back to primary service item if detail fetch fails
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
          service.category.name.toLowerCase().includes(normalizedQuery) ||
          service.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

        const matchesLoadedResource = loadedItems?.some(
          (item) =>
            item.resourceName.toLowerCase().includes(normalizedQuery) ||
            item.resourceType.toLowerCase().includes(normalizedQuery) ||
            item.description.toLowerCase().includes(normalizedQuery),
        );

        if (!matchesService && !matchesLoadedResource) {
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
        ) : visibleCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <SearchX className="h-6 w-6 text-slate-500" />
            <p className="text-xs font-medium text-slate-300">
              No matching AWS resources
            </p>
            <p className="text-[11px] text-slate-500">
              Try a different service name, resource type, or category.
            </p>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-1 rounded-md border border-border-subtle bg-surface-elevated px-2.5 py-1 text-xs text-sky-400 hover:border-sky-400/50"
              >
                Clear search
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1.5">
            {visibleCategories.map((category) => {
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
                    <div className="space-y-1 border-t border-border-subtle/70 bg-canvas/40 p-1.5">
                      {catServices.map((service) => {
                        const isServiceExpanded = Boolean(expandedServices[service.slug]);
                        const isLoadingDetail = Boolean(loadingServices[service.slug]);
                        const primaryItem = mapServiceListItemToPrimaryRegistryItem(service);
                        const loadedItems = serviceResources[service.slug];
                        const itemsToRender = loadedItems ?? [primaryItem];

                        return (
                          <div
                            key={service.id}
                            className="rounded-md border border-border-subtle/60 bg-surface/80"
                          >
                            {/* Service Row */}
                            <div className="flex items-center gap-1.5 px-2 py-1.5">
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
                                  iconKey={service.iconKey}
                                  categoryIconKey={service.category.iconKey}
                                  size="sm"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-slate-200">
                                    {service.shortName || service.name}
                                  </p>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => onAddResource(primaryItem)}
                                aria-label={`Add ${primaryItem.resourceName} to canvas`}
                                title={`Quick add ${primaryItem.resourceName}`}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border-subtle bg-surface-elevated text-slate-300 transition-colors hover:border-sky-400/60 hover:text-sky-400"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Expanded Common Resources */}
                            {isServiceExpanded ? (
                              <div className="space-y-1 border-t border-border-subtle/60 p-1.5">
                                {isLoadingDetail ? (
                                  <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-slate-400">
                                    <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
                                    <span>Loading resources...</span>
                                  </div>
                                ) : (
                                  itemsToRender.map((item) => (
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
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
