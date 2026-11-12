import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import type { ListServicesQuery, PaginationQuery } from './aws.validation.js';

export interface AwsCategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  sortOrder: number;
  serviceCount: number;
}

export interface AwsServiceListItemDto {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  officialServiceName: string;
  shortDescription: string;
  iconKey: string;
  terraformSupport: string;
  terraformProviderAvailable: boolean;
  supportLevel: string;
  tags: string[];
  category: {
    id: string;
    slug: string;
    name: string;
    iconKey: string;
  };
  isFavorite: boolean;
}

export interface AwsServiceDetailDto extends AwsServiceListItemDto {
  detailedDescription: string;
  awsConsoleUrl: string;
  officialDocumentationUrl: string;
  primaryUseCases: string[];
  keyFeatures: string[];
  pricingModel: string;
  supportedRegions: string;
  commonResources: Prisma.JsonValue;
  configurationSchema: Prisma.JsonValue;
  terraformCloudForgeStatusNote: string;
  terraformResourceTypes: string[];
  terraformDocsUrl: string | null;
  relatedServices: AwsServiceListItemDto[];
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const SERVICE_CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortName: true,
  officialServiceName: true,
  shortDescription: true,
  iconKey: true,
  terraformSupport: true,
  terraformProviderAvailable: true,
  supportLevel: true,
  tags: true,
  category: {
    select: {
      id: true,
      slug: true,
      name: true,
      iconKey: true,
    },
  },
} as const;

async function getUserFavoriteServiceIdSet(
  userId: string | undefined,
  serviceIds: string[],
): Promise<Set<string>> {
  if (!userId || serviceIds.length === 0) {
    return new Set();
  }

  const rows = await prisma.userFavoriteService.findMany({
    where: {
      userId,
      serviceId: { in: serviceIds },
    },
    select: { serviceId: true },
  });

  return new Set(rows.map((r) => r.serviceId));
}

export async function listAwsCategories(): Promise<AwsCategoryDto[]> {
  const categories = await prisma.awsCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: { services: true },
      },
    },
  });

  return categories.map((cat) => ({
    id: cat.id,
    slug: cat.slug,
    name: cat.name,
    description: cat.description,
    iconKey: cat.iconKey,
    sortOrder: cat.sortOrder,
    serviceCount: cat._count.services,
  }));
}

export async function listAwsServices(
  query: ListServicesQuery,
  userId?: string,
): Promise<PaginatedResult<AwsServiceListItemDto> & { appliedFilters: Omit<ListServicesQuery, 'page' | 'limit'> }> {
  const where: Prisma.AwsServiceWhereInput = {};

  if (query.category) {
    where.category = { slug: query.category };
  }

  if (query.terraformSupport) {
    where.terraformSupport = query.terraformSupport;
  }

  if (query.supportLevel) {
    where.supportLevel = query.supportLevel;
  }

  if (query.favoritesOnly) {
    if (!userId) {
      throw ApiError.unauthorized('Authentication required to filter favorite services');
    }
    where.favoritedBy = { some: { userId } };
  }

  if (query.q) {
    const term = query.q;
    const lowerTerm = term.toLowerCase();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { shortName: { contains: term, mode: 'insensitive' } },
      { officialServiceName: { contains: term, mode: 'insensitive' } },
      { shortDescription: { contains: term, mode: 'insensitive' } },
      { detailedDescription: { contains: term, mode: 'insensitive' } },
      { tags: { has: lowerTerm } },
    ];
  }

  const orderBy: Prisma.AwsServiceOrderByWithRelationInput[] =
    query.sort === 'name_desc'
      ? [{ name: 'desc' }]
      : query.sort === 'category'
        ? [{ category: { sortOrder: 'asc' } }, { name: 'asc' }]
        : [{ name: 'asc' }];

  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await Promise.all([
    prisma.awsService.count({ where }),
    prisma.awsService.findMany({
      where,
      orderBy,
      skip,
      take: query.limit,
      select: SERVICE_CARD_SELECT,
    }),
  ]);

  const favoriteIds = await getUserFavoriteServiceIdSet(
    userId,
    rows.map((r) => r.id),
  );

  const items: AwsServiceListItemDto[] = rows.map((row) => ({
    ...row,
    isFavorite: favoriteIds.has(row.id),
  }));

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
    appliedFilters: {
      q: query.q,
      category: query.category,
      terraformSupport: query.terraformSupport,
      supportLevel: query.supportLevel,
      sort: query.sort,
      favoritesOnly: query.favoritesOnly,
    },
  };
}

export async function getAwsServiceBySlug(
  slug: string,
  userId?: string,
): Promise<AwsServiceDetailDto> {
  const service = await prisma.awsService.findUnique({
    where: { slug },
    include: {
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
          iconKey: true,
        },
      },
    },
  });

  if (!service) {
    throw ApiError.notFound(`AWS service "${slug}" was not found`);
  }

  const relatedRows =
    service.relatedServiceSlugs.length > 0
      ? await prisma.awsService.findMany({
          where: { slug: { in: service.relatedServiceSlugs } },
          select: SERVICE_CARD_SELECT,
        })
      : [];

  const favoriteIds = await getUserFavoriteServiceIdSet(userId, [
    service.id,
    ...relatedRows.map((r) => r.id),
  ]);

  const relatedServices: AwsServiceListItemDto[] = relatedRows.map((row) => ({
    ...row,
    isFavorite: favoriteIds.has(row.id),
  }));

  return {
    id: service.id,
    slug: service.slug,
    name: service.name,
    shortName: service.shortName,
    officialServiceName: service.officialServiceName,
    shortDescription: service.shortDescription,
    detailedDescription: service.detailedDescription,
    iconKey: service.iconKey,
    awsConsoleUrl: service.awsConsoleUrl,
    officialDocumentationUrl: service.officialDocumentationUrl,
    primaryUseCases: service.primaryUseCases,
    keyFeatures: service.keyFeatures,
    pricingModel: service.pricingModel,
    supportedRegions: service.supportedRegions,
    commonResources: service.commonResources,
    configurationSchema: service.configurationSchema,
    terraformSupport: service.terraformSupport,
    terraformProviderAvailable: service.terraformProviderAvailable,
    terraformCloudForgeStatusNote: service.terraformCloudForgeStatusNote,
    terraformResourceTypes: service.terraformResourceTypes,
    terraformDocsUrl: service.terraformDocsUrl,
    supportLevel: service.supportLevel,
    tags: service.tags,
    category: service.category,
    isFavorite: favoriteIds.has(service.id),
    relatedServices,
  };
}

export async function listUserFavoriteServices(
  userId: string,
  pagination: PaginationQuery,
): Promise<PaginatedResult<AwsServiceListItemDto>> {
  const skip = (pagination.page - 1) * pagination.limit;

  const [total, rows] = await Promise.all([
    prisma.userFavoriteService.count({ where: { userId } }),
    prisma.userFavoriteService.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pagination.limit,
      select: {
        service: {
          select: SERVICE_CARD_SELECT,
        },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      ...row.service,
      isFavorite: true,
    })),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    },
  };
}

export async function addFavoriteService(
  userId: string,
  serviceId: string,
): Promise<{ serviceId: string; isFavorite: true }> {
  const exists = await prisma.awsService.findUnique({
    where: { id: serviceId },
    select: { id: true },
  });

  if (!exists) {
    throw ApiError.notFound(`AWS service "${serviceId}" was not found`);
  }

  await prisma.userFavoriteService.upsert({
    where: {
      userId_serviceId: { userId, serviceId },
    },
    create: { userId, serviceId },
    update: {},
  });

  return { serviceId, isFavorite: true };
}

export async function removeFavoriteService(
  userId: string,
  serviceId: string,
): Promise<{ serviceId: string; isFavorite: false }> {
  const exists = await prisma.awsService.findUnique({
    where: { id: serviceId },
    select: { id: true },
  });

  if (!exists) {
    throw ApiError.notFound(`AWS service "${serviceId}" was not found`);
  }

  await prisma.userFavoriteService.deleteMany({
    where: { userId, serviceId },
  });

  return { serviceId, isFavorite: false };
}

export interface RecentlyExploredServiceDto extends AwsServiceListItemDto {
  viewCount: number;
  lastExploredAt: string;
}

export async function listRecentlyExploredServices(
  userId: string,
  pagination: PaginationQuery,
): Promise<PaginatedResult<RecentlyExploredServiceDto>> {
  const skip = (pagination.page - 1) * pagination.limit;

  const [total, rows] = await Promise.all([
    prisma.userServiceHistory.count({ where: { userId } }),
    prisma.userServiceHistory.findMany({
      where: { userId },
      orderBy: { lastExploredAt: 'desc' },
      skip,
      take: pagination.limit,
      select: {
        viewCount: true,
        lastExploredAt: true,
        service: {
          select: SERVICE_CARD_SELECT,
        },
      },
    }),
  ]);

  const favoriteIds = await getUserFavoriteServiceIdSet(
    userId,
    rows.map((r) => r.service.id),
  );

  return {
    items: rows.map((row) => ({
      ...row.service,
      isFavorite: favoriteIds.has(row.service.id),
      viewCount: row.viewCount,
      lastExploredAt: row.lastExploredAt.toISOString(),
    })),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    },
  };
}

export async function recordServiceExploration(
  userId: string,
  serviceId: string,
): Promise<{ serviceId: string; viewCount: number; lastExploredAt: string }> {
  const exists = await prisma.awsService.findUnique({
    where: { id: serviceId },
    select: { id: true },
  });

  if (!exists) {
    throw ApiError.notFound(`AWS service "${serviceId}" was not found`);
  }

  const now = new Date();
  const record = await prisma.userServiceHistory.upsert({
    where: {
      userId_serviceId: { userId, serviceId },
    },
    create: {
      userId,
      serviceId,
      viewCount: 1,
      firstExploredAt: now,
      lastExploredAt: now,
    },
    update: {
      viewCount: { increment: 1 },
      lastExploredAt: now,
    },
    select: {
      serviceId: true,
      viewCount: true,
      lastExploredAt: true,
    },
  });

  return {
    serviceId: record.serviceId,
    viewCount: record.viewCount,
    lastExploredAt: record.lastExploredAt.toISOString(),
  };
}
