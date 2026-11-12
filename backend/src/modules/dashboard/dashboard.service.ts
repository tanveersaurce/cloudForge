import { prisma } from '../../config/database.js';
import type { AuthenticatedUser } from '../../types/auth.types.js';

export interface DashboardArchitectureSummary {
  id: string;
  name: string;
  description: string | null;
  region: string;
  status: string;
  resourceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardServicePreview {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  iconKey: string;
  categoryName: string;
  terraformSupport: string;
  lastExploredAt?: string;
}

export interface DashboardQuickStartTemplate {
  id: string;
  title: string;
  category: 'Web & Compute' | 'Serverless' | 'Networking' | 'Storage & Edge';
  description: string;
  serviceCount: number;
  services: string[];
  complexity: 'Starter' | 'Standard' | 'Production';
  isStaticTemplate: true;
}

export interface DashboardActivityEntry {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  type: 'account' | 'architecture' | 'service';
}

export interface DashboardOverviewData {
  user: AuthenticatedUser;
  metrics: {
    totalArchitectures: number;
    savedProjects: number;
    awsServicesExplored: {
      available: true;
      value: number;
      totalCatalogServices: number;
      statusLabel: string;
    };
    estimatedMonthlyCost: {
      available: false;
      value: null;
      statusLabel: string;
    };
  };
  recentArchitectures: DashboardArchitectureSummary[];
  favoriteServices: DashboardServicePreview[];
  recentlyExploredServices: DashboardServicePreview[];
  quickStartTemplates: DashboardQuickStartTemplate[];
  recentActivity: DashboardActivityEntry[];
}

const STATIC_QUICK_START_TEMPLATES: DashboardQuickStartTemplate[] = [
  {
    id: 'tpl-3tier-web',
    title: '3-Tier Resilient Web App',
    category: 'Web & Compute',
    description: 'Public ALB, private ECS Fargate services across 2 AZs, and Multi-AZ RDS PostgreSQL.',
    serviceCount: 12,
    services: ['VPC', 'ALB', 'ECS Fargate', 'RDS PostgreSQL', 'Secrets Manager'],
    complexity: 'Production',
    isStaticTemplate: true,
  },
  {
    id: 'tpl-serverless-api',
    title: 'Serverless REST API',
    category: 'Serverless',
    description: 'Pay-per-request HTTP API backed by Lambda functions, DynamoDB, and CloudWatch Logs.',
    serviceCount: 6,
    services: ['API Gateway', 'AWS Lambda', 'DynamoDB', 'CloudWatch'],
    complexity: 'Starter',
    isStaticTemplate: true,
  },
  {
    id: 'tpl-zero-trust-vpc',
    title: 'Multi-AZ VPC Core Network',
    category: 'Networking',
    description: 'Segmented public, private app, and isolated database subnets with NAT & VPC Flow Logs.',
    serviceCount: 8,
    services: ['VPC', 'Subnets', 'Internet Gateway', 'NAT Gateway', 'Route Tables'],
    complexity: 'Standard',
    isStaticTemplate: true,
  },
  {
    id: 'tpl-edge-cdn',
    title: 'Static Site + Global CDN',
    category: 'Storage & Edge',
    description: 'Private S3 bucket origin served via CloudFront OAC with TLS certificate and DNS routing.',
    serviceCount: 5,
    services: ['Amazon S3', 'CloudFront', 'ACM', 'Route 53'],
    complexity: 'Starter',
    isStaticTemplate: true,
  },
];

export async function getDashboardOverview(user: AuthenticatedUser): Promise<DashboardOverviewData> {
  const [
    totalArchitectures,
    savedProjects,
    architectures,
    exploredCount,
    totalCatalogServices,
    favoriteRows,
    historyRows,
  ] = await Promise.all([
    prisma.architecture.count({ where: { userId: user.id } }),
    prisma.architecture.count({ where: { userId: user.id, status: { not: 'archived' } } }),
    prisma.architecture.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        description: true,
        region: true,
        status: true,
        resourceCount: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.userServiceHistory.count({ where: { userId: user.id } }),
    prisma.awsService.count(),
    prisma.userFavoriteService.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        service: {
          select: {
            id: true,
            slug: true,
            name: true,
            shortName: true,
            iconKey: true,
            terraformSupport: true,
            category: { select: { name: true } },
          },
        },
      },
    }),
    prisma.userServiceHistory.findMany({
      where: { userId: user.id },
      orderBy: { lastExploredAt: 'desc' },
      take: 4,
      select: {
        lastExploredAt: true,
        service: {
          select: {
            id: true,
            slug: true,
            name: true,
            shortName: true,
            iconKey: true,
            terraformSupport: true,
            category: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const recentArchitectures: DashboardArchitectureSummary[] = architectures.map((arch) => ({
    ...arch,
    createdAt: arch.createdAt.toISOString(),
    updatedAt: arch.updatedAt.toISOString(),
  }));

  const favoriteServices: DashboardServicePreview[] = favoriteRows.map((row) => ({
    id: row.service.id,
    slug: row.service.slug,
    name: row.service.name,
    shortName: row.service.shortName,
    iconKey: row.service.iconKey,
    categoryName: row.service.category.name,
    terraformSupport: row.service.terraformSupport,
  }));

  const recentlyExploredServices: DashboardServicePreview[] = historyRows.map((row) => ({
    id: row.service.id,
    slug: row.service.slug,
    name: row.service.name,
    shortName: row.service.shortName,
    iconKey: row.service.iconKey,
    categoryName: row.service.category.name,
    terraformSupport: row.service.terraformSupport,
    lastExploredAt: row.lastExploredAt.toISOString(),
  }));

  // Derive activity strictly from real persisted database records (no fabricated events).
  const archActivities: DashboardActivityEntry[] = recentArchitectures.map((arch) => ({
    id: `arch-activity-${arch.id}`,
    title: `Architecture updated: ${arch.name}`,
    detail: `Region ${arch.region} · Status ${arch.status}`,
    timestamp: arch.updatedAt,
    type: 'architecture',
  }));

  const serviceActivities: DashboardActivityEntry[] = recentlyExploredServices.map((svc) => ({
    id: `svc-activity-${svc.id}`,
    title: `Explored ${svc.name}`,
    detail: `Category: ${svc.categoryName}`,
    timestamp: svc.lastExploredAt ?? new Date().toISOString(),
    type: 'service',
  }));

  const recentActivity = [...archActivities, ...serviceActivities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);

  return {
    user,
    metrics: {
      totalArchitectures,
      savedProjects,
      awsServicesExplored: {
        available: true,
        value: exploredCount,
        totalCatalogServices,
        statusLabel:
          totalCatalogServices > 0
            ? `of ${totalCatalogServices} catalog services`
            : 'Service catalog ready',
      },
      estimatedMonthlyCost: {
        available: false,
        value: null,
        statusLabel: 'Unavailable until Cost Engine (Phase 04)',
      },
    },
    recentArchitectures,
    favoriteServices,
    recentlyExploredServices,
    quickStartTemplates: STATIC_QUICK_START_TEMPLATES,
    recentActivity,
  };
}
