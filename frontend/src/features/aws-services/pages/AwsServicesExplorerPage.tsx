import { AlertTriangle, ChevronLeft, ChevronRight, Cloud, RefreshCw, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ApiClientError } from '@/services/apiClient';
import {
  ExplorerFiltersBar,
} from '../components/ExplorerFiltersBar';
import { ExplorerSidebar, type ExplorerViewMode } from '../components/ExplorerSidebar';
import { ServiceCard } from '../components/ServiceCard';
import {
  addFavoriteService,
  fetchAwsCategories,
  fetchAwsServices,
  fetchFavoriteServices,
  fetchRecentServices,
  removeFavoriteService,
} from '../services/awsCatalogService';
import type {
  AwsCategoryDto,
  AwsServiceListItemDto,
  AwsSupportLevel,
  PaginationMeta,
  RecentlyExploredServiceDto,
  ServiceSortOption,
  TerraformSupportStatus,
} from '../types/awsService.types';

const PAGE_LIMIT = 12;

export function AwsServicesExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCategory = searchParams.get('category') || 'all';
  const initialViewParam = searchParams.get('view');
  const initialView: ExplorerViewMode =
    initialViewParam === 'favorites' || initialViewParam === 'recent'
      ? initialViewParam
      : 'catalog';
  const initialQ = searchParams.get('q') || '';

  const [categories, setCategories] = useState<AwsCategoryDto[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ExplorerViewMode>(initialView);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchInput, setSearchInput] = useState<string>(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState<string>(initialQ);
  const [terraformSupport, setTerraformSupport] = useState<TerraformSupportStatus | ''>('');
  const [supportLevel, setSupportLevel] = useState<AwsSupportLevel | ''>('');
  const [sort, setSort] = useState<ServiceSortOption>('name_asc');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  const [services, setServices] = useState<
    Array<AwsServiceListItemDto | RecentlyExploredServiceDto>
  >([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mutatingFavoriteIds, setMutatingFavoriteIds] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 200);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (viewMode !== 'catalog') {
      next.set('view', viewMode);
    } else {
      if (selectedCategory !== 'all') next.set('category', selectedCategory);
      if (debouncedQuery) next.set('q', debouncedQuery);
    }
    setSearchParams(next, { replace: true });
  }, [viewMode, selectedCategory, debouncedQuery, setSearchParams]);

  const loadCategories = useCallback(async () => {
    setCategoriesError(null);
    try {
      const list = await fetchAwsCategories();
      setCategories(list);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Unable to load AWS service categories.';
      setCategoriesError(message);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (viewMode === 'favorites') {
        const res = await fetchFavoriteServices(page, PAGE_LIMIT);
        setServices(res.items);
        setPagination(res.pagination);
        return;
      }

      if (viewMode === 'recent') {
        const res = await fetchRecentServices(page, PAGE_LIMIT);
        setServices(res.items);
        setPagination(res.pagination);
        return;
      }

      const res = await fetchAwsServices({
        page,
        limit: PAGE_LIMIT,
        q: debouncedQuery || undefined,
        category: selectedCategory,
        terraformSupport,
        supportLevel,
        sort,
        favoritesOnly,
      });
      setServices(res.items);
      setPagination(res.pagination);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Unable to load AWS services catalog.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [
    viewMode,
    page,
    debouncedQuery,
    selectedCategory,
    terraformSupport,
    supportLevel,
    sort,
    favoritesOnly,
  ]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const totalCatalogCount = useMemo(
    () => categories.reduce((sum, item) => sum + item.serviceCount, 0),
    [categories],
  );

  const activeCategoryObj = useMemo(
    () => categories.find((cat) => cat.slug === selectedCategory) ?? null,
    [categories, selectedCategory],
  );

  const hasActiveFilters = Boolean(
    debouncedQuery ||
      selectedCategory !== 'all' ||
      terraformSupport ||
      supportLevel ||
      favoritesOnly ||
      sort !== 'name_asc',
  );

  const handleClearFilters = () => {
    setViewMode('catalog');
    setSelectedCategory('all');
    setSearchInput('');
    setDebouncedQuery('');
    setTerraformSupport('');
    setSupportLevel('');
    setSort('name_asc');
    setFavoritesOnly(false);
    setPage(1);
  };

  const handleSelectCategory = (slug: string) => {
    setSelectedCategory(slug);
    setPage(1);
  };

  const handleSelectViewMode = (mode: ExplorerViewMode) => {
    setViewMode(mode);
    setPage(1);
  };

  const handleToggleFavorite = async (service: AwsServiceListItemDto) => {
    setActionError(null);
    const nextFavorite = !service.isFavorite;
    setMutatingFavoriteIds((prev) => ({ ...prev, [service.id]: true }));

    try {
      if (nextFavorite) {
        await addFavoriteService(service.id);
      } else {
        await removeFavoriteService(service.id);
      }

      setServices((prev) => {
        const updated = prev.map((item) =>
          item.id === service.id ? { ...item, isFavorite: nextFavorite } : item,
        );
        if (!nextFavorite && (viewMode === 'favorites' || favoritesOnly)) {
          return updated.filter((item) => item.id !== service.id);
        }
        return updated;
      });
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Could not update favorite service status.';
      setActionError(message);
    } finally {
      setMutatingFavoriteIds((prev) => {
        const copy = { ...prev };
        delete copy[service.id];
        return copy;
      });
    }
  };

  const headerTitle =
    viewMode === 'favorites'
      ? 'Favorite AWS Services'
      : viewMode === 'recent'
        ? 'Recently Explored Services'
        : activeCategoryObj
          ? activeCategoryObj.name
          : 'AWS Services Explorer';

  const headerSubtitle =
    viewMode === 'favorites'
      ? 'Bookmarked services pinned to your personal CloudForge workspace.'
      : viewMode === 'recent'
        ? 'Services you have inspected recently, ordered by latest visit.'
        : activeCategoryObj
          ? activeCategoryObj.description
          : 'Explore verified AWS services, resource distinctions, configuration defaults, and Terraform provider readiness.';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">{headerTitle}</h1>
            <Badge variant="info">Phase 03 Catalog</Badge>
            {totalCatalogCount > 0 ? (
              <Badge variant="muted">{totalCatalogCount} Services</Badge>
            ) : null}
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">{headerSubtitle}</p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void loadCategories();
            void loadServices();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {categoriesError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
          <span>{categoriesError}</span>
          <Button variant="ghost" size="sm" onClick={() => void loadCategories()}>
            Retry
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
          {actionError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ExplorerSidebar
            categories={categories}
            totalCatalogCount={totalCatalogCount}
            selectedCategory={selectedCategory}
            viewMode={viewMode}
            onSelectCategory={handleSelectCategory}
            onSelectViewMode={handleSelectViewMode}
          />
        </div>

        <div className="min-w-0 space-y-4">
          {viewMode === 'catalog' ? (
            <ExplorerFiltersBar
              searchInput={searchInput}
              onSearchInputChange={(value) => {
                setSearchInput(value);
                setPage(1);
              }}
              terraformSupport={terraformSupport}
              onTerraformSupportChange={(value) => {
                setTerraformSupport(value);
                setPage(1);
              }}
              supportLevel={supportLevel}
              onSupportLevelChange={(value) => {
                setSupportLevel(value);
                setPage(1);
              }}
              sort={sort}
              onSortChange={(value) => {
                setSort(value);
                setPage(1);
              }}
              favoritesOnly={favoritesOnly}
              onFavoritesOnlyChange={(value) => {
                setFavoritesOnly(value);
                setPage(1);
              }}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
            />
          ) : null}

          {!isLoading && !error ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>
                Showing <span className="font-medium text-slate-200">{services.length}</span> of{' '}
                <span className="font-medium text-slate-200">{pagination.total}</span>{' '}
                {pagination.total === 1 ? 'service' : 'services'}
              </span>
              {pagination.totalPages > 1 ? (
                <span className="font-mono text-[11px] text-slate-500">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
              ) : null}
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-56 animate-pulse rounded-xl border border-border-subtle bg-surface/60 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-2/3 rounded bg-slate-800" />
                      <div className="h-2.5 w-1/3 rounded bg-slate-800" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full rounded bg-slate-800/80" />
                    <div className="h-3 w-5/6 rounded bg-slate-800/80" />
                    <div className="h-3 w-2/3 rounded bg-slate-800/80" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-rose-500/30 bg-surface/90 px-6 py-12 text-center">
              <AlertTriangle className="h-7 w-7 text-rose-400" />
              <h2 className="mt-3 text-sm font-semibold text-slate-100">
                Unable to load AWS services
              </h2>
              <p className="mt-1 max-w-md text-xs text-slate-400">{error}</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => void loadServices()}>
                Retry Request
              </Button>
            </div>
          ) : services.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-surface/90 px-6 py-14 text-center">
              <div className="rounded-xl border border-border-subtle bg-canvas p-3 text-slate-400">
                {viewMode === 'favorites' ? (
                  <Star className="h-6 w-6 text-amber-400" />
                ) : (
                  <Cloud className="h-6 w-6 text-sky-400" />
                )}
              </div>
              <h2 className="mt-3 text-sm font-semibold text-slate-100">
                {viewMode === 'favorites'
                  ? 'No favorite services saved yet'
                  : viewMode === 'recent'
                    ? 'No explored services recorded yet'
                    : 'No matching AWS services found'}
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                {viewMode === 'favorites'
                  ? 'Star any service card or detail page to bookmark it for quick access.'
                  : viewMode === 'recent'
                    ? 'Open any AWS service detail page to start building your exploration history.'
                    : 'Try adjusting your search keywords, category selection, or Terraform filters.'}
              </p>
              {viewMode === 'catalog' && hasActiveFilters ? (
                <Button variant="secondary" size="sm" className="mt-4" onClick={handleClearFilters}>
                  Clear all filters
                </Button>
              ) : viewMode !== 'catalog' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={() => handleSelectViewMode('catalog')}
                >
                  Browse Full Catalog
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {services.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onToggleFavorite={(target) => void handleToggleFavorite(target)}
                    isFavoriteMutating={Boolean(mutatingFavoriteIds[service.id])}
                    exploredMeta={
                      'viewCount' in service
                        ? {
                            viewCount: service.viewCount,
                            lastExploredAt: service.lastExploredAt,
                          }
                        : undefined
                    }
                  />
                ))}
              </div>

              {pagination.totalPages > 1 ? (
                <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface/90 px-4 py-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </Button>

                  <span className="text-xs text-slate-400">
                    Page <span className="font-semibold text-slate-100">{pagination.page}</span> of{' '}
                    <span className="font-semibold text-slate-100">{pagination.totalPages}</span>
                  </span>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
