import { apiFetch } from '@/services/apiClient';
import type { ApiSuccessResponse } from '@/types/api';
import type {
  AwsCategoryDto,
  AwsServiceDetailDto,
  AwsServiceListItemDto,
  ListServicesParams,
  PaginatedServicesResponse,
  RecentlyExploredServiceDto,
} from '../types/awsService.types';

function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) {
      continue;
    }
    search.set(key, String(value));
  }

  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export async function fetchAwsCategories(): Promise<AwsCategoryDto[]> {
  const res = await apiFetch<ApiSuccessResponse<{ categories: AwsCategoryDto[] }>>(
    '/aws/categories',
  );
  return res.data.categories;
}

export async function fetchAwsServices(
  params: ListServicesParams = {},
): Promise<PaginatedServicesResponse<AwsServiceListItemDto>> {
  const qs = buildQueryString({
    page: params.page ?? 1,
    limit: params.limit ?? 12,
    q: params.q?.trim() || undefined,
    category: params.category && params.category !== 'all' ? params.category : undefined,
    terraformSupport: params.terraformSupport || undefined,
    supportLevel: params.supportLevel || undefined,
    sort: params.sort ?? 'name_asc',
    favoritesOnly: params.favoritesOnly ? 'true' : undefined,
  });

  const endpoint = params.q?.trim() ? `/aws/services/search${qs}` : `/aws/services${qs}`;
  const res = await apiFetch<ApiSuccessResponse<PaginatedServicesResponse<AwsServiceListItemDto>>>(
    endpoint,
  );
  return res.data;
}

export async function fetchAwsServiceBySlug(slug: string): Promise<AwsServiceDetailDto> {
  const res = await apiFetch<ApiSuccessResponse<{ service: AwsServiceDetailDto }>>(
    `/aws/services/${encodeURIComponent(slug)}`,
  );
  return res.data.service;
}

export async function fetchFavoriteServices(
  page = 1,
  limit = 12,
): Promise<PaginatedServicesResponse<AwsServiceListItemDto>> {
  const qs = buildQueryString({ page, limit });
  const res = await apiFetch<ApiSuccessResponse<PaginatedServicesResponse<AwsServiceListItemDto>>>(
    `/aws/services/favorites${qs}`,
  );
  return res.data;
}

export async function addFavoriteService(
  serviceId: string,
): Promise<{ serviceId: string; isFavorite: true }> {
  const res = await apiFetch<ApiSuccessResponse<{ serviceId: string; isFavorite: true }>>(
    `/aws/services/${encodeURIComponent(serviceId)}/favorite`,
    { method: 'POST' },
  );
  return res.data;
}

export async function removeFavoriteService(
  serviceId: string,
): Promise<{ serviceId: string; isFavorite: false }> {
  const res = await apiFetch<ApiSuccessResponse<{ serviceId: string; isFavorite: false }>>(
    `/aws/services/${encodeURIComponent(serviceId)}/favorite`,
    { method: 'DELETE' },
  );
  return res.data;
}

export async function fetchRecentServices(
  page = 1,
  limit = 12,
): Promise<PaginatedServicesResponse<RecentlyExploredServiceDto>> {
  const qs = buildQueryString({ page, limit });
  const res = await apiFetch<
    ApiSuccessResponse<PaginatedServicesResponse<RecentlyExploredServiceDto>>
  >(`/aws/services/recent${qs}`);
  return res.data;
}

export async function recordServiceExploration(
  serviceId: string,
): Promise<{ serviceId: string; viewCount: number; lastExploredAt: string }> {
  const res = await apiFetch<
    ApiSuccessResponse<{ serviceId: string; viewCount: number; lastExploredAt: string }>
  >(`/aws/services/${encodeURIComponent(serviceId)}/explore`, {
    method: 'POST',
  });
  return res.data;
}
