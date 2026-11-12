import {
  fetchAwsCategories,
  fetchAwsServiceBySlug,
  fetchAwsServices,
} from '@/features/aws-services/services/awsCatalogService';
import type {
  AwsCategoryDto,
  AwsResourceDefinition,
  AwsServiceDetailDto,
  AwsServiceListItemDto,
} from '@/features/aws-services/types/awsService.types';
import type {
  AwsResourceNodeData,
  AwsResourceRegistryItem,
} from '../types/architecture.types';

export const AWS_RESOURCE_DND_MIME = 'application/cloudforge-aws-resource';

export interface CategoryAccentTheme {
  barClassName: string;
  borderClassName: string;
  badgeClassName: string;
  textClassName: string;
}

const DEFAULT_ACCENT: CategoryAccentTheme = {
  barClassName: 'bg-sky-400',
  borderClassName: 'border-sky-500/30',
  badgeClassName: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  textClassName: 'text-sky-300',
};

const CATEGORY_ACCENTS: Record<string, CategoryAccentTheme> = {
  compute: {
    barClassName: 'bg-amber-400',
    borderClassName: 'border-amber-500/30',
    badgeClassName: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    textClassName: 'text-amber-300',
  },
  storage: {
    barClassName: 'bg-emerald-400',
    borderClassName: 'border-emerald-500/30',
    badgeClassName: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    textClassName: 'text-emerald-300',
  },
  networking: {
    barClassName: 'bg-sky-400',
    borderClassName: 'border-sky-500/30',
    badgeClassName: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
    textClassName: 'text-sky-300',
  },
  database: {
    barClassName: 'bg-indigo-400',
    borderClassName: 'border-indigo-500/30',
    badgeClassName: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300',
    textClassName: 'text-indigo-300',
  },
  security: {
    barClassName: 'bg-rose-400',
    borderClassName: 'border-rose-500/30',
    badgeClassName: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
    textClassName: 'text-rose-300',
  },
  containers: {
    barClassName: 'bg-cyan-400',
    borderClassName: 'border-cyan-500/30',
    badgeClassName: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300',
    textClassName: 'text-cyan-300',
  },
  serverless: {
    barClassName: 'bg-orange-400',
    borderClassName: 'border-orange-500/30',
    badgeClassName: 'border-orange-500/25 bg-orange-500/10 text-orange-300',
    textClassName: 'text-orange-300',
  },
  integration: {
    barClassName: 'bg-fuchsia-400',
    borderClassName: 'border-fuchsia-500/30',
    badgeClassName: 'border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-300',
    textClassName: 'text-fuchsia-300',
  },
  management: {
    barClassName: 'bg-teal-400',
    borderClassName: 'border-teal-500/30',
    badgeClassName: 'border-teal-500/25 bg-teal-500/10 text-teal-300',
    textClassName: 'text-teal-300',
  },
  'developer-tools': {
    barClassName: 'bg-violet-400',
    borderClassName: 'border-violet-500/30',
    badgeClassName: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
    textClassName: 'text-violet-300',
  },
  analytics: {
    barClassName: 'bg-blue-400',
    borderClassName: 'border-blue-500/30',
    badgeClassName: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
    textClassName: 'text-blue-300',
  },
  'ml-ai': {
    barClassName: 'bg-purple-400',
    borderClassName: 'border-purple-500/30',
    badgeClassName: 'border-purple-500/25 bg-purple-500/10 text-purple-300',
    textClassName: 'text-purple-300',
  },
  migration: {
    barClassName: 'bg-lime-400',
    borderClassName: 'border-lime-500/30',
    badgeClassName: 'border-lime-500/25 bg-lime-500/10 text-lime-300',
    textClassName: 'text-lime-300',
  },
  iot: {
    barClassName: 'bg-cyan-400',
    borderClassName: 'border-cyan-500/30',
    badgeClassName: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300',
    textClassName: 'text-cyan-300',
  },
  media: {
    barClassName: 'bg-pink-400',
    borderClassName: 'border-pink-500/30',
    badgeClassName: 'border-pink-500/25 bg-pink-500/10 text-pink-300',
    textClassName: 'text-pink-300',
  },
  business: {
    barClassName: 'bg-slate-400',
    borderClassName: 'border-slate-500/30',
    badgeClassName: 'border-slate-500/25 bg-slate-500/10 text-slate-300',
    textClassName: 'text-slate-300',
  },
};

export function getCategoryAccent(categorySlug: string): CategoryAccentTheme {
  return CATEGORY_ACCENTS[categorySlug] ?? DEFAULT_ACCENT;
}

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function deriveFallbackResourceType(service: AwsServiceListItemDto): string {
  return `aws_${service.slug.replace(/-/g, '_')}`;
}

export function mapServiceListItemToPrimaryRegistryItem(
  service: AwsServiceListItemDto,
): AwsResourceRegistryItem {
  const resourceType = deriveFallbackResourceType(service);
  return {
    key: `${service.slug}::primary`,
    serviceId: service.id,
    serviceSlug: service.slug,
    serviceName: service.name,
    shortName: service.shortName,
    categorySlug: service.category.slug,
    categoryName: service.category.name,
    categoryIconKey: service.category.iconKey,
    iconKey: service.iconKey,
    resourceName: service.shortName || service.name,
    resourceType,
    description: service.shortDescription,
  };
}

function mapCommonResourceToRegistryItem(
  detail: AwsServiceDetailDto,
  resource: AwsResourceDefinition,
  index: number,
): AwsResourceRegistryItem {
  const resourceType =
    resource.terraformResourceType?.trim() ||
    detail.terraformResourceTypes[index] ||
    deriveFallbackResourceType(detail);
  const keySuffix =
    resource.terraformResourceType?.trim() || slugifySegment(resource.name) || String(index);

  return {
    key: `${detail.slug}::${keySuffix}`,
    serviceId: detail.id,
    serviceSlug: detail.slug,
    serviceName: detail.name,
    shortName: detail.shortName,
    categorySlug: detail.category.slug,
    categoryName: detail.category.name,
    categoryIconKey: detail.category.iconKey,
    iconKey: detail.iconKey,
    resourceName: resource.name,
    resourceType,
    description: resource.description || detail.shortDescription,
  };
}

export function mapServiceDetailToRegistryItems(
  detail: AwsServiceDetailDto,
): AwsResourceRegistryItem[] {
  const resources = Array.isArray(detail.commonResources) ? detail.commonResources : [];
  if (resources.length === 0) {
    return [mapServiceListItemToPrimaryRegistryItem(detail)];
  }
  return resources.map((resource, index) =>
    mapCommonResourceToRegistryItem(detail, resource, index),
  );
}

export function buildNodeDataFromRegistryItem(
  item: AwsResourceRegistryItem,
): AwsResourceNodeData {
  return {
    serviceId: item.serviceId,
    serviceSlug: item.serviceSlug,
    serviceName: item.serviceName,
    categorySlug: item.categorySlug,
    categoryName: item.categoryName,
    iconKey: item.iconKey,
    resourceName: item.resourceName,
    resourceType: item.resourceType,
    label: item.resourceName || item.shortName || item.serviceName,
    description: item.description,
    metadata: {},
  };
}

export interface AwsCatalogIndex {
  categories: AwsCategoryDto[];
  services: AwsServiceListItemDto[];
}

export async function loadAwsCatalogIndex(): Promise<AwsCatalogIndex> {
  const [categories, firstPage] = await Promise.all([
    fetchAwsCategories(),
    fetchAwsServices({ page: 1, limit: 100, sort: 'name_asc' }),
  ]);

  const allServices = [...firstPage.items];
  const totalPages = firstPage.pagination.totalPages;

  if (totalPages > 1) {
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) =>
      fetchAwsServices({ page: i + 2, limit: 100, sort: 'name_asc' }),
    );
    const pages = await Promise.all(remainingPages);
    for (const page of pages) {
      allServices.push(...page.items);
    }
  }

  return {
    categories,
    services: allServices,
  };
}

const serviceResourceCache = new Map<string, AwsResourceRegistryItem[]>();
const inFlightResourceRequests = new Map<string, Promise<AwsResourceRegistryItem[]>>();

export function getCachedServiceResources(
  serviceSlug: string,
): AwsResourceRegistryItem[] | undefined {
  return serviceResourceCache.get(serviceSlug);
}

export async function loadServiceResources(
  serviceSlug: string,
): Promise<AwsResourceRegistryItem[]> {
  const cached = serviceResourceCache.get(serviceSlug);
  if (cached) {
    return cached;
  }

  const existingRequest = inFlightResourceRequests.get(serviceSlug);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetchAwsServiceBySlug(serviceSlug)
    .then((detail) => {
      const items = mapServiceDetailToRegistryItems(detail);
      serviceResourceCache.set(serviceSlug, items);
      return items;
    })
    .finally(() => {
      inFlightResourceRequests.delete(serviceSlug);
    });

  inFlightResourceRequests.set(serviceSlug, request);
  return request;
}
