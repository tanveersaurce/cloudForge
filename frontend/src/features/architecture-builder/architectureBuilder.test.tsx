import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/App';
import type { AuthUser } from '@/features/auth/types/auth.types';
import type {
  AwsCategoryDto,
  AwsServiceDetailDto,
  AwsServiceListItemDto,
} from '@/features/aws-services/types/awsService.types';
import type { DashboardOverviewData } from '@/features/dashboard/types/dashboard.types';
import { useArchitectureBuilderStore } from '@/store/useArchitectureBuilderStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useUiStore } from '@/store/useUiStore';
import type {
  ArchitectureDetailDto,
  ArchitectureSummaryDto,
  CreateArchitectureInput,
  SaveArchitectureCanvasInput,
} from './types/architecture.types';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

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
    description: 'Virtual networks and routing.',
    iconKey: 'networking',
    sortOrder: 1,
    serviceCount: 1,
  },
  {
    id: 'cat-compute',
    slug: 'compute',
    name: 'Compute',
    description: 'Virtual machines and compute.',
    iconKey: 'compute',
    sortOrder: 2,
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
  tags: ['networking', 'vpc'],
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
  tags: ['compute', 'ec2'],
  category: {
    id: 'cat-compute',
    slug: 'compute',
    name: 'Compute',
    iconKey: 'compute',
  },
  isFavorite: false,
};

const vpcDetail: AwsServiceDetailDto = {
  ...vpcListItem,
  detailedDescription: 'Amazon VPC provides logically isolated virtual networks.',
  awsConsoleUrl: 'https://console.aws.amazon.com/vpc/',
  officialDocumentationUrl: 'https://docs.aws.amazon.com/vpc/',
  primaryUseCases: ['Multi-tier network isolation'],
  keyFeatures: ['Public and private subnets'],
  pricingModel: 'No charge for VPC itself.',
  supportedRegions: 'All AWS regions',
  commonResources: [
    {
      name: 'VPC',
      description: 'Top-level virtual network CIDR container.',
      terraformResourceType: 'aws_vpc',
    },
  ],
  configurationSchema: {
    requiredProperties: [],
    optionalProperties: [],
    dependencies: [],
    verificationNote: '',
  },
  terraformCloudForgeStatusNote: 'Supported',
  terraformResourceTypes: ['aws_vpc'],
  terraformDocsUrl: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/vpc',
  relatedServices: [],
};

const ec2Detail: AwsServiceDetailDto = {
  ...ec2ListItem,
  detailedDescription: 'Amazon EC2 provides resizable virtual servers.',
  awsConsoleUrl: 'https://console.aws.amazon.com/ec2/',
  officialDocumentationUrl: 'https://docs.aws.amazon.com/ec2/',
  primaryUseCases: ['Web application servers'],
  keyFeatures: ['Auto Scaling'],
  pricingModel: 'On-Demand billing.',
  supportedRegions: 'All AWS regions',
  commonResources: [
    {
      name: 'EC2 Instance',
      description: 'Virtual compute server.',
      terraformResourceType: 'aws_instance',
    },
  ],
  configurationSchema: {
    requiredProperties: [],
    optionalProperties: [],
    dependencies: [],
    verificationNote: '',
  },
  terraformCloudForgeStatusNote: 'Supported',
  terraformResourceTypes: ['aws_instance'],
  terraformDocsUrl: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance',
  relatedServices: [],
};

const initialSummary: ArchitectureSummaryDto = {
  id: 'arch-1',
  userId: 'user-1',
  name: 'Production Core VPC',
  description: 'Multi-AZ web topology',
  region: 'us-east-1',
  status: 'draft',
  resourceCount: 1,
  edgeCount: 0,
  createdAt: '2026-11-12T08:00:00.000Z',
  updatedAt: '2026-11-12T08:30:00.000Z',
};

const initialDetail: ArchitectureDetailDto = {
  ...initialSummary,
  nodes: [
    {
      id: 'node-vpc-1',
      type: 'awsResource',
      position: { x: 100, y: 120 },
      data: {
        serviceId: 'svc-vpc',
        serviceSlug: 'amazon-vpc',
        serviceName: 'Amazon VPC',
        categorySlug: 'networking-content-delivery',
        categoryName: 'Networking & Content Delivery',
        iconKey: 'vpc',
        resourceName: 'VPC',
        resourceType: 'aws_vpc',
        label: 'Primary VPC',
        description: 'Core network boundary',
        metadata: {},
      },
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

const listArchitecturesMock = vi.fn<() => Promise<ArchitectureSummaryDto[]>>();
const createArchitectureMock = vi.fn<(input: CreateArchitectureInput) => Promise<ArchitectureDetailDto>>();
const getArchitectureByIdMock = vi.fn<(id: string) => Promise<ArchitectureDetailDto>>();
const updateArchitectureMetadataMock = vi.fn();
const saveArchitectureCanvasMock = vi.fn<
  (id: string, input: SaveArchitectureCanvasInput) => Promise<ArchitectureDetailDto>
>();
const duplicateArchitectureMock = vi.fn();
const deleteArchitectureMock = vi.fn();

vi.mock('./services/architectureService', () => ({
  listArchitectures: () => listArchitecturesMock(),
  createArchitecture: (input: CreateArchitectureInput) => createArchitectureMock(input),
  getArchitectureById: (id: string) => getArchitectureByIdMock(id),
  updateArchitectureMetadata: (...args: unknown[]) => updateArchitectureMetadataMock(...args),
  saveArchitectureCanvas: (id: string, input: SaveArchitectureCanvasInput) =>
    saveArchitectureCanvasMock(id, input),
  duplicateArchitecture: (id: string) => duplicateArchitectureMock(id),
  deleteArchitecture: (id: string) => deleteArchitectureMock(id),
}));

vi.mock('@/features/aws-services/services/awsCatalogService', () => ({
  fetchAwsCategories: vi.fn(async () => mockCategories),
  fetchAwsServices: vi.fn(async () => ({
    items: [vpcListItem, ec2ListItem],
    pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
  })),
  fetchAwsServiceBySlug: vi.fn(async (slug: string) =>
    slug === 'amazon-ec2' ? ec2Detail : vpcDetail,
  ),
  fetchFavoriteServices: vi.fn(async () => ({
    items: [],
    pagination: { page: 1, limit: 12, total: 0, totalPages: 1 },
  })),
  fetchRecentServices: vi.fn(async () => ({
    items: [],
    pagination: { page: 1, limit: 12, total: 0, totalPages: 1 },
  })),
  addFavoriteService: vi.fn(),
  removeFavoriteService: vi.fn(),
  recordServiceExploration: vi.fn(),
}));

const mockDashboardOverview: DashboardOverviewData = {
  user: mockUser,
  metrics: {
    totalArchitectures: 1,
    savedProjects: 1,
    awsServicesExplored: {
      available: true,
      value: 2,
      totalCatalogServices: 56,
      statusLabel: '2 of 56 catalog services',
    },
    estimatedMonthlyCost: {
      available: false,
      value: null,
      statusLabel: 'Unavailable until Cost Engine (Phase 05)',
    },
  },
  recentArchitectures: [],
  favoriteServices: [],
  recentlyExploredServices: [],
  quickStartTemplates: [],
  recentActivity: [],
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

function renderAppAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Phase 04 Architecture Builder UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useArchitectureBuilderStore.getState().resetBuilder();
    useUiStore.setState({ createModalOpen: false });
    useAuthStore.setState({
      user: mockUser,
      status: 'authenticated',
      error: null,
    });

    listArchitecturesMock.mockResolvedValue([initialSummary]);
    getArchitectureByIdMock.mockResolvedValue(structuredClone(initialDetail));
    createArchitectureMock.mockImplementation(async (input) => ({
      id: 'arch-created-2',
      userId: 'user-1',
      name: input.name,
      description: input.description ?? null,
      region: input.region ?? 'us-east-1',
      status: 'draft',
      resourceCount: 0,
      edgeCount: 0,
      createdAt: '2026-11-12T09:00:00.000Z',
      updatedAt: '2026-11-12T09:00:00.000Z',
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }));
    saveArchitectureCanvasMock.mockImplementation(async (id, input) => ({
      ...structuredClone(initialDetail),
      id,
      nodes: input.nodes,
      edges: input.edges,
      viewport: input.viewport,
      resourceCount: input.nodes.length,
      edgeCount: input.edges.length,
      updatedAt: '2026-11-12T09:05:00.000Z',
    }));
  });

  it('renders /architectures list and creates a new architecture via CreateArchitectureModal', async () => {
    const user = userEvent.setup();
    renderAppAt('/architectures');

    expect(await screen.findByText('Production Core VPC')).toBeInTheDocument();
    expect(screen.getByText('Multi-AZ web topology')).toBeInTheDocument();

    // Open CreateArchitectureModal
    await user.click(screen.getByRole('button', { name: /new architecture/i }));
    const nameInput = await screen.findByLabelText(/architecture name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Serverless API Stack');

    await user.click(screen.getByRole('button', { name: /create & open canvas/i }));

    await waitFor(() => {
      expect(createArchitectureMock).toHaveBeenCalledWith({
        name: 'Serverless API Stack',
        description: undefined,
        region: 'us-east-1',
      });
    });

    // Navigates to /architecture-builder/arch-created-2 and loads it
    await waitFor(() => {
      expect(getArchitectureByIdMock).toHaveBeenCalledWith('arch-created-2');
    });
  });

  it('loads saved nodes, adds resource from AWS catalog, edits inspector metadata, duplicates/deletes, supports undo/redo, and saves manually', async () => {
    const user = userEvent.setup();
    renderAppAt('/architecture-builder/arch-1');

    // Wait for saved architecture and catalog to load
    expect(await screen.findByText('Primary VPC')).toBeInTheDocument();
    expect(await screen.findByText('Networking & Content Delivery')).toBeInTheDocument();

    // Expand Compute category and click-to-add Amazon EC2
    const computeCategoryBtn = screen.getByRole('button', { name: /compute/i });
    await user.click(computeCategoryBtn);

    const addButtons = screen.getAllByRole('button', { name: /add .* to canvas/i });
    expect(addButtons.length).toBeGreaterThanOrEqual(2);
    // Click the second service's quick-add button (EC2)
    await user.click(addButtons[1]);

    // Verify new EC2 node is added and selected in Inspector
    await waitFor(() => {
      expect(useArchitectureBuilderStore.getState().nodes).toHaveLength(2);
    });

    const labelInput = await screen.findByLabelText(/display label/i);
    const descInput = screen.getByLabelText(/description/i);

    await user.clear(labelInput);
    await user.type(labelInput, 'Web App Instance');
    await user.clear(descInput);
    await user.type(descInput, 'Handles HTTP traffic');

    expect(
      useArchitectureBuilderStore
        .getState()
        .nodes.some(
          (n) =>
            n.data.label === 'Web App Instance' &&
            n.data.description === 'Handles HTTP traffic',
        ),
    ).toBe(true);

    // Duplicate selected node via Inspector
    await user.click(screen.getByRole('button', { name: /duplicate/i }));
    await waitFor(() => {
      expect(useArchitectureBuilderStore.getState().nodes).toHaveLength(3);
    });

    // Delete duplicated node via Inspector
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => {
      expect(useArchitectureBuilderStore.getState().nodes).toHaveLength(2);
    });

    // Undo restores the deleted node (back to 3), Redo removes it again (back to 2)
    await user.click(screen.getByRole('button', { name: /^undo$/i }));
    await waitFor(() => {
      expect(useArchitectureBuilderStore.getState().nodes).toHaveLength(3);
    });

    await user.click(screen.getByRole('button', { name: /^redo$/i }));
    await waitFor(() => {
      expect(useArchitectureBuilderStore.getState().nodes).toHaveLength(2);
    });

    // Manual Save triggers saveArchitectureCanvas with current nodes, edges, viewport
    const saveButton = screen.getByRole('button', { name: /^save$/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(saveArchitectureCanvasMock).toHaveBeenCalledTimes(1);
    });
    expect(saveArchitectureCanvasMock).toHaveBeenCalledWith(
      'arch-1',
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: 'node-vpc-1' }),
        ]),
        edges: [],
        viewport: expect.objectContaining({ zoom: 1 }),
      }),
    );
  });
});
