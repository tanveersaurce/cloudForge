import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import { AWS_CATEGORIES, AWS_SERVICES } from './awsCatalogData.js';

interface MemCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  sortOrder: number;
}

interface MemService {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  officialServiceName: string;
  categoryId: string;
  shortDescription: string;
  detailedDescription: string;
  iconKey: string;
  awsConsoleUrl: string;
  officialDocumentationUrl: string;
  primaryUseCases: string[];
  keyFeatures: string[];
  pricingModel: string;
  supportedRegions: string;
  relatedServiceSlugs: string[];
  commonResources: unknown;
  configurationSchema: unknown;
  terraformSupport: string;
  terraformProviderAvailable: boolean;
  terraformCloudForgeStatusNote: string;
  terraformResourceTypes: string[];
  terraformDocsUrl: string | null;
  supportLevel: string;
  tags: string[];
}

interface MemFavorite {
  id: string;
  userId: string;
  serviceId: string;
  createdAt: Date;
}

interface MemHistory {
  id: string;
  userId: string;
  serviceId: string;
  viewCount: number;
  firstExploredAt: Date;
  lastExploredAt: Date;
}

const categoriesMem: MemCategory[] = AWS_CATEGORIES.map((cat, idx) => ({
  id: `cat-${idx + 1}`,
  ...cat,
}));

const catBySlug = new Map(categoriesMem.map((c) => [c.slug, c]));
const catById = new Map(categoriesMem.map((c) => [c.id, c]));

const servicesMem: MemService[] = AWS_SERVICES.map((svc, idx) => ({
  id: `svc-${idx + 1}`,
  slug: svc.slug,
  name: svc.name,
  shortName: svc.shortName,
  officialServiceName: svc.officialServiceName,
  categoryId: catBySlug.get(svc.categorySlug)!.id,
  shortDescription: svc.shortDescription,
  detailedDescription: svc.detailedDescription,
  iconKey: svc.iconKey,
  awsConsoleUrl: svc.awsConsoleUrl,
  officialDocumentationUrl: svc.officialDocumentationUrl,
  primaryUseCases: svc.primaryUseCases,
  keyFeatures: svc.keyFeatures,
  pricingModel: svc.pricingModel,
  supportedRegions: svc.supportedRegions,
  relatedServiceSlugs: svc.relatedServiceSlugs,
  commonResources: svc.commonResources,
  configurationSchema: svc.configurationSchema,
  terraformSupport: svc.terraformSupport,
  terraformProviderAvailable: svc.terraformProviderAvailable,
  terraformCloudForgeStatusNote: svc.terraformCloudForgeStatusNote,
  terraformResourceTypes: svc.terraformResourceTypes,
  terraformDocsUrl: svc.terraformDocsUrl,
  supportLevel: svc.supportLevel,
  tags: svc.tags,
}));

const usersMem = [
  {
    id: 'user-a',
    name: 'User Alpha',
    email: 'alpha@cloudforge.dev',
    avatar: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-b',
    name: 'User Beta',
    email: 'beta@cloudforge.dev',
    avatar: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const favoritesMem: MemFavorite[] = [];
const historyMem: MemHistory[] = [];
let seq = 1;

function matchesWhere(svc: MemService, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  if (where.category && typeof where.category === 'object') {
    const slug = (where.category as { slug?: string }).slug;
    if (slug && catById.get(svc.categoryId)?.slug !== slug) return false;
  }
  if (where.terraformSupport && svc.terraformSupport !== where.terraformSupport) return false;
  if (where.supportLevel && svc.supportLevel !== where.supportLevel) return false;
  if (where.favoritedBy && typeof where.favoritedBy === 'object') {
    const uid = (where.favoritedBy as { some?: { userId?: string } }).some?.userId;
    if (uid && !favoritesMem.some((f) => f.userId === uid && f.serviceId === svc.id)) {
      return false;
    }
  }
  if (Array.isArray(where.OR)) {
    const hit = where.OR.some((clause: Record<string, unknown>) => {
      for (const [field, cond] of Object.entries(clause)) {
        if (cond && typeof cond === 'object' && 'contains' in cond) {
          const needle = String((cond as { contains: string }).contains).toLowerCase();
          const val = String((svc as unknown as Record<string, unknown>)[field] ?? '').toLowerCase();
          if (val.includes(needle)) return true;
        }
        if (cond && typeof cond === 'object' && 'has' in cond) {
          const tag = String((cond as { has: string }).has).toLowerCase();
          if (svc.tags.includes(tag)) return true;
        }
      }
      return false;
    });
    if (!hit) return false;
  }
  return true;
}

const mockPrisma = {
  $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
  $disconnect: vi.fn(async () => undefined),
  user: {
    findUnique: vi.fn(async ({ where }: { where: { id?: string } }) => {
      return usersMem.find((u) => u.id === where.id) ?? null;
    }),
  },
  architecture: {
    count: vi.fn(async () => 0),
    findMany: vi.fn(async () => []),
  },
  awsCategory: {
    findMany: vi.fn(async () =>
      categoriesMem.map((cat) => ({
        ...cat,
        _count: {
          services: servicesMem.filter((s) => s.categoryId === cat.id).length,
        },
      })),
    ),
  },
  awsService: {
    count: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
      servicesMem.filter((s) => matchesWhere(s, where)).length,
    ),
    findMany: vi.fn(
      async ({
        where,
        orderBy,
        skip = 0,
        take = 12,
      }: {
        where?: Record<string, unknown>;
        orderBy?: Array<Record<string, unknown>>;
        skip?: number;
        take?: number;
      } = {}) => {
        let filtered = servicesMem.filter((s) => matchesWhere(s, where));
        if (where && 'slug' in where && typeof where.slug === 'object' && where.slug !== null && 'in' in where.slug) {
          const slugs = (where.slug as { in: string[] }).in;
          filtered = servicesMem.filter((s) => slugs.includes(s.slug));
        }

        const primaryOrder = orderBy?.[0];
        if (primaryOrder?.name === 'desc') {
          filtered.sort((a, b) => b.name.localeCompare(a.name));
        } else if (primaryOrder?.category) {
          filtered.sort((a, b) => {
            const catDiff =
              (catById.get(a.categoryId)?.sortOrder ?? 0) -
              (catById.get(b.categoryId)?.sortOrder ?? 0);
            return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name);
          });
        } else {
          filtered.sort((a, b) => a.name.localeCompare(b.name));
        }

        return filtered.slice(skip, skip + take).map((s) => ({
          ...s,
          category: catById.get(s.categoryId)!,
        }));
      },
    ),
    findUnique: vi.fn(async ({ where }: { where: { id?: string; slug?: string } }) => {
      const found = servicesMem.find((s) =>
        where.id ? s.id === where.id : s.slug === where.slug,
      );
      if (!found) return null;
      return {
        ...found,
        category: catById.get(found.categoryId)!,
      };
    }),
  },
  userFavoriteService: {
    count: vi.fn(async ({ where }: { where: { userId: string } }) =>
      favoritesMem.filter((f) => f.userId === where.userId).length,
    ),
    findMany: vi.fn(
      async ({
        where,
        skip = 0,
        take = 100,
      }: {
        where: { userId: string; serviceId?: { in: string[] } };
        skip?: number;
        take?: number;
      }) => {
        const list = favoritesMem
          .filter(
            (f) =>
              f.userId === where.userId &&
              (!where.serviceId?.in || where.serviceId.in.includes(f.serviceId)),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(skip, skip + take);

        return list.map((f) => {
          const svc = servicesMem.find((s) => s.id === f.serviceId)!;
          return {
            serviceId: f.serviceId,
            service: {
              ...svc,
              category: catById.get(svc.categoryId)!,
            },
          };
        });
      },
    ),
    upsert: vi.fn(
      async ({
        where,
        create,
      }: {
        where: { userId_serviceId: { userId: string; serviceId: string } };
        create: { userId: string; serviceId: string };
      }) => {
        const existing = favoritesMem.find(
          (f) =>
            f.userId === where.userId_serviceId.userId &&
            f.serviceId === where.userId_serviceId.serviceId,
        );
        if (existing) return existing;
        const created: MemFavorite = {
          id: `fav-${seq++}`,
          userId: create.userId,
          serviceId: create.serviceId,
          createdAt: new Date(),
        };
        favoritesMem.push(created);
        return created;
      },
    ),
    deleteMany: vi.fn(
      async ({ where }: { where: { userId: string; serviceId: string } }) => {
        const before = favoritesMem.length;
        for (let i = favoritesMem.length - 1; i >= 0; i -= 1) {
          if (
            favoritesMem[i].userId === where.userId &&
            favoritesMem[i].serviceId === where.serviceId
          ) {
            favoritesMem.splice(i, 1);
          }
        }
        return { count: before - favoritesMem.length };
      },
    ),
  },
  userServiceHistory: {
    count: vi.fn(async ({ where }: { where: { userId: string } }) =>
      historyMem.filter((h) => h.userId === where.userId).length,
    ),
    findMany: vi.fn(
      async ({
        where,
        skip = 0,
        take = 100,
      }: {
        where: { userId: string };
        skip?: number;
        take?: number;
      }) => {
        const list = historyMem
          .filter((h) => h.userId === where.userId)
          .sort((a, b) => b.lastExploredAt.getTime() - a.lastExploredAt.getTime())
          .slice(skip, skip + take);

        return list.map((h) => {
          const svc = servicesMem.find((s) => s.id === h.serviceId)!;
          return {
            viewCount: h.viewCount,
            lastExploredAt: h.lastExploredAt,
            service: {
              ...svc,
              category: catById.get(svc.categoryId)!,
            },
          };
        });
      },
    ),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { userId_serviceId: { userId: string; serviceId: string } };
        create: {
          userId: string;
          serviceId: string;
          viewCount: number;
          firstExploredAt: Date;
          lastExploredAt: Date;
        };
        update: { viewCount: { increment: number }; lastExploredAt: Date };
      }) => {
        const existing = historyMem.find(
          (h) =>
            h.userId === where.userId_serviceId.userId &&
            h.serviceId === where.userId_serviceId.serviceId,
        );
        if (existing) {
          existing.viewCount += update.viewCount.increment;
          existing.lastExploredAt = update.lastExploredAt;
          return existing;
        }
        const created: MemHistory = {
          id: `hist-${seq++}`,
          userId: create.userId,
          serviceId: create.serviceId,
          viewCount: create.viewCount,
          firstExploredAt: create.firstExploredAt,
          lastExploredAt: create.lastExploredAt,
        };
        historyMem.push(created);
        return created;
      },
    ),
  },
};

vi.mock('../../config/database.js', () => ({
  prisma: mockPrisma,
  checkDatabaseConnection: vi.fn(async () => ({ connected: true, latencyMs: 1.0 })),
  disconnectDatabase: vi.fn(async () => undefined),
}));

const { createApp } = await import('../../app.js');

function authCookieFor(userId: string): string {
  const token = jwt.sign({ sub: userId, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
  return `cf_access_token=${token}`;
}

describe('AWS Services Explorer APIs', () => {
  const app = createApp();
  const cookieUserA = authCookieFor('user-a');
  const cookieUserB = authCookieFor('user-b');

  beforeEach(() => {
    favoritesMem.length = 0;
    historyMem.length = 0;
    seq = 1;
  });

  it('lists all 16 AWS categories with accurate service counts', async () => {
    const res = await request(app).get('/api/aws/categories');
    expect(res.status).toBe(200);
    expect(res.body.data.categories).toHaveLength(16);
    const totalCount = res.body.data.categories.reduce(
      (sum: number, c: { serviceCount: number }) => sum + c.serviceCount,
      0,
    );
    expect(totalCount).toBe(AWS_SERVICES.length);
    expect(totalCount).toBeGreaterThanOrEqual(40);
  });

  it('paginates services and supports search by name, abbreviation, and keyword', async () => {
    const page1 = await request(app).get('/api/aws/services?page=1&limit=10');
    expect(page1.status).toBe(200);
    expect(page1.body.data.items).toHaveLength(10);
    expect(page1.body.data.pagination.total).toBe(AWS_SERVICES.length);

    const byName = await request(app).get('/api/aws/services/search?q=Amazon%20VPC');
    expect(byName.status).toBe(200);
    expect(byName.body.data.items.some((s: { slug: string }) => s.slug === 'amazon-vpc')).toBe(true);

    const byKeyword = await request(app).get('/api/aws/services?q=serverless&limit=50');
    expect(byKeyword.status).toBe(200);
    expect(byKeyword.body.data.items.some((s: { slug: string }) => s.slug === 'aws-lambda')).toBe(
      true,
    );

    const byAbbreviation = await request(app).get('/api/aws/services/search?q=EC2');
    expect(byAbbreviation.status).toBe(200);
    expect(byAbbreviation.body.data.items.some((s: { slug: string }) => s.slug === 'amazon-ec2')).toBe(
      true,
    );
  });

  it('supports category filtering, combined filters, and empty search results', async () => {
    const res = await request(app).get(
      '/api/aws/services?category=database&terraformSupport=SUPPORTED&sort=name_asc',
    );
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    for (const item of res.body.data.items) {
      expect(item.category.slug).toBe('database');
      expect(item.terraformSupport).toBe('SUPPORTED');
    }

    const empty = await request(app).get('/api/aws/services?q=xyznonexistentservice123');
    expect(empty.status).toBe(200);
    expect(empty.body.data.items).toEqual([]);
    expect(empty.body.data.pagination.total).toBe(0);
  });

  it('returns service details with resolved related services and 404 for unknown slug', async () => {
    const res = await request(app).get('/api/aws/services/amazon-vpc');
    expect(res.status).toBe(200);
    expect(res.body.data.service.slug).toBe('amazon-vpc');
    expect(res.body.data.service.commonResources.length).toBeGreaterThanOrEqual(4);
    expect(res.body.data.service.relatedServices.length).toBeGreaterThan(0);

    const missing = await request(app).get('/api/aws/services/not-a-real-aws-service');
    expect(missing.status).toBe(404);
  });

  it('enforces auth and ownership isolation for favorites, exploration history, and dashboard metrics', async () => {
    const unauthFav = await request(app).get('/api/aws/services/favorites');
    expect(unauthFav.status).toBe(401);

    const vpcService = servicesMem.find((s) => s.slug === 'amazon-vpc')!;
    const s3Service = servicesMem.find((s) => s.slug === 'amazon-s3')!;

    // User A favorites VPC
    const addFav = await request(app)
      .post(`/api/aws/services/${vpcService.id}/favorite`)
      .set('Cookie', [cookieUserA]);
    expect(addFav.status).toBe(200);
    expect(addFav.body.data.isFavorite).toBe(true);

    // User A sees VPC in favorites; User B sees empty favorites
    const favA = await request(app).get('/api/aws/services/favorites').set('Cookie', [cookieUserA]);
    expect(favA.body.data.items.map((i: { id: string }) => i.id)).toEqual([vpcService.id]);

    const favB = await request(app).get('/api/aws/services/favorites').set('Cookie', [cookieUserB]);
    expect(favB.body.data.items).toEqual([]);

    // User B cannot remove User A's favorite
    await request(app)
      .delete(`/api/aws/services/${vpcService.id}/favorite`)
      .set('Cookie', [cookieUserB]);
    const favAAfterB = await request(app)
      .get('/api/aws/services/favorites')
      .set('Cookie', [cookieUserA]);
    expect(favAAfterB.body.data.items).toHaveLength(1);

    // User A removes favorite cleanly
    const delFav = await request(app)
      .delete(`/api/aws/services/${vpcService.id}/favorite`)
      .set('Cookie', [cookieUserA]);
    expect(delFav.status).toBe(200);
    expect(delFav.body.data.isFavorite).toBe(false);

    // Exploration history deduplicates repeated views for User A
    const exp1 = await request(app)
      .post(`/api/aws/services/${s3Service.id}/explore`)
      .set('Cookie', [cookieUserA]);
    expect(exp1.status).toBe(200);
    expect(exp1.body.data.viewCount).toBe(1);

    const exp2 = await request(app)
      .post(`/api/aws/services/${s3Service.id}/explore`)
      .set('Cookie', [cookieUserA]);
    expect(exp2.status).toBe(200);
    expect(exp2.body.data.viewCount).toBe(2);

    const recentA = await request(app).get('/api/aws/services/recent').set('Cookie', [cookieUserA]);
    expect(recentA.body.data.items).toHaveLength(1);
    expect(recentA.body.data.items[0].slug).toBe('amazon-s3');

    // Dashboard overview reflects User A's explored count (1) and User B's (0)
    const dashA = await request(app)
      .get('/api/dashboard/overview')
      .set('Cookie', [cookieUserA]);
    expect(dashA.status).toBe(200);
    expect(dashA.body.data.metrics.awsServicesExplored.value).toBe(1);
    expect(dashA.body.data.recentlyExploredServices).toHaveLength(1);

    const dashB = await request(app)
      .get('/api/dashboard/overview')
      .set('Cookie', [cookieUserB]);
    expect(dashB.status).toBe(200);
    expect(dashB.body.data.metrics.awsServicesExplored.value).toBe(0);
    expect(dashB.body.data.recentlyExploredServices).toEqual([]);
  });
});
