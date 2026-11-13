import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

interface StoredArchitecture {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  region: string;
  status: string;
  resourceCount: number;
  nodes: unknown[];
  edges: unknown[];
  viewport: { x: number; y: number; zoom: number } | null;
  createdAt: Date;
  updatedAt: Date;
}

const users: StoredUser[] = [];
const sessions: StoredSession[] = [];
const architectures: StoredArchitecture[] = [];
let seq = 1;

function pickUser(user: StoredUser, select?: Record<string, boolean>) {
  if (!select) return { ...user };
  const out: Record<string, unknown> = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) {
      out[key] = user[key as keyof StoredUser];
    }
  }
  return out;
}

const mockPrisma = {
  $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
  $disconnect: vi.fn(async () => undefined),
  $transaction: vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
  user: {
    findUnique: vi.fn(
      async ({
        where,
        select,
      }: {
        where: { id?: string; email?: string };
        select?: Record<string, boolean>;
      }) => {
        const found = users.find((u) =>
          where.id ? u.id === where.id : u.email === where.email,
        );
        return found ? pickUser(found, select) : null;
      },
    ),
    create: vi.fn(
      async ({
        data,
        select,
      }: {
        data: { name: string; email: string; passwordHash: string };
        select?: Record<string, boolean>;
      }) => {
        const now = new Date();
        const created: StoredUser = {
          id: `user-${seq++}`,
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash,
          avatar: null,
          createdAt: now,
          updatedAt: now,
        };
        users.push(created);
        return pickUser(created, select);
      },
    ),
  },
  refreshSession: {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          userId: string;
          tokenHash: string;
          userAgent?: string;
          ipAddress?: string;
          expiresAt: Date;
        };
      }) => {
        const created: StoredSession = {
          id: `sess-${seq++}`,
          userId: data.userId,
          tokenHash: data.tokenHash,
          userAgent: data.userAgent ?? null,
          ipAddress: data.ipAddress ?? null,
          expiresAt: data.expiresAt,
          revokedAt: null,
          createdAt: new Date(),
        };
        sessions.push(created);
        return created;
      },
    ),
    findUnique: vi.fn(async () => null),
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
  architecture: {
    findMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
      return architectures
        .filter((a) => a.userId === where.userId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return architectures.find((a) => a.id === where.id) ?? null;
    }),
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          userId: string;
          name: string;
          description: string | null;
          region: string;
          status: string;
          resourceCount: number;
          nodes: unknown[];
          edges: unknown[];
          viewport: { x: number; y: number; zoom: number } | null;
        };
      }) => {
        const now = new Date();
        const created: StoredArchitecture = {
          id: `arch-${seq++}`,
          userId: data.userId,
          name: data.name,
          description: data.description,
          region: data.region,
          status: data.status,
          resourceCount: data.resourceCount,
          nodes: structuredClone(data.nodes),
          edges: structuredClone(data.edges),
          viewport: structuredClone(data.viewport),
          createdAt: now,
          updatedAt: now,
        };
        architectures.push(created);
        return created;
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Omit<StoredArchitecture, 'id' | 'userId' | 'createdAt'>>;
      }) => {
        const target = architectures.find((a) => a.id === where.id);
        if (!target) {
          throw new Error(`Architecture ${where.id} not found`);
        }
        if (data.name !== undefined) target.name = data.name;
        if (data.description !== undefined) target.description = data.description;
        if (data.region !== undefined) target.region = data.region;
        if (data.status !== undefined) target.status = data.status;
        if (data.resourceCount !== undefined) target.resourceCount = data.resourceCount;
        if (data.nodes !== undefined) target.nodes = structuredClone(data.nodes);
        if (data.edges !== undefined) target.edges = structuredClone(data.edges);
        if (data.viewport !== undefined) target.viewport = structuredClone(data.viewport);
        target.updatedAt = new Date();
        return target;
      },
    ),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      const idx = architectures.findIndex((a) => a.id === where.id);
      if (idx === -1) {
        throw new Error(`Architecture ${where.id} not found`);
      }
      const [removed] = architectures.splice(idx, 1);
      return removed;
    }),
    count: vi.fn(async () => architectures.length),
  },
  userServiceHistory: {
    count: vi.fn(async () => 0),
    findMany: vi.fn(async () => []),
  },
  userFavoriteService: {
    findMany: vi.fn(async () => []),
  },
  awsService: {
    count: vi.fn(async () => 56),
  },
};

vi.mock('../../config/database.js', () => ({
  prisma: mockPrisma,
  checkDatabaseConnection: vi.fn(async () => ({ connected: true, latencyMs: 1.2 })),
  disconnectDatabase: vi.fn(async () => undefined),
}));

const { createApp } = await import('../../app.js');

function extractCookieValue(
  setCookieHeaders: string[] | undefined,
  name: string,
): string | undefined {
  if (!setCookieHeaders) return undefined;
  const target = setCookieHeaders.find((c) => c.startsWith(`${name}=`));
  if (!target) return undefined;
  return target.split(';')[0];
}

function makeSampleNode(id: string, overrides?: Partial<{ label: string; resourceName: string }>) {
  return {
    id,
    type: 'awsResource' as const,
    position: { x: 120, y: 180 },
    data: {
      serviceId: 'svc-vpc',
      serviceSlug: 'amazon-vpc',
      serviceName: 'Amazon VPC',
      categorySlug: 'networking-content-delivery',
      categoryName: 'Networking & Content Delivery',
      iconKey: 'vpc',
      resourceName: overrides?.resourceName ?? 'VPC',
      resourceType: 'aws_vpc',
      label: overrides?.label ?? 'Primary VPC',
      description: 'Core virtual network',
      metadata: { cidr_block: '10.0.0.0/16' },
    },
  };
}

describe('Architecture CRUD, Canvas Persistence, Validation & Ownership APIs', () => {
  const app = createApp();

  beforeEach(() => {
    users.length = 0;
    sessions.length = 0;
    architectures.length = 0;
    seq = 1;
    vi.clearAllMocks();
  });

  async function registerAndGetCookie(name: string, email: string): Promise<string> {
    const res = await request(app).post('/api/auth/register').send({
      name,
      email,
      password: 'StrongPassword!2026',
    });
    expect(res.status).toBe(201);
    const cookie = extractCookieValue(
      res.headers['set-cookie'] as unknown as string[] | undefined,
      'cf_access_token',
    );
    expect(cookie).toBeDefined();
    return cookie as string;
  }

  it('rejects unauthenticated requests to all /api/architectures endpoints with 401', async () => {
    const endpoints = [
      request(app).get('/api/architectures'),
      request(app).post('/api/architectures').send({ name: 'Unauth Arch' }),
      request(app).get('/api/architectures/arch-1'),
      request(app).patch('/api/architectures/arch-1').send({ name: 'Updated' }),
      request(app)
        .put('/api/architectures/arch-1/canvas')
        .send({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }),
      request(app).post('/api/architectures/arch-1/duplicate'),
      request(app).delete('/api/architectures/arch-1'),
    ];

    const responses = await Promise.all(endpoints);
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }
  });

  it('allows an authenticated user to create, list, get, update metadata, duplicate, and delete an architecture', async () => {
    const cookie = await registerAndGetCookie('Aarav Sharma', 'aarav@cloudforge.dev');

    // Create
    const createRes = await request(app)
      .post('/api/architectures')
      .set('Cookie', cookie)
      .send({
        name: 'Production Web VPC',
        description: 'Multi-AZ web application topology',
        region: 'us-west-2',
        status: 'draft',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const createdId = createRes.body.data.id as string;
    expect(createRes.body.data).toMatchObject({
      name: 'Production Web VPC',
      description: 'Multi-AZ web application topology',
      region: 'us-west-2',
      status: 'draft',
      resourceCount: 0,
      edgeCount: 0,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    // List
    const listRes = await request(app).get('/api/architectures').set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(createdId);

    // Get by ID
    const getRes = await request(app)
      .get(`/api/architectures/${createdId}`)
      .set('Cookie', cookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe('Production Web VPC');

    // Update metadata
    const updateRes = await request(app)
      .patch(`/api/architectures/${createdId}`)
      .set('Cookie', cookie)
      .send({
        name: 'Production Web VPC v2',
        status: 'active',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data).toMatchObject({
      id: createdId,
      name: 'Production Web VPC v2',
      status: 'active',
    });

    // Duplicate
    const dupRes = await request(app)
      .post(`/api/architectures/${createdId}/duplicate`)
      .set('Cookie', cookie);
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.data.id).not.toBe(createdId);
    expect(dupRes.body.data.name).toBe('Production Web VPC v2 (Copy)');
    expect(dupRes.body.data.status).toBe('draft');

    // Delete original
    const delRes = await request(app)
      .delete(`/api/architectures/${createdId}`)
      .set('Cookie', cookie);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data).toEqual({ deleted: true });

    // Confirm original is gone, duplicate remains
    const listAfterDel = await request(app).get('/api/architectures').set('Cookie', cookie);
    expect(listAfterDel.status).toBe(200);
    expect(listAfterDel.body.data).toHaveLength(1);
    expect(listAfterDel.body.data[0].id).toBe(dupRes.body.data.id);
  });

  it('persists nodes, edges, and viewport on PUT /api/architectures/:id/canvas, updates resourceCount, and reloads cleanly', async () => {
    const cookie = await registerAndGetCookie('Aarav Sharma', 'aarav@cloudforge.dev');

    const createRes = await request(app)
      .post('/api/architectures')
      .set('Cookie', cookie)
      .send({ name: 'Canvas Persistence Test', region: 'us-east-1' });
    const archId = createRes.body.data.id as string;

    const node1 = makeSampleNode('node-vpc-1', { label: 'Main VPC', resourceName: 'VPC' });
    const node2 = makeSampleNode('node-ec2-1', { label: 'App Server', resourceName: 'EC2 Instance' });
    const edge1 = {
      id: 'edge-1',
      source: 'node-vpc-1',
      target: 'node-ec2-1',
      type: 'smoothstep' as const,
      data: { relationshipType: 'contains', label: 'hosts' },
    };
    const viewport = { x: 145, y: -60, zoom: 1.25 };

    const saveRes = await request(app)
      .put(`/api/architectures/${archId}/canvas`)
      .set('Cookie', cookie)
      .send({
        nodes: [node1, node2],
        edges: [edge1],
        viewport,
      });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.data.resourceCount).toBe(2);
    expect(saveRes.body.data.edgeCount).toBe(1);
    expect(saveRes.body.data.nodes).toHaveLength(2);
    expect(saveRes.body.data.edges).toHaveLength(1);
    expect(saveRes.body.data.viewport).toEqual(viewport);

    // Reload via GET
    const reloadRes = await request(app)
      .get(`/api/architectures/${archId}`)
      .set('Cookie', cookie);

    expect(reloadRes.status).toBe(200);
    expect(reloadRes.body.data.resourceCount).toBe(2);
    expect(reloadRes.body.data.edgeCount).toBe(1);
    expect(reloadRes.body.data.nodes.map((n: { id: string }) => n.id)).toEqual([
      'node-vpc-1',
      'node-ec2-1',
    ]);
    expect(reloadRes.body.data.edges[0]).toMatchObject({
      id: 'edge-1',
      source: 'node-vpc-1',
      target: 'node-ec2-1',
    });
    expect(reloadRes.body.data.viewport).toEqual(viewport);
  });

  it('rejects invalid canvas payloads: duplicate node IDs, self-loop edges, missing node refs, and invalid viewport zoom', async () => {
    const cookie = await registerAndGetCookie('Aarav Sharma', 'aarav@cloudforge.dev');

    const createRes = await request(app)
      .post('/api/architectures')
      .set('Cookie', cookie)
      .send({ name: 'Validation Test' });
    const archId = createRes.body.data.id as string;

    const node1 = makeSampleNode('node-1');
    const node2 = makeSampleNode('node-2');

    // 1. Duplicate node IDs
    const dupNodeRes = await request(app)
      .put(`/api/architectures/${archId}/canvas`)
      .set('Cookie', cookie)
      .send({
        nodes: [node1, makeSampleNode('node-1')],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      });
    expect(dupNodeRes.status).toBe(400);
    expect(dupNodeRes.body.success).toBe(false);

    // 2. Self-loop edge (source === target)
    const selfLoopRes = await request(app)
      .put(`/api/architectures/${archId}/canvas`)
      .set('Cookie', cookie)
      .send({
        nodes: [node1],
        edges: [
          {
            id: 'edge-self',
            source: 'node-1',
            target: 'node-1',
            type: 'smoothstep',
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      });
    expect(selfLoopRes.status).toBe(400);
    expect(selfLoopRes.body.success).toBe(false);

    // 3. Edge pointing to missing node ID
    const missingRefRes = await request(app)
      .put(`/api/architectures/${archId}/canvas`)
      .set('Cookie', cookie)
      .send({
        nodes: [node1, node2],
        edges: [
          {
            id: 'edge-broken',
            source: 'node-1',
            target: 'node-does-not-exist',
            type: 'smoothstep',
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      });
    expect(missingRefRes.status).toBe(400);
    expect(missingRefRes.body.success).toBe(false);

    // 4. Invalid viewport zoom (0 or negative)
    const badZoomRes = await request(app)
      .put(`/api/architectures/${archId}/canvas`)
      .set('Cookie', cookie)
      .send({
        nodes: [node1],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 0 },
      });
    expect(badZoomRes.status).toBe(400);
    expect(badZoomRes.body.success).toBe(false);

    const negativeZoomRes = await request(app)
      .put(`/api/architectures/${archId}/canvas`)
      .set('Cookie', cookie)
      .send({
        nodes: [node1],
        edges: [],
        viewport: { x: 0, y: 0, zoom: -1.5 },
      });
    expect(negativeZoomRes.status).toBe(400);
    expect(negativeZoomRes.body.success).toBe(false);
  });

  it('enforces strict user ownership: User B cannot access, modify, duplicate, or delete User A architectures', async () => {
    const cookieA = await registerAndGetCookie('User A', 'usera@cloudforge.dev');
    const cookieB = await registerAndGetCookie('User B', 'userb@cloudforge.dev');

    const createRes = await request(app)
      .post('/api/architectures')
      .set('Cookie', cookieA)
      .send({ name: 'User A Private Arch' });
    const archAId = createRes.body.data.id as string;

    // User B list should not contain User A's architecture
    const listBRes = await request(app).get('/api/architectures').set('Cookie', cookieB);
    expect(listBRes.status).toBe(200);
    expect(listBRes.body.data).toEqual([]);

    // User B cannot get
    const getBRes = await request(app)
      .get(`/api/architectures/${archAId}`)
      .set('Cookie', cookieB);
    expect(getBRes.status).toBe(403);
    expect(getBRes.body.error.code).toBe('FORBIDDEN');

    // User B cannot update metadata
    const patchBRes = await request(app)
      .patch(`/api/architectures/${archAId}`)
      .set('Cookie', cookieB)
      .send({ name: 'Hijacked' });
    expect(patchBRes.status).toBe(403);

    // User B cannot save canvas
    const putCanvasBRes = await request(app)
      .put(`/api/architectures/${archAId}/canvas`)
      .set('Cookie', cookieB)
      .send({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
    expect(putCanvasBRes.status).toBe(403);

    // User B cannot duplicate
    const dupBRes = await request(app)
      .post(`/api/architectures/${archAId}/duplicate`)
      .set('Cookie', cookieB);
    expect(dupBRes.status).toBe(403);

    // User B cannot delete
    const delBRes = await request(app)
      .delete(`/api/architectures/${archAId}`)
      .set('Cookie', cookieB);
    expect(delBRes.status).toBe(403);

    // Verify User A's architecture is still intact
    const getARes = await request(app)
      .get(`/api/architectures/${archAId}`)
      .set('Cookie', cookieA);
    expect(getARes.status).toBe(200);
    expect(getARes.body.data.name).toBe('User A Private Arch');
  });

  it('persists Phase 05 relationship metadata, direction, and labels, and rejects invalid metadata ports', async () => {
    const cookie = await registerAndGetCookie('Aarav Sharma', 'aarav@cloudforge.dev');

    const createRes = await request(app)
      .post('/api/architectures')
      .set('Cookie', cookie)
      .send({ name: 'Phase 05 Relationships Arch' });
    const archId = createRes.body.data.id as string;

    const node1 = makeSampleNode('node-alb-1', { label: 'Public ALB', resourceName: 'ALB' });
    const node2 = makeSampleNode('node-ec2-1', { label: 'App EC2', resourceName: 'EC2' });

    // Save Phase 05 relationship edge
    const saveRes = await request(app)
      .put(`/api/architectures/${archId}/canvas`)
      .set('Cookie', cookie)
      .send({
        nodes: [node1, node2],
        edges: [
          {
            id: 'edge-rel-1',
            source: 'node-alb-1',
            target: 'node-ec2-1',
            type: 'relationship',
            data: {
              relationshipType: 'load-balances-to',
              direction: 'source-to-target',
              label: 'HTTPS Forward',
              metadata: {
                protocol: 'HTTPS',
                port: 443,
                description: 'Forwards TLS traffic to target group',
              },
            },
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.data.edges[0]).toMatchObject({
      id: 'edge-rel-1',
      type: 'relationship',
      data: {
        relationshipType: 'load-balances-to',
        direction: 'source-to-target',
        label: 'HTTPS Forward',
        metadata: {
          protocol: 'HTTPS',
          port: 443,
          description: 'Forwards TLS traffic to target group',
        },
      },
    });

    // Reject invalid port > 65535
    const invalidPortRes = await request(app)
      .put(`/api/architectures/${archId}/canvas`)
      .set('Cookie', cookie)
      .send({
        nodes: [node1, node2],
        edges: [
          {
            id: 'edge-rel-bad',
            source: 'node-alb-1',
            target: 'node-ec2-1',
            type: 'relationship',
            data: {
              relationshipType: 'sends-traffic-to',
              direction: 'source-to-target',
              metadata: { port: 70000 },
            },
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      });

    expect(invalidPortRes.status).toBe(400);
    expect(invalidPortRes.body.success).toBe(false);
  });

  it('persists Phase 06 dynamic node configuration metadata (instance types, CIDRs, IAM roles, storage) and reloads cleanly', async () => {
    const cookie = await registerAndGetCookie('Aarav Sharma', 'aarav@cloudforge.dev');

    const createRes = await request(app)
      .post('/api/architectures')
      .set('Cookie', cookie)
      .send({ name: 'Phase 06 Configuration Arch' });
    const archId = createRes.body.data.id as string;

    const vpcNode = {
      id: 'node-vpc-100',
      type: 'awsResource' as const,
      position: { x: 50, y: 50 },
      data: {
        serviceId: 'svc-vpc',
        serviceSlug: 'amazon-vpc',
        serviceName: 'Amazon VPC',
        categorySlug: 'networking-content-delivery',
        categoryName: 'Networking & Content Delivery',
        iconKey: 'vpc',
        resourceName: 'VPC',
        resourceType: 'aws_vpc',
        label: 'Production VPC',
        description: 'Core VPC container',
        metadata: {
          vpc_name: 'prod-core-vpc',
          cidr_block: '10.100.0.0/16',
          enable_dns_support: true,
          enable_dns_hostnames: true,
          instance_tenancy: 'default',
        },
      },
    };

    const ec2Node = {
      id: 'node-ec2-200',
      type: 'awsResource' as const,
      position: { x: 250, y: 150 },
      data: {
        serviceId: 'svc-ec2',
        serviceSlug: 'amazon-ec2',
        serviceName: 'Amazon EC2',
        categorySlug: 'compute',
        categoryName: 'Compute',
        iconKey: 'ec2',
        resourceName: 'EC2 Instance',
        resourceType: 'aws_instance',
        label: 'App Server',
        description: 'Primary web server node',
        metadata: {
          instance_name: 'prod-web-01',
          ami: 'ami-0c55b159cbfafe1f0',
          instance_type: 't3.medium',
          vpc_id: 'node-vpc-100',
          monitoring: true,
          root_volume_type: 'gp3',
          root_volume_size: 40,
          root_encrypted: true,
        },
      },
    };

    const saveRes = await request(app)
      .put(`/api/architectures/${archId}/canvas`)
      .set('Cookie', cookie)
      .send({
        nodes: [vpcNode, ec2Node],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.data.nodes[0].data.metadata).toMatchObject({
      vpc_name: 'prod-core-vpc',
      cidr_block: '10.100.0.0/16',
      enable_dns_support: true,
    });
    expect(saveRes.body.data.nodes[1].data.metadata).toMatchObject({
      instance_name: 'prod-web-01',
      instance_type: 't3.medium',
      vpc_id: 'node-vpc-100',
      root_volume_size: 40,
    });

    // Reload from GET /api/architectures/:id
    const reloadRes = await request(app)
      .get(`/api/architectures/${archId}`)
      .set('Cookie', cookie);

    expect(reloadRes.status).toBe(200);
    const reloadedVpc = reloadRes.body.data.nodes.find((n: { id: string }) => n.id === 'node-vpc-100');
    const reloadedEc2 = reloadRes.body.data.nodes.find((n: { id: string }) => n.id === 'node-ec2-200');

    expect(reloadedVpc.data.metadata.cidr_block).toBe('10.100.0.0/16');
    expect(reloadedEc2.data.metadata.instance_type).toBe('t3.medium');
    expect(reloadedEc2.data.metadata.root_volume_size).toBe(40);
  });
});
