import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/App';
import type { AuthUser } from '@/features/auth/types/auth.types';
import type { DashboardOverviewData } from '@/features/dashboard/types/dashboard.types';
import { useAuthStore } from '@/store/useAuthStore';
import type {
  AwsCategoryDto,
  AwsServiceDetailDto,
  AwsServiceListItemDto,
} from './types/awsService.types';

const mockUser: AuthUser = {
  id: 'user-1',
  name: 'Aarav Sharma',
  email: 'aarav@cloudforge.dev',
  avatar: null,
  createdAt: '2026-11-12T06:00:00.000Z',
  updatedAt: '2026-11-12T06:00:00.000Z',
};

const mockCategories: AwsCategoryDto[] = [
  {
    id: 'cat-net',
    slug: 'networking-content-delivery',
    name: 'Networking & Content Delivery',
    description: 'Virtual networks, DNS routing, load balancing, and edge delivery.',
    iconKey: 'networking',
    sortOrder: 3,
    serviceCount: 1,
  },
  {
    id: 'cat-compute',
    slug: 'compute',
    name: 'Compute',
    description: 'Virtual machines and workload compute services.',
    iconKey: 'compute',
    sortOrder: 1,
    serviceCount: 1,
  },
];

const vpcListItem: AwsServiceListItemDto = {
  id: 'svc-vpc',
  slug: 'amazon-vpc',
  name: 'Amazon VPC',
  shortName: 'VPC',
  officialServiceName: 'Amazon Virtual Private Cloud',
  shortDescription: 'Isolated virtual network for launching AWS resources.',
  iconKey: 'vpc',
  terraformSupport: 'SUPPORTED',
  terraformProviderAvailable: true,
  supportLevel: 'CORE',
  tags: ['networking', 'vpc', 'subnets'],
  category: {
    id: 'cat-net',
    slug: 'networking-content-delivery',
    name: 'Networking & Content Delivery',
    iconKey: 'networking',
  },
  isFavorite: false,
};

const ec2ListItem: AwsServiceListItemDto = {
  id: 'svc-ec2',
  slug: 'amazon-ec2',
  name: 'Amazon EC2',
  shortName: 'EC2',
  officialServiceName: 'Amazon Elastic Compute Cloud',
  shortDescription: 'Resizable compute capacity in the cloud.',
  iconKey: 'ec2',
  terraformSupport: 'SUPPORTED',
  terraformProviderAvailable: true,
  supportLevel: 'CORE',
  tags: ['compute', 'instances'],
  category: {
    id: 'cat-compute',
    slug: 'compute',
    name: 'Compute',
    iconKey: 'compute',
  },
  isFavorite: true,
};

const vpcDetail: AwsServiceDetailDto = {
  ...vpcListItem,
  detailedDescription:
    'Amazon VPC provides logically isolated virtual networks with full control over CIDR ranges, subnets, route tables, and gateways.',
  awsConsoleUrl: 'https://console.aws.amazon.com/vpc/',
  officialDocumentationUrl: 'https://docs.aws.amazon.com/vpc/',
  primaryUseCases: ['Multi-tier network isolation', 'Hybrid VPN and Direct Connect topologies'],
  keyFeatures: ['Public and private subnets', 'Route tables and NAT gateways'],
  pricingModel: 'No charge for VPC itself; charges apply for NAT Gateway and data transfer.',
  supportedRegions: 'All AWS commercial and GovCloud regions',
  commonResources: [
    {
      name: 'VPC',
      description: 'Top-level virtual network CIDR container.',
      terraformResourceType: 'aws_vpc',
    },
    {
      name: 'Subnet',
      description: 'AZ-scoped IP address range inside a VPC.',
      terraformResourceType: 'aws_subnet',
    },
  ],
  configurationSchema: {
    requiredProperties: [
      {
        name: 'cidr_block',
        type: 'string',
        description: 'IPv4 CIDR block assigned to the VPC.',
        example: '10.0.0.0/16',
      },
    ],
    optionalProperties: [
      {
        name: 'enable_dns_hostnames',
        type: 'boolean',
        description: 'Enable public DNS hostnames inside the VPC.',
        example: 'true',
      },
    ],
    dependencies: ['AWS Region'],
    verificationNote: 'Ensure non-overlapping CIDRs before peering VPCs.',
  },
  terraformCloudForgeStatusNote: 'Primary networking building block for Phase 05 HCL generation.',
  terraformResourceTypes: ['aws_vpc', 'aws_subnet', 'aws_internet_gateway'],
  terraformDocsUrl: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/vpc',
  relatedServices: [ec2ListItem],
};

const ec2Detail: AwsServiceDetailDto = {
  ...ec2ListItem,
  detailedDescription: 'Amazon EC2 provides resizable virtual servers across AWS Availability Zones.',
  awsConsoleUrl: 'https://console.aws.amazon.com/ec2/',
  officialDocumentationUrl: 'https://docs.aws.amazon.com/ec2/',
  primaryUseCases: ['Web application servers', 'Batch and stateful workloads'],
  keyFeatures: ['Auto Scaling groups', 'EBS volume attachments'],
  pricingModel: 'On-Demand, Savings Plans, and Spot per-second billing.',
  supportedRegions: 'All AWS regions',
  commonResources: [
    {
      name: 'EC2 Instance',
      description: 'Virtual compute server.',
      terraformResourceType: 'aws_instance',
    },
  ],
  configurationSchema: {
    requiredProperties: [
      {
        name: 'instance_type',
        type: 'string',
        description: 'EC2 instance hardware profile.',
        example: 't3.micro',
      },
    ],
    optionalProperties: [],
    dependencies: ['Amazon VPC'],
    verificationNote: 'Verify AMI availability in target region.',
  },
  terraformCloudForgeStatusNote: 'Supported in Phase 05 Terraform generator.',
  terraformResourceTypes: ['aws_instance'],
  terraformDocsUrl:
    'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance',
  relatedServices: [vpcListItem],
};

const fetchAwsCategoriesMock = vi.fn(async () => mockCategories);
const fetchAwsServicesMock = vi.fn(async (params?: { q?: string; category?: string }) => {
  const all = [vpcListItem, ec2ListItem];
  const filtered = all.filter((item) => {
    if (params?.category && params.category !== 'all' && item.category.slug !== params.category) {
      return false;
    }
    if (params?.q) {
      const q = params.q.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.shortName.toLowerCase().includes(q) ||
        item.shortDescription.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return {
    items: filtered,
    pagination: {
      page: 1,
      limit: 12,
      total: filtered.length,
      totalPages: 1,
    },
  };
});
const fetchAwsServiceBySlugMock = vi.fn(async (slug: string) =>
  slug === 'amazon-ec2' ? ec2Detail : vpcDetail,
);
const addFavoriteServiceMock = vi.fn(async (serviceId: string) => ({
  serviceId,
  isFavorite: true as const,
}));
const removeFavoriteServiceMock = vi.fn(async (serviceId: string) => ({
  serviceId,
  isFavorite: false as const,
}));
const recordServiceExplorationMock = vi.fn(async (serviceId: string) => ({
  serviceId,
  viewCount: 1,
  lastExploredAt: '2026-11-12T10:00:00.000Z',
}));

vi.mock('./services/awsCatalogService', () => ({
  fetchAwsCategories: () => fetchAwsCategoriesMock(),
  fetchAwsServices: (params?: { q?: string; category?: string }) => fetchAwsServicesMock(params),
  fetchAwsServiceBySlug: (slug: string) => fetchAwsServiceBySlugMock(slug),
  fetchFavoriteServices: vi.fn(async () => ({
    items: [ec2ListItem],
    pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
  })),
  fetchRecentServices: vi.fn(async () => ({
    items: [
      {
        ...vpcListItem,
        viewCount: 2,
        lastExploredAt: '2026-11-12T10:00:00.000Z',
      },
    ],
    pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
  })),
  addFavoriteService: (serviceId: string) => addFavoriteServiceMock(serviceId),
  removeFavoriteService: (serviceId: string) => removeFavoriteServiceMock(serviceId),
  recordServiceExploration: (serviceId: string) => recordServiceExplorationMock(serviceId),
}));

const mockDashboardOverview: DashboardOverviewData = {
  user: mockUser,
  metrics: {
    totalArchitectures: 1,
    savedProjects: 1,
    awsServicesExplored: {
      available: true,
      value: 3,
      totalCatalogServices: 58,
      statusLabel: '3 of 58 catalog services',
    },
    estimatedMonthlyCost: {
      available: false,
      value: null,
      statusLabel: 'Unavailable until Cost Engine (Phase 04)',
    },
  },
  recentArchitectures: [],
  favoriteServices: [
    {
      id: 'svc-ec2',
      slug: 'amazon-ec2',
      name: 'Amazon EC2',
      shortName: 'EC2',
      iconKey: 'ec2',
      categoryName: 'Compute',
      terraformSupport: 'SUPPORTED',
    },
  ],
  recentlyExploredServices: [
    {
      id: 'svc-vpc',
      slug: 'amazon-vpc',
      name: 'Amazon VPC',
      shortName: 'VPC',
      iconKey: 'vpc',
      categoryName: 'Networking & Content Delivery',
      terraformSupport: 'SUPPORTED',
      lastExploredAt: '2026-11-12T10:00:00.000Z',
    },
  ],
  quickStartTemplates: [],
  recentActivity: [
    {
      id: 'svc-act-1',
      title: 'Explored Amazon VPC',
      detail: 'Viewed 2 times • Networking & Content Delivery',
      timestamp: '2026-11-12T10:00:00.000Z',
      type: 'service',
    },
  ],
};

vi.mock('@/features/dashboard/services/dashboardService', () => ({
  fetchDashboardOverview: vi.fn(async () => mockDashboardOverview),
}));

vi.mock('@/services/healthService', () => ({
  fetchBackendHealth: vi.fn(async () => ({
    status: 'ok',
    service: 'cloudforge-api',
    version: '0.1.0',
    environment: 'test',
    uptimeSeconds: 10,
    database: { status: 'connected', latencyMs: 1.5 },
  })),
}));

describe('AWS Services Explorer & Dashboard Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: mockUser,
      status: 'authenticated',
      error: null,
    });
  });

  it('renders categories, filters services by search, shows empty state, and toggles favorites', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/services']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: /aws services explorer/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Amazon VPC')).toBeInTheDocument();
    expect(screen.getByText('Amazon EC2')).toBeInTheDocument();
    expect(screen.getByText(/aws categories \(2\)/i)).toBeInTheDocument();

    // Favorite toggle on Amazon VPC
    await user.click(screen.getByRole('button', { name: /add amazon vpc to favorites/i }));
    await waitFor(() => {
      expect(addFavoriteServiceMock).toHaveBeenCalledWith('svc-vpc');
    });
    expect(
      screen.getByRole('button', { name: /remove amazon vpc from favorites/i }),
    ).toBeInTheDocument();

    // Search with no match renders empty state + Clear button
    const searchInput = screen.getByRole('searchbox', { name: /search aws services/i });
    await user.type(searchInput, 'nonexistent-aws-xyz');

    expect(await screen.findByText(/no matching aws services found/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear all filters/i }));

    expect(await screen.findByText('Amazon VPC')).toBeInTheDocument();
    expect(screen.getByText('Amazon EC2')).toBeInTheDocument();
  });

  it('renders service detail metadata, records exploration history, and navigates to related service', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/services/amazon-vpc']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Amazon VPC' })).toBeInTheDocument();
    await waitFor(() => {
      expect(recordServiceExplorationMock).toHaveBeenCalledWith('svc-vpc');
    });

    expect(screen.getAllByText('aws_vpc').length).toBeGreaterThan(0);
    expect(screen.getByText('cidr_block')).toBeInTheDocument();
    expect(screen.getAllByText(/terraform ready \(phase 05\)/i).length).toBeGreaterThan(0);

    // Navigate to related service Amazon EC2
    await user.click(screen.getByRole('link', { name: /amazon ec2/i }));
    expect(await screen.findByRole('heading', { name: 'Amazon EC2' })).toBeInTheDocument();
    await waitFor(() => {
      expect(recordServiceExplorationMock).toHaveBeenCalledWith('svc-ec2');
    });
  });

  it('displays live AWS Services Explored metric and service previews on dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /welcome back, aarav sharma/i })).toBeInTheDocument();
    expect(screen.getByText('3 of 58 catalog services')).toBeInTheDocument();
    expect(screen.getByText('Favorite AWS Services')).toBeInTheDocument();
    expect(screen.getByText('Recently Explored Services')).toBeInTheDocument();
    expect(screen.getByText('Explored Amazon VPC')).toBeInTheDocument();
  });
});
