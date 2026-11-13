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
  ArchitectureFlowEdge,
  ArchitectureFlowNode,
  ArchitectureSummaryDto,
  CreateArchitectureInput,
  SaveArchitectureCanvasInput,
} from './types/architecture.types';
import {
  getCompatibleRelationships,
  validateConnectionCompatibility,
} from './utils/awsCompatibilityRegistry';
import {
  detectCycles,
  getConnectedComponents,
  getDependencies,
  getDependents,
  getIncomingEdges,
  getOutgoingEdges,
  validateGraphStructure,
} from './utils/graphEngine';
import { normalizeEdgeData } from './utils/relationshipModel';

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

  it('opens ConnectionTypeModal on connect, rejects incompatible relationships, edits & saves in Connection Inspector, and normalizes legacy edges', async () => {
    const user = userEvent.setup();
    const legacyDetail: ArchitectureDetailDto = {
      ...structuredClone(initialDetail),
      nodes: [
        initialDetail.nodes[0],
        {
          id: 'node-subnet-1',
          type: 'awsResource',
          position: { x: 360, y: 120 },
          data: {
            serviceId: 'svc-vpc',
            serviceSlug: 'amazon-vpc',
            serviceName: 'Amazon VPC',
            categorySlug: 'networking-content-delivery',
            categoryName: 'Networking & Content Delivery',
            iconKey: 'vpc',
            resourceName: 'Subnet',
            resourceType: 'aws_subnet',
            label: 'App Subnet',
            description: 'Application subnet',
            metadata: {},
          },
        },
      ],
      edges: [
        {
          id: 'legacy-edge-1',
          source: 'node-vpc-1',
          target: 'node-subnet-1',
          type: 'smoothstep',
          data: { relationshipType: 'traffic-flow' },
        },
      ],
    };

    getArchitectureByIdMock.mockResolvedValueOnce(legacyDetail);
    renderAppAt('/architecture-builder/arch-1');

    expect(await screen.findByText('Primary VPC')).toBeInTheDocument();
    expect(await screen.findByText('App Subnet')).toBeInTheDocument();

    // Verify legacy 'traffic-flow' edge normalized to 'sends-traffic-to'
    const loadedEdge = useArchitectureBuilderStore.getState().edges[0];
    expect(loadedEdge.data?.relationshipType).toBe('sends-traffic-to');
    expect(loadedEdge.data?.direction).toBe('source-to-target');

    // Trigger onConnect(Subnet -> VPC) to verify incompatible 'contains' warning and valid 'depends-on'
    useArchitectureBuilderStore.getState().onConnect({
      source: 'node-subnet-1',
      target: 'node-vpc-1',
      sourceHandle: null,
      targetHandle: null,
    });

    expect(await screen.findByText('Define Resource Relationship')).toBeInTheDocument();
    const relTypeSelect = screen.getByLabelText(/relationship type/i);
    await user.selectOptions(relTypeSelect, 'contains');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Subnet cannot contain a VPC/i,
    );
    const createBtn = screen.getByRole('button', { name: /create relationship/i });
    expect(createBtn).toBeDisabled();

    // Switch to valid 'depends-on', fill protocol/label, and create
    await user.selectOptions(relTypeSelect, 'depends-on');
    expect(createBtn).toBeEnabled();
    await user.click(createBtn);

    await waitFor(() => {
      expect(useArchitectureBuilderStore.getState().edges).toHaveLength(2);
    });

    // Connection Inspector should open for the newly created edge
    expect(await screen.findByText('Connection Properties')).toBeInTheDocument();
    const edgeLabelInput = screen.getByLabelText(/connection label/i);
    const protocolInput = screen.getByLabelText(/protocol/i);
    const portInput = screen.getByLabelText(/port/i);

    await user.clear(edgeLabelInput);
    await user.type(edgeLabelInput, 'Parent VPC Dependency');
    await user.type(protocolInput, 'TCP');
    await user.type(portInput, '443');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    const updatedEdge = useArchitectureBuilderStore
      .getState()
      .edges.find((e) => e.id !== 'legacy-edge-1');
    expect(updatedEdge?.data).toMatchObject({
      relationshipType: 'depends-on',
      label: 'Parent VPC Dependency',
      metadata: {
        protocol: 'TCP',
        port: 443,
      },
    });

    // Delete the new relationship via Connection Inspector
    await user.click(screen.getByRole('button', { name: /delete relationship/i }));
    await waitFor(() => {
      expect(useArchitectureBuilderStore.getState().edges).toHaveLength(1);
    });

    // Save canvas persists normalized Phase 05 edge payload
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(saveArchitectureCanvasMock).toHaveBeenCalledTimes(1);
    });
  });
});

function makeFlowNode(
  id: string,
  resourceType: string,
  resourceName: string,
): ArchitectureFlowNode {
  return {
    id,
    type: 'awsResource',
    position: { x: 0, y: 0 },
    data: {
      serviceId: `svc-${resourceType}`,
      serviceSlug: resourceType,
      serviceName: resourceName,
      categorySlug: 'compute',
      categoryName: 'Compute',
      iconKey: 'ec2',
      resourceName,
      resourceType,
      label: resourceName,
      description: '',
      metadata: {},
    },
  };
}

describe('Phase 05 AWS Compatibility & Graph Engine', () => {
  it('validates AWS resource compatibility rules and detects missing hard dependencies', () => {
    const vpc = makeFlowNode('vpc-1', 'aws_vpc', 'VPC');
    const subnet = makeFlowNode('sub-1', 'aws_subnet', 'Subnet');
    const alb = makeFlowNode('alb-1', 'aws_lb', 'ALB');
    const ec2 = makeFlowNode('ec2-1', 'aws_instance', 'EC2');
    const iam = makeFlowNode('iam-1', 'aws_iam_role', 'IAM Role');

    expect(validateConnectionCompatibility(vpc, subnet, 'contains').valid).toBe(true);
    expect(validateConnectionCompatibility(subnet, vpc, 'contains').valid).toBe(false);
    expect(validateConnectionCompatibility(alb, ec2, 'load-balances-to').valid).toBe(true);
    expect(validateConnectionCompatibility(ec2, iam, 'sends-traffic-to').valid).toBe(false);

    const compat = getCompatibleRelationships(vpc, subnet);
    expect(compat.some((c) => c.relationshipType === 'contains' && c.recommended)).toBe(true);

    // Orphaned subnet without VPC triggers missing hard dependency warning
    const orphanValidation = validateGraphStructure([subnet], []);
    expect(orphanValidation.missingDependencies).toHaveLength(1);
    expect(orphanValidation.missingDependencies[0].requiredTargetTypes).toContain('aws_vpc');

    // Connected VPC -> Subnet satisfies hard dependency
    const connectedEdge: ArchitectureFlowEdge = {
      id: 'e-vpc-sub',
      source: 'vpc-1',
      target: 'sub-1',
      type: 'relationship',
      data: normalizeEdgeData({ relationshipType: 'contains' }),
    };
    const validResult = validateGraphStructure([vpc, subnet], [connectedEdge]);
    expect(validResult.isValid).toBe(true);
    expect(validResult.missingDependencies).toHaveLength(0);
  });

  it('computes graph traversal, connected components, and relationship-aware cycle detection', () => {
    const vpc = makeFlowNode('vpc-1', 'aws_vpc', 'VPC');
    const sub = makeFlowNode('sub-1', 'aws_subnet', 'Subnet');
    const ec2A = makeFlowNode('ec2-a', 'aws_instance', 'App A');
    const ec2B = makeFlowNode('ec2-b', 'aws_instance', 'App B');

    const edges: ArchitectureFlowEdge[] = [
      {
        id: 'e1',
        source: 'vpc-1',
        target: 'sub-1',
        type: 'relationship',
        data: normalizeEdgeData({ relationshipType: 'contains' }),
      },
      {
        id: 'e2',
        source: 'ec2-a',
        target: 'ec2-b',
        type: 'relationship',
        data: normalizeEdgeData({ relationshipType: 'sends-traffic-to' }),
      },
      {
        id: 'e3',
        source: 'ec2-b',
        target: 'ec2-a',
        type: 'relationship',
        data: normalizeEdgeData({ relationshipType: 'sends-traffic-to' }),
      },
    ];

    expect(getIncomingEdges(edges, 'sub-1')).toHaveLength(1);
    expect(getOutgoingEdges(edges, 'vpc-1')).toHaveLength(1);
    expect(getDependencies([vpc, sub], edges, 'sub-1').map((n) => n.id)).toEqual(['vpc-1']);
    expect(getDependents([vpc, sub], edges, 'vpc-1').map((n) => n.id)).toEqual(['sub-1']);
    expect(getConnectedComponents([vpc, sub, ec2A, ec2B], edges)).toHaveLength(2);

    // Bidirectional / cyclic network traffic is legitimate and NOT flagged as a cycle
    expect(detectCycles([vpc, sub, ec2A, ec2B], edges)).toHaveLength(0);

    // Structural `depends-on` cycle IS flagged
    const cyclicEdges: ArchitectureFlowEdge[] = [
      {
        id: 'c1',
        source: 'ec2-a',
        target: 'ec2-b',
        type: 'relationship',
        data: normalizeEdgeData({ relationshipType: 'depends-on' }),
      },
      {
        id: 'c2',
        source: 'ec2-b',
        target: 'ec2-a',
        type: 'relationship',
        data: normalizeEdgeData({ relationshipType: 'depends-on' }),
      },
    ];
    const detected = detectCycles([ec2A, ec2B], cyclicEdges);
    expect(detected).toHaveLength(1);
  });
});

describe('Phase 06 Dynamic AWS Configuration Engine', () => {
  it('retrieves verified AWS schemas, initializes defaults, and evaluates conditional visibility', async () => {
    const { getResourceConfigurationSchema, initializeDefaultConfiguration, isFieldVisible } =
      await import('./utils/configurationSchemaRegistry');

    const ec2 = getResourceConfigurationSchema('aws_instance');
    expect(ec2.resourceType).toBe('aws_instance');
    expect(ec2.sections.length).toBeGreaterThanOrEqual(4);

    const rds = getResourceConfigurationSchema('aws_db_instance');
    expect(rds.resourceType).toBe('aws_db_instance');
    const dbEngineField = rds.sections
      .flatMap((s) => s.fields)
      .find((f) => f.key === 'engine');
    expect(dbEngineField?.defaultValue).toBe('postgres');

    const s3 = getResourceConfigurationSchema('aws_s3_bucket');
    const kmsField = s3.sections
      .flatMap((s) => s.fields)
      .find((f) => f.key === 'kms_master_key_id');
    expect(kmsField).toBeDefined();

    // Conditional visibility: KMS key is hidden when SSE is AES256, visible when aws:kms
    expect(isFieldVisible(kmsField!, { sse_algorithm: 'AES256' })).toBe(false);
    expect(isFieldVisible(kmsField!, { sse_algorithm: 'aws:kms' })).toBe(true);

    // Default initialization preserves existing user fields while filling schema defaults
    const defaults = initializeDefaultConfiguration(ec2, { custom_tag: 'user-defined' });
    expect(defaults.instance_type).toBe('t3.micro');
    expect(defaults.root_volume_size).toBe(20);
    expect(defaults.custom_tag).toBe('user-defined');
  });

  it('validates fields, CIDRs, numeric ranges, and canvas resource references', async () => {
    const { validateNodeConfiguration, isValidIpv4Cidr } = await import(
      './utils/configurationValidation'
    );
    const { getResourceConfigurationSchema } = await import(
      './utils/configurationSchemaRegistry'
    );

    expect(isValidIpv4Cidr('10.0.0.0/16')).toBe(true);
    expect(isValidIpv4Cidr('192.168.1.0/24')).toBe(true);
    expect(isValidIpv4Cidr('999.0.0.0/16')).toBe(false);
    expect(isValidIpv4Cidr('not-a-cidr')).toBe(false);

    const vpcSchema = getResourceConfigurationSchema('aws_vpc');
    const vpcNode = makeFlowNode('vpc-node-1', 'aws_vpc', 'Core VPC');

    // Invalid CIDR produces error
    const invalidCidrResult = validateNodeConfiguration(
      vpcSchema,
      { vpc_name: 'prod-vpc', cidr_block: 'invalid-cidr' },
      [vpcNode],
    );
    expect(invalidCidrResult.isValid).toBe(false);
    expect(invalidCidrResult.errors.some((e) => e.fieldKey === 'cidr_block')).toBe(true);

    // EC2 referencing missing VPC node produces error
    const ec2Schema = getResourceConfigurationSchema('aws_instance');
    const ec2MissingRefResult = validateNodeConfiguration(
      ec2Schema,
      {
        instance_name: 'web-01',
        ami: 'ami-0c55b159cbfafe1f0',
        instance_type: 't3.micro',
        root_volume_size: 20,
        vpc_id: 'missing-vpc-id',
      },
      [vpcNode],
    );
    expect(ec2MissingRefResult.errors.some((e) => e.fieldKey === 'vpc_id')).toBe(true);

    // EC2 referencing existing valid VPC node succeeds
    const ec2ValidResult = validateNodeConfiguration(
      ec2Schema,
      {
        instance_name: 'web-01',
        ami: 'ami-0c55b159cbfafe1f0',
        instance_type: 't3.micro',
        root_volume_size: 20,
        vpc_id: 'vpc-node-1',
      },
      [vpcNode],
    );
    expect(ec2ValidResult.isValid).toBe(true);
  });

  it('renders dynamic configuration in inspector, updates values, and saves to node metadata', async () => {
    const user = userEvent.setup();

    const initialArch: ArchitectureDetailDto = {
      ...structuredClone(initialDetail),
      nodes: [
        {
          id: 'node-ec2-test',
          type: 'awsResource',
          position: { x: 100, y: 100 },
          data: {
            serviceId: 'svc-ec2',
            serviceSlug: 'amazon-ec2',
            serviceName: 'Amazon EC2',
            categorySlug: 'compute',
            categoryName: 'Compute',
            iconKey: 'ec2',
            resourceName: 'EC2 Instance',
            resourceType: 'aws_instance',
            label: 'Web Server',
            description: 'Application server instance',
            metadata: {},
          },
        },
      ],
      edges: [],
    };

    getArchitectureByIdMock.mockResolvedValueOnce(initialArch);
    renderAppAt('/architecture-builder/arch-1');

    expect(await screen.findByText('Web Server')).toBeInTheDocument();

    // Select the EC2 node
    useArchitectureBuilderStore.getState().selectNode('node-ec2-test');

    // Dynamic AWS Configuration section should appear in inspector
    expect(await screen.findByText(/AWS Resource Configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/General Information/i)).toBeInTheDocument();
    expect(screen.getByText(/Hardware & Compute Settings/i)).toBeInTheDocument();

    // Edit the instance name tag field
    const instanceNameInput = screen.getByLabelText(/Instance Name Tag/i);
    await user.clear(instanceNameInput);
    await user.type(instanceNameInput, 'production-api-01');

    // Click Save Configuration
    const saveConfigBtn = screen.getByRole('button', { name: /Save Configuration/i });
    expect(saveConfigBtn).toBeEnabled();
    await user.click(saveConfigBtn);

    // Check node metadata in store
    await waitFor(() => {
      const node = useArchitectureBuilderStore.getState().nodes.find((n) => n.id === 'node-ec2-test');
      expect(node?.data.metadata.instance_name).toBe('production-api-01');
    });
  });
});
