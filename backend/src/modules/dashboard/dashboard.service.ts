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
  type: 'account' | 'architecture';
}

export interface DashboardOverviewData {
  user: AuthenticatedUser;
  metrics: {
    totalArchitectures: number;
    savedProjects: number;
    awsServicesExplored: {
      available: false;
      value: null;
      statusLabel: string;
    };
    estimatedMonthlyCost: {
      available: false;
      value: null;
      statusLabel: string;
    };
  };
  recentArchitectures: DashboardArchitectureSummary[];
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
  const [totalArchitectures, savedProjects, architectures] = await Promise.all([
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
  ]);

  const recentArchitectures: DashboardArchitectureSummary[] = architectures.map((arch) => ({
    ...arch,
    createdAt: arch.createdAt.toISOString(),
    updatedAt: arch.updatedAt.toISOString(),
  }));

  // Derive activity strictly from real persisted database records (no fabricated events).
  const recentActivity: DashboardActivityEntry[] = recentArchitectures.map((arch) => ({
    id: `arch-activity-${arch.id}`,
    title: `Architecture updated: ${arch.name}`,
    detail: `Region ${arch.region} · Status ${arch.status}`,
    timestamp: arch.updatedAt,
    type: 'architecture',
  }));

  return {
    user,
    metrics: {
      totalArchitectures,
      savedProjects,
      awsServicesExplored: {
        available: false,
        value: null,
        statusLabel: 'Unavailable until AWS Catalog (Phase 03)',
      },
      estimatedMonthlyCost: {
        available: false,
        value: null,
        statusLabel: 'Unavailable until Cost Engine (Phase 04)',
      },
    },
    recentArchitectures,
    quickStartTemplates: STATIC_QUICK_START_TEMPLATES,
    recentActivity,
  };
}
