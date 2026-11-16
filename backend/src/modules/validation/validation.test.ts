import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchitectureValidationEngine } from './engine/validationEngine.js';
import { validationRegistry } from './engine/validationRegistry.js';
import { computeSubnetPlacementRule, internetGatewayAttachmentRule, subnetVpcContainmentRule } from './rules/structuralRules.js';
import { cidrFormatRule, natGatewayPublicPlacementRule, subnetCidrContainmentRule, subnetCidrOverlapRule } from './rules/networkRules.js';
import { publicRdsInstanceRule, s3PublicAccessBlockRule, storageEncryptionRule, unrestrictedManagementPortsRule, wildcardIamPermissionsRule } from './rules/securityRules.js';
import { albMultiAzSubnetsRule, automatedBackupRetentionRule, multiAzDatabaseRule } from './rules/reliabilityRules.js';
import { ValidationService } from './validation.service.js';
import { architectureEdgesArraySchema, findIncompatibleEdges } from '../architecture-edges/edgeValidation.js';
import { architectureNodesArraySchema } from '../architecture-nodes/nodeValidation.js';

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

const { mockArchitectures, mockPrisma } = vi.hoisted(() => {
  const architectures: StoredArchitecture[] = [];
  const prismaMock = {
    architecture: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return architectures.find((a) => a.id === where.id) ?? null;
      }),
    },
  };
  return { mockArchitectures: architectures, mockPrisma: prismaMock };
});

vi.mock('../../config/database.js', () => ({
  prisma: mockPrisma,
  checkDatabaseConnection: vi.fn(async () => ({ connected: true, latencyMs: 1.0 })),
  disconnectDatabase: vi.fn(async () => undefined),
}));

describe('AWS Architecture Validation Engine (Phase 07)', () => {
  beforeEach(() => {
    mockArchitectures.length = 0;
    vi.clearAllMocks();
  });

  describe('Validation Rule Registry', () => {
    it('registers all 12 core rules across structural, network, security, and reliability', () => {
      const allRules = validationRegistry.getAllRules();
      expect(allRules.length).toBeGreaterThanOrEqual(12);

      const metadata = validationRegistry.getAllMetadata();
      const categories = new Set(metadata.map((m) => m.category));
      expect(categories).toContain('structural');
      expect(categories).toContain('network');
      expect(categories).toContain('security');
      expect(categories).toContain('reliability');

      const rule = validationRegistry.getRule('STRUCT-001');
      expect(rule).toBeDefined();
      expect(rule?.metadata.title).toBe('Subnet Must Belong to a VPC');
    });

    it('throws 404 ApiError when requested rule does not exist', () => {
      expect(() => ValidationService.getRule('NON_EXISTENT')).toThrow(/not found/i);
    });
  });

  describe('Structural Rules', () => {
    it('STRUCT-001: detects orphaned subnets without a parent VPC', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'subnet-1',
            type: 'awsResource',
            data: { resourceType: 'aws_subnet', label: 'Isolated Subnet' },
          },
        ],
        edges: [],
      };

      const findings = subnetVpcContainmentRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('STRUCT-001');
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].affectedNodeIds).toContain('subnet-1');
    });

    it('STRUCT-002: detects compute/DB resources not placed in a subnet', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'ec2-1',
            type: 'awsResource',
            data: { resourceType: 'aws_instance', label: 'App Worker' },
          },
        ],
        edges: [],
      };

      const findings = computeSubnetPlacementRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('STRUCT-002');
      expect(findings[0].affectedNodeIds).toContain('ec2-1');
    });

    it('STRUCT-003: detects Internet Gateway not attached to a VPC', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'igw-1',
            type: 'awsResource',
            data: { resourceType: 'aws_internet_gateway', label: 'Orphaned IGW' },
          },
        ],
        edges: [],
      };

      const findings = internetGatewayAttachmentRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('STRUCT-003');
      expect(findings[0].affectedNodeIds).toContain('igw-1');
    });
  });

  describe('Network Rules', () => {
    it('NET-003: flags invalid CIDR formats and reports unconfigured CIDR as unknown', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'vpc-bad',
            type: 'awsResource',
            data: { resourceType: 'aws_vpc', metadata: { cidr_block: '999.999.0.0/16' } },
          },
          {
            id: 'vpc-missing',
            type: 'awsResource',
            data: { resourceType: 'aws_vpc', metadata: {} },
          },
        ],
        edges: [],
      };

      const findings = cidrFormatRule.evaluate(context);
      expect(findings).toHaveLength(2);
      const invalidFinding = findings.find((f) => f.status === 'invalid');
      const unknownFinding = findings.find((f) => f.status === 'unknown');
      expect(invalidFinding?.affectedNodeIds).toContain('vpc-bad');
      expect(unknownFinding?.affectedNodeIds).toContain('vpc-missing');
    });

    it('NET-001: validates that Subnet CIDR is mathematically contained in VPC CIDR', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'vpc-1',
            type: 'awsResource',
            data: { resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
          },
          {
            id: 'subnet-out-of-range',
            type: 'awsResource',
            data: { resourceType: 'aws_subnet', label: 'Foreign Subnet', metadata: { cidr_block: '192.168.1.0/24' } },
          },
        ],
        edges: [
          {
            id: 'e-1',
            source: 'vpc-1',
            target: 'subnet-out-of-range',
            data: { relationshipType: 'contains' },
          },
        ],
      };

      const findings = subnetCidrContainmentRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('NET-001');
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].affectedNodeIds).toContain('subnet-out-of-range');
      expect(findings[0].affectedNodeIds).toContain('vpc-1');
    });

    it('NET-002: detects overlapping subnets within the same VPC', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'vpc-1',
            type: 'awsResource',
            data: { resourceType: 'aws_vpc', label: 'Main VPC', metadata: { cidr_block: '10.0.0.0/16' } },
          },
          {
            id: 'sub-1',
            type: 'awsResource',
            data: { resourceType: 'aws_subnet', label: 'Subnet A', metadata: { cidr_block: '10.0.1.0/24' } },
          },
          {
            id: 'sub-2',
            type: 'awsResource',
            data: { resourceType: 'aws_subnet', label: 'Subnet B', metadata: { cidr_block: '10.0.1.128/25' } },
          },
        ],
        edges: [
          { id: 'e-1', source: 'vpc-1', target: 'sub-1' },
          { id: 'e-2', source: 'vpc-1', target: 'sub-2' },
        ],
      };

      const findings = subnetCidrOverlapRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('NET-002');
      expect(findings[0].affectedNodeIds).toEqual(expect.arrayContaining(['sub-1', 'sub-2']));
    });

    it('NET-005: detects NAT Gateway placed in private subnet with no IGW route', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'subnet-priv',
            type: 'awsResource',
            data: { resourceType: 'aws_subnet', label: 'Private Subnet' },
          },
          {
            id: 'nat-1',
            type: 'awsResource',
            data: { resourceType: 'aws_nat_gateway', label: 'NAT GW' },
          },
        ],
        edges: [
          { id: 'e-1', source: 'subnet-priv', target: 'nat-1', data: { relationshipType: 'contains' } },
        ],
      };

      const findings = natGatewayPublicPlacementRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('NET-005');
      expect(findings[0].affectedNodeIds).toContain('nat-1');
    });
  });

  describe('Security Rules', () => {
    it('SEC-001: detects publicly accessible RDS database instances', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'db-1',
            type: 'awsResource',
            data: {
              resourceType: 'aws_db_instance',
              label: 'Public DB',
              metadata: { publicly_accessible: true },
            },
          },
        ],
        edges: [],
      };

      const findings = publicRdsInstanceRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('SEC-001');
      expect(findings[0].severity).toBe('critical');
    });

    it('SEC-002: detects 0.0.0.0/0 ingress to port 22 or port 3389', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'sg-1',
            type: 'awsResource',
            data: {
              resourceType: 'aws_security_group',
              label: 'SSH Public SG',
              metadata: {
                ingress_rules: [
                  { from_port: 22, to_port: 22, protocol: 'tcp', cidr_blocks: '0.0.0.0/0' },
                ],
              },
            },
          },
        ],
        edges: [],
      };

      const findings = unrestrictedManagementPortsRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('SEC-002');
      expect(findings[0].severity).toBe('critical');
    });

    it('SEC-003: detects S3 bucket with public access block disabled', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 's3-1',
            type: 'awsResource',
            data: {
              resourceType: 'aws_s3_bucket',
              label: 'Public S3',
              metadata: { block_public_acls: false },
            },
          },
        ],
        edges: [],
      };

      const findings = s3PublicAccessBlockRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('SEC-003');
    });

    it('SEC-004: detects unencrypted EBS volumes and RDS storage', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'ebs-1',
            type: 'awsResource',
            data: {
              resourceType: 'aws_ebs_volume',
              label: 'Plain EBS',
              metadata: { encrypted: false },
            },
          },
          {
            id: 'rds-1',
            type: 'awsResource',
            data: {
              resourceType: 'aws_db_instance',
              label: 'Plain RDS',
              metadata: { storage_encrypted: false },
            },
          },
        ],
        edges: [],
      };

      const findings = storageEncryptionRule.evaluate(context);
      expect(findings).toHaveLength(2);
      expect(findings.every((f) => f.ruleId === 'SEC-004')).toBe(true);
    });

    it('SEC-005: detects wildcard administrative IAM policies', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'iam-1',
            type: 'awsResource',
            data: {
              resourceType: 'aws_iam_policy',
              label: 'Admin Policy',
              metadata: {
                policy_document: '{"Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}',
              },
            },
          },
        ],
        edges: [],
      };

      const findings = wildcardIamPermissionsRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('SEC-005');
      expect(findings[0].severity).toBe('critical');
    });
  });

  describe('Reliability Rules', () => {
    it('REL-001: detects Single-AZ database deployments', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'rds-single',
            type: 'awsResource',
            data: {
              resourceType: 'aws_db_instance',
              label: 'Single AZ DB',
              metadata: { multi_az: false },
            },
          },
        ],
        edges: [],
      };

      const findings = multiAzDatabaseRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('REL-001');
    });

    it('REL-002: detects disabled automated backups on RDS instances', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'rds-no-backup',
            type: 'awsResource',
            data: {
              resourceType: 'aws_db_instance',
              label: 'No Backup DB',
              metadata: { backup_retention_period: 0 },
            },
          },
        ],
        edges: [],
      };

      const findings = automatedBackupRetentionRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('REL-002');
    });

    it('REL-003: detects Application Load Balancers with fewer than 2 subnets', () => {
      const context = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'alb-1',
            type: 'awsResource',
            data: { resourceType: 'aws_lb', label: 'Single Subnet ALB' },
          },
          {
            id: 'sub-1',
            type: 'awsResource',
            data: { resourceType: 'aws_subnet', label: 'Subnet 1' },
          },
        ],
        edges: [
          { id: 'e-1', source: 'alb-1', target: 'sub-1' },
        ],
      };

      const findings = albMultiAzSubnetsRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('REL-003');
    });
  });

  describe('ArchitectureValidationEngine & ValidationService', () => {
    it('aggregates summary counts, classifies status, and enforces user ownership', async () => {
      const arch = {
        id: 'arch-100',
        userId: 'user-alice',
        name: 'Mixed Quality Arch',
        description: null,
        region: 'us-east-1',
        status: 'draft',
        resourceCount: 2,
        nodes: [
          {
            id: 'vpc-1',
            type: 'awsResource',
            data: { resourceType: 'aws_vpc', metadata: { cidr_block: '10.0.0.0/16' } },
          },
          {
            id: 'sub-orphan',
            type: 'awsResource',
            data: { resourceType: 'aws_subnet', metadata: { cidr_block: '10.0.1.0/24' } },
          },
        ],
        edges: [], // Subnet is not connected to VPC
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockArchitectures.push(arch);

      // Alice validates successfully
      const result = await ValidationService.validateArchitecture('arch-100', 'user-alice');
      expect(result.architectureId).toBe('arch-100');
      expect(result.summary.criticalCount).toBeGreaterThan(0);
      expect(result.summary.status).toBe('invalid');

      // Bob is forbidden
      await expect(
        ValidationService.validateArchitecture('arch-100', 'user-bob'),
      ).rejects.toThrow(/access|permission/i);

      // Validation results retrieval
      const fetched = await ValidationService.getValidationResults('arch-100', 'user-alice');
      expect(fetched.summary.totalFindings).toBe(result.summary.totalFindings);
    });

    it('A3-01: invalidates validation cache when architecture is updated or explicitly invalidated', async () => {
      const initialUpdatedAt = new Date('2026-01-01T10:00:00Z');
      const arch = {
        id: 'arch-cache-test',
        userId: 'user-alice',
        name: 'Cache Test Arch',
        description: null,
        region: 'us-east-1',
        status: 'draft',
        resourceCount: 1,
        nodes: [
          {
            id: 'vpc-1',
            type: 'awsResource',
            data: { resourceType: 'aws_vpc', metadata: { cidr_block: '10.0.0.0/16' } },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: initialUpdatedAt,
        updatedAt: initialUpdatedAt,
      };
      mockArchitectures.push(arch);

      // 1. Initial validation caches result
      const res1 = await ValidationService.validateArchitecture('arch-cache-test', 'user-alice');
      expect(ValidationService.hasFreshCache('arch-cache-test', arch.updatedAt)).toBe(true);

      // 2. Retrieval returns cached result when updatedAt has not changed
      const resCached = await ValidationService.getValidationResults('arch-cache-test', 'user-alice');
      expect(resCached).toBe(res1);

      // 3. Architecture updatedAt is advanced (simulating an edit)
      arch.updatedAt = new Date('2026-01-01T10:05:00Z');
      expect(ValidationService.hasFreshCache('arch-cache-test', arch.updatedAt)).toBe(false);

      // 4. getValidationResults detects stale cache and re-validates fresh state
      const resFresh = await ValidationService.getValidationResults('arch-cache-test', 'user-alice');
      expect(resFresh).not.toBe(res1);
      expect(ValidationService.hasFreshCache('arch-cache-test', arch.updatedAt)).toBe(true);

      // 5. Explicit invalidation removes entry
      ValidationService.invalidateCache('arch-cache-test');
      expect(ValidationService.hasFreshCache('arch-cache-test', arch.updatedAt)).toBe(false);

      // 6. Global clear removes all entries
      await ValidationService.validateArchitecture('arch-cache-test', 'user-alice');
      expect(ValidationService.hasFreshCache('arch-cache-test', arch.updatedAt)).toBe(true);
      ValidationService.clearCache();
      expect(ValidationService.hasFreshCache('arch-cache-test', arch.updatedAt)).toBe(false);
    });
  });

  describe('A3-07: Relationship Type and Direction Validation', () => {
    it('STRUCT-001: accepts valid VPC -> Subnet contains edge, rejects invalid relationship types and reversed directions', () => {
      const vpcNode = {
        id: 'vpc-1',
        type: 'awsResource',
        data: { resourceType: 'aws_vpc', label: 'VPC' },
      };
      const subnetNode = {
        id: 'sub-1',
        type: 'awsResource',
        data: { resourceType: 'aws_subnet', label: 'Subnet' },
      };

      // 1. Valid contains relationship from VPC to Subnet
      const validCtx = {
        architectureId: 'arch-1',
        nodes: [vpcNode, subnetNode],
        edges: [
          {
            id: 'e-1',
            source: 'vpc-1',
            target: 'sub-1',
            data: { relationshipType: 'contains' as const, direction: 'source-to-target' as const },
          },
        ],
      };
      expect(subnetVpcContainmentRule.evaluate(validCtx)).toHaveLength(0);

      // 2. Invalid relationship type (sends-traffic-to does not establish VPC containment)
      const invalidRelCtx = {
        architectureId: 'arch-1',
        nodes: [vpcNode, subnetNode],
        edges: [
          {
            id: 'e-bad-rel',
            source: 'vpc-1',
            target: 'sub-1',
            data: { relationshipType: 'sends-traffic-to' as const, direction: 'source-to-target' as const },
          },
        ],
      };
      const invalidRelFindings = subnetVpcContainmentRule.evaluate(invalidRelCtx);
      expect(invalidRelFindings).toHaveLength(1);
      expect(invalidRelFindings[0].ruleId).toBe('STRUCT-001');

      // 3. Reversed direction (target-to-source implies Subnet contains VPC)
      const reversedDirCtx = {
        architectureId: 'arch-1',
        nodes: [vpcNode, subnetNode],
        edges: [
          {
            id: 'e-rev',
            source: 'vpc-1',
            target: 'sub-1',
            data: { relationshipType: 'contains' as const, direction: 'target-to-source' as const },
          },
        ],
      };
      const revFindings = subnetVpcContainmentRule.evaluate(reversedDirCtx);
      expect(revFindings).toHaveLength(1);
      expect(revFindings[0].ruleId).toBe('STRUCT-001');

      // 4. Valid Subnet -> VPC with attached-to
      const validAttachedCtx = {
        architectureId: 'arch-1',
        nodes: [vpcNode, subnetNode],
        edges: [
          {
            id: 'e-attached',
            source: 'sub-1',
            target: 'vpc-1',
            data: { relationshipType: 'attached-to' as const, direction: 'source-to-target' as const },
          },
        ],
      };
      expect(subnetVpcContainmentRule.evaluate(validAttachedCtx)).toHaveLength(0);
    });

    it('STRUCT-002: verifies compute placement checks relationshipType and rejects non-containment edges', () => {
      const subnetNode = {
        id: 'sub-1',
        type: 'awsResource',
        data: { resourceType: 'aws_subnet', label: 'Subnet' },
      };
      const ec2Node = {
        id: 'ec2-1',
        type: 'awsResource',
        data: { resourceType: 'aws_instance', label: 'Web Server' },
      };

      // Valid Subnet contains EC2
      const validCtx = {
        architectureId: 'arch-1',
        nodes: [subnetNode, ec2Node],
        edges: [
          {
            id: 'e-1',
            source: 'sub-1',
            target: 'ec2-1',
            data: { relationshipType: 'contains' as const },
          },
        ],
      };
      expect(computeSubnetPlacementRule.evaluate(validCtx)).toHaveLength(0);

      // Invalid: sends-traffic-to does not place compute in subnet
      const invalidCtx = {
        architectureId: 'arch-1',
        nodes: [subnetNode, ec2Node],
        edges: [
          {
            id: 'e-traffic',
            source: 'sub-1',
            target: 'ec2-1',
            data: { relationshipType: 'sends-traffic-to' as const },
          },
        ],
      };
      expect(computeSubnetPlacementRule.evaluate(invalidCtx)).toHaveLength(1);
    });

    it('STRUCT-003: rejects invalid relationship types between IGW and VPC', () => {
      const vpcNode = {
        id: 'vpc-1',
        type: 'awsResource',
        data: { resourceType: 'aws_vpc', label: 'VPC' },
      };
      const igwNode = {
        id: 'igw-1',
        type: 'awsResource',
        data: { resourceType: 'aws_internet_gateway', label: 'IGW' },
      };

      // Valid: attached-to
      const validCtx = {
        architectureId: 'arch-1',
        nodes: [vpcNode, igwNode],
        edges: [
          {
            id: 'e-1',
            source: 'igw-1',
            target: 'vpc-1',
            data: { relationshipType: 'attached-to' as const },
          },
        ],
      };
      expect(internetGatewayAttachmentRule.evaluate(validCtx)).toHaveLength(0);

      // Invalid: routes-to from IGW to VPC is not an attachment relationship
      const invalidCtx = {
        architectureId: 'arch-1',
        nodes: [vpcNode, igwNode],
        edges: [
          {
            id: 'e-bad',
            source: 'igw-1',
            target: 'vpc-1',
            data: { relationshipType: 'routes-to' as const },
          },
        ],
      };
      expect(internetGatewayAttachmentRule.evaluate(invalidCtx)).toHaveLength(1);
    });

    it('NET-005: verifies route path from NAT Gateway subnet to Internet Gateway', () => {
      const igwNode = {
        id: 'igw-1',
        type: 'awsResource',
        data: { resourceType: 'aws_internet_gateway', label: 'IGW' },
      };
      const pubSubnet = {
        id: 'sub-pub',
        type: 'awsResource',
        data: { resourceType: 'aws_subnet', label: 'Public Subnet' },
      };
      const natNode = {
        id: 'nat-1',
        type: 'awsResource',
        data: { resourceType: 'aws_nat_gateway', label: 'NAT GW' },
      };

      // Valid: NAT in Subnet, Subnet routes to IGW
      const validCtx = {
        architectureId: 'arch-1',
        nodes: [igwNode, pubSubnet, natNode],
        edges: [
          { id: 'e-nat', source: 'sub-pub', target: 'nat-1', data: { relationshipType: 'contains' as const } },
          { id: 'e-route', source: 'sub-pub', target: 'igw-1', data: { relationshipType: 'routes-to' as const } },
        ],
      };
      expect(natGatewayPublicPlacementRule.evaluate(validCtx)).toHaveLength(0);

      // Invalid: Subnet has unrelated relationship to IGW (e.g. sends-traffic-to instead of routes-to)
      const invalidCtx = {
        architectureId: 'arch-1',
        nodes: [igwNode, pubSubnet, natNode],
        edges: [
          { id: 'e-nat', source: 'sub-pub', target: 'nat-1', data: { relationshipType: 'contains' as const } },
          { id: 'e-bad-route', source: 'sub-pub', target: 'igw-1', data: { relationshipType: 'sends-traffic-to' as const } },
        ],
      };
      expect(natGatewayPublicPlacementRule.evaluate(invalidCtx)).toHaveLength(1);
    });
  });

  describe('A3-16: Missing RDS Configuration Validation', () => {
    it('REL-001: produces unknown finding for missing Multi-AZ and invalid for explicit false', () => {
      // 1. Missing multi_az (undefined) -> status: 'unknown', severity: 'medium'
      const unspecCtx = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'rds-unspec',
            type: 'awsResource',
            data: { resourceType: 'aws_db_instance', label: 'Unspecified RDS', metadata: {} },
          },
        ],
        edges: [],
      };
      const unspecFindings = multiAzDatabaseRule.evaluate(unspecCtx);
      expect(unspecFindings).toHaveLength(1);
      expect(unspecFindings[0].ruleId).toBe('REL-001');
      expect(unspecFindings[0].status).toBe('unknown');
      expect(unspecFindings[0].severity).toBe('medium');

      // 2. Explicitly false -> status: 'invalid', severity: 'medium'
      const singleAzCtx = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'rds-single',
            type: 'awsResource',
            data: { resourceType: 'aws_db_instance', label: 'Single-AZ RDS', metadata: { multi_az: false } },
          },
        ],
        edges: [],
      };
      const singleFindings = multiAzDatabaseRule.evaluate(singleAzCtx);
      expect(singleFindings).toHaveLength(1);
      expect(singleFindings[0].status).toBe('invalid');

      // 3. Explicitly true -> compliant (no findings)
      const multiAzCtx = {
        architectureId: 'arch-1',
        nodes: [
          {
            id: 'rds-multi',
            type: 'awsResource',
            data: { resourceType: 'aws_db_instance', label: 'Multi-AZ RDS', metadata: { multi_az: true } },
          },
        ],
        edges: [],
      };
      expect(multiAzDatabaseRule.evaluate(multiAzCtx)).toHaveLength(0);
    });

    it('REL-002: evaluates granular validation states across all input combinations (A3-16)', () => {
      const evaluateRetention = (val: unknown) => {
        const ctx = {
          architectureId: 'arch-1',
          nodes: [
            {
              id: 'rds-test-node',
              type: 'awsResource' as const,
              data: {
                resourceType: 'aws_db_instance',
                label: 'Test RDS',
                metadata: val !== undefined ? { backup_retention_period: val } : {},
              },
            },
          ],
          edges: [],
        };
        return automatedBackupRetentionRule.evaluate(ctx);
      };

      // 1. Missing / undefined -> UNKNOWN (medium)
      const resUndefined = evaluateRetention(undefined);
      expect(resUndefined).toHaveLength(1);
      expect(resUndefined[0].status).toBe('unknown');
      expect(resUndefined[0].severity).toBe('medium');

      // 2. null -> UNKNOWN (medium)
      const resNull = evaluateRetention(null);
      expect(resNull).toHaveLength(1);
      expect(resNull[0].status).toBe('unknown');
      expect(resNull[0].severity).toBe('medium');

      // 3. empty string "" -> UNKNOWN (medium)
      const resEmpty = evaluateRetention('');
      expect(resEmpty).toHaveLength(1);
      expect(resEmpty[0].status).toBe('unknown');
      expect(resEmpty[0].severity).toBe('medium');

      // 4. 0 (backups explicitly disabled) -> INVALID (high)
      const resZero = evaluateRetention(0);
      expect(resZero).toHaveLength(1);
      expect(resZero[0].status).toBe('invalid');
      expect(resZero[0].severity).toBe('high');
      expect(resZero[0].message).toMatch(/backups disabled/i);

      // 5. Non-numeric string "invalid" -> INVALID (high)
      const resNonNumeric = evaluateRetention('invalid');
      expect(resNonNumeric).toHaveLength(1);
      expect(resNonNumeric[0].status).toBe('invalid');
      expect(resNonNumeric[0].severity).toBe('high');
      expect(resNonNumeric[0].message).toMatch(/invalid non-numeric/i);

      // 6. Fractional number 1.5 -> INVALID (high)
      const resFractional = evaluateRetention(1.5);
      expect(resFractional).toHaveLength(1);
      expect(resFractional[0].status).toBe('invalid');
      expect(resFractional[0].severity).toBe('high');
      expect(resFractional[0].message).toMatch(/fractional/i);

      // 7. Negative number -1 -> INVALID (high)
      const resNegative = evaluateRetention(-1);
      expect(resNegative).toHaveLength(1);
      expect(resNegative[0].status).toBe('invalid');
      expect(resNegative[0].severity).toBe('high');
      expect(resNegative[0].message).toMatch(/negative/i);

      // 8. Greater than 35 days (36) -> INVALID (high)
      const resOver35 = evaluateRetention(36);
      expect(resOver35).toHaveLength(1);
      expect(resOver35[0].status).toBe('invalid');
      expect(resOver35[0].severity).toBe('high');
      expect(resOver35[0].message).toMatch(/exceeding AWS maximum/i);

      // 9. 1 day -> UNKNOWN (medium policy warning: below recommended 7 days)
      const resOne = evaluateRetention(1);
      expect(resOne).toHaveLength(1);
      expect(resOne[0].status).toBe('unknown');
      expect(resOne[0].severity).toBe('medium');
      expect(resOne[0].message).toMatch(/below the recommended 7 days/i);

      // 10. 6 days -> UNKNOWN (medium policy warning: below recommended 7 days)
      const resSix = evaluateRetention(6);
      expect(resSix).toHaveLength(1);
      expect(resSix[0].status).toBe('unknown');
      expect(resSix[0].severity).toBe('medium');
      expect(resSix[0].message).toMatch(/below the recommended 7 days/i);

      // 11. 7 days -> COMPLIANT (0 findings)
      expect(evaluateRetention(7)).toHaveLength(0);

      // 12. 35 days -> COMPLIANT (0 findings)
      expect(evaluateRetention(35)).toHaveLength(0);

      // 13. String integer "7" -> COMPLIANT (0 findings)
      expect(evaluateRetention('7')).toHaveLength(0);
    });

    it('A3-01: ValidationService ensures concurrency safety and deduplication', async () => {
      const archId = 'arch-concurrency-test';
      const userId = 'user-concurrent-1';
      const baseDate = new Date('2026-03-01T10:00:00.000Z');

      mockArchitectures.push({
        id: archId,
        userId,
        name: 'Concurrency Test Arch',
        description: null,
        region: 'us-east-1',
        status: 'draft',
        resourceCount: 1,
        nodes: [
          {
            id: 'vpc-node',
            type: 'awsResource',
            data: { resourceType: 'aws_vpc', label: 'VPC', metadata: { cidr_block: '10.0.0.0/16' } },
          },
        ],
        edges: [],
        viewport: null,
        createdAt: baseDate,
        updatedAt: baseDate,
      });

      ValidationService.clearCache();

      // 1. In-flight request deduplication: concurrent calls share the exact same promise
      const promise1 = ValidationService.validateArchitecture(archId, userId);
      const promise2 = ValidationService.validateArchitecture(archId, userId);
      expect(promise1).toBe(promise2);

      const [res1, res2] = await Promise.all([promise1, promise2]);
      expect(res1).toEqual(res2);
      expect(ValidationService.hasFreshCache(archId, baseDate)).toBe(true);

      // 2. Stale write prevention: cache invalidation while in-flight prevents stale results from caching
      ValidationService.invalidateCache(archId);
      expect(ValidationService.hasFreshCache(archId, baseDate)).toBe(false);

      // 3. Clear cache wipes all entries
      await ValidationService.validateArchitecture(archId, userId);
      expect(ValidationService.hasFreshCache(archId, baseDate)).toBe(true);
      ValidationService.clearCache();
      expect(ValidationService.hasFreshCache(archId, baseDate)).toBe(false);
    });

    it('A3-15: Complete Edge Compatibility Matrix validates pairwise combinations across AWS categories', () => {
      const makeNode = (id: string, resourceType: string, resourceName: string) => ({
        id,
        type: 'awsResource' as const,
        position: { x: 0, y: 0 },
        data: {
          serviceId: `svc-${resourceType}`,
          serviceSlug: resourceType,
          serviceName: resourceName,
          categorySlug: 'compute',
          categoryName: 'Compute',
          iconKey: resourceType,
          resourceName,
          resourceType,
          label: resourceName,
          description: '',
          metadata: {},
        },
      });

      const vpc = makeNode('n-vpc', 'aws_vpc', 'VPC');
      const subnet = makeNode('n-sub', 'aws_subnet', 'Subnet');
      const ec2 = makeNode('n-ec2', 'aws_instance', 'EC2 Instance');
      const rds = makeNode('n-rds', 'aws_db_instance', 'RDS Database');
      const s3 = makeNode('n-s3', 'aws_s3_bucket', 'S3 Bucket');
      const alb = makeNode('n-alb', 'aws_lb', 'Application Load Balancer');
      const lambda = makeNode('n-lambda', 'aws_lambda_function', 'Lambda Function');
      const dynamo = makeNode('n-dynamo', 'aws_dynamodb_table', 'DynamoDB Table');

      // Valid: VPC contains Subnet
      const edgesVpcSub = [
        { id: 'e1', source: 'n-vpc', target: 'n-sub', data: { relationshipType: 'contains' as const } },
      ];
      expect(findIncompatibleEdges(edgesVpcSub, [vpc, subnet])).toHaveLength(0);

      // Valid: Subnet contains EC2
      const edgesSubEc2 = [
        { id: 'e2', source: 'n-sub', target: 'n-ec2', data: { relationshipType: 'contains' as const } },
      ];
      expect(findIncompatibleEdges(edgesSubEc2, [subnet, ec2])).toHaveLength(0);

      // Valid: EC2 connects-to RDS
      const edgesEc2Rds = [
        { id: 'e3', source: 'n-ec2', target: 'n-rds', data: { relationshipType: 'connects-to' as const } },
      ];
      expect(findIncompatibleEdges(edgesEc2Rds, [ec2, rds])).toHaveLength(0);

      // Valid: ALB load-balances-to EC2
      const edgesAlbEc2 = [
        { id: 'e4', source: 'n-alb', target: 'n-ec2', data: { relationshipType: 'load-balances-to' as const } },
      ];
      expect(findIncompatibleEdges(edgesAlbEc2, [alb, ec2])).toHaveLength(0);

      // Valid: Lambda accesses DynamoDB
      const edgesLambdaDynamo = [
        { id: 'e5', source: 'n-lambda', target: 'n-dynamo', data: { relationshipType: 'accesses' as const } },
      ];
      expect(findIncompatibleEdges(edgesLambdaDynamo, [lambda, dynamo])).toHaveLength(0);

      // Invalid: Leaf S3 cannot contain VPC
      const edgesS3Vpc = [
        { id: 'e-bad1', source: 'n-s3', target: 'n-vpc', data: { relationshipType: 'contains' as const } },
      ];
      const badS3Res = findIncompatibleEdges(edgesS3Vpc, [s3, vpc]);
      expect(badS3Res).toHaveLength(1);
      expect(badS3Res[0].reason).toMatch(/cannot contain|not a container boundary/i);

      // Invalid: EC2 cannot contain Subnet
      const edgesEc2Sub = [
        { id: 'e-bad2', source: 'n-ec2', target: 'n-sub', data: { relationshipType: 'contains' as const } },
      ];
      const badEc2Res = findIncompatibleEdges(edgesEc2Sub, [ec2, subnet]);
      expect(badEc2Res).toHaveLength(1);
      expect(badEc2Res[0].reason).toMatch(/cannot contain|not a container boundary/i);

      // Legacy normalization: traffic-flow converts to sends-traffic-to
      const edgesLegacy = [
        { id: 'e-leg', source: 'n-ec2', target: 'n-rds', data: { relationshipType: 'traffic-flow' as const } },
      ];
      const parsedLegacy = architectureEdgesArraySchema.safeParse(edgesLegacy);
      expect(parsedLegacy.success).toBe(true);
      if (parsedLegacy.success) {
        expect(parsedLegacy.data[0].data?.relationshipType).toBe('sends-traffic-to');
      }
    });

    it('A3-14: Complete Parent-Child Hierarchy rejects leaf parents, cycles, and invalid pairs order-independently', () => {
      const makeNodeDto = (id: string, resourceType: string, resourceName: string, parentId?: string | null) => ({
        id,
        type: 'awsResource' as const,
        position: { x: 0, y: 0 },
        parentId: parentId ?? undefined,
        extent: parentId ? ('parent' as const) : undefined,
        data: {
          serviceId: `svc-${resourceType}`,
          serviceSlug: resourceType,
          serviceName: resourceName,
          categorySlug: 'compute',
          categoryName: 'Compute',
          iconKey: resourceType,
          resourceName,
          resourceType,
          label: resourceName,
          description: '',
          metadata: {},
        },
      });

      // 1. Valid VPC -> Subnet -> EC2
      const validHierarchy = [
        makeNodeDto('vpc-1', 'aws_vpc', 'VPC'),
        makeNodeDto('sub-1', 'aws_subnet', 'Subnet', 'vpc-1'),
        makeNodeDto('ec2-1', 'aws_instance', 'EC2 Instance', 'sub-1'),
      ];
      expect(architectureNodesArraySchema.safeParse(validHierarchy).success).toBe(true);

      // 2. Order independence: child appears BEFORE parent in array
      const shuffledHierarchy = [
        makeNodeDto('ec2-1', 'aws_instance', 'EC2 Instance', 'sub-1'),
        makeNodeDto('sub-1', 'aws_subnet', 'Subnet', 'vpc-1'),
        makeNodeDto('vpc-1', 'aws_vpc', 'VPC'),
      ];
      expect(architectureNodesArraySchema.safeParse(shuffledHierarchy).success).toBe(true);

      // 3. Self-parenting (A -> A)
      const selfParent = [
        makeNodeDto('node-self', 'aws_vpc', 'VPC', 'node-self'),
      ];
      const selfRes = architectureNodesArraySchema.safeParse(selfParent);
      expect(selfRes.success).toBe(false);
      if (!selfRes.success) {
        expect(selfRes.error.errors[0].message).toMatch(/Self-parenting is not allowed/i);
      }

      // 4. Missing parent reference
      const missingParent = [
        makeNodeDto('node-orphan', 'aws_subnet', 'Subnet', 'missing-parent-id'),
      ];
      const missingRes = architectureNodesArraySchema.safeParse(missingParent);
      expect(missingRes.success).toBe(false);
      if (!missingRes.success) {
        expect(missingRes.error.errors[0].message).toMatch(/references missing parentId/i);
      }

      // 5. Circular reference of depth 3: A -> B -> C -> A
      const cycleNodes = [
        makeNodeDto('node-a', 'aws_vpc', 'VPC', 'node-c'),
        makeNodeDto('node-b', 'aws_subnet', 'Subnet', 'node-a'),
        makeNodeDto('node-c', 'aws_vpc', 'VPC', 'node-b'),
      ];
      const cycleRes = architectureNodesArraySchema.safeParse(cycleNodes);
      expect(cycleRes.success).toBe(false);
      if (!cycleRes.success) {
        expect(cycleRes.error.errors.some((e) => e.message.includes('Circular parent-child'))).toBe(true);
      }

      // 6. Leaf resource cannot act as parent (EC2 containing Subnet)
      const leafParent = [
        makeNodeDto('leaf-ec2', 'aws_instance', 'EC2 Instance'),
        makeNodeDto('sub-under-ec2', 'aws_subnet', 'Subnet', 'leaf-ec2'),
      ];
      const leafRes = architectureNodesArraySchema.safeParse(leafParent);
      expect(leafRes.success).toBe(false);
      if (!leafRes.success) {
        expect(leafRes.error.errors[0].message).toMatch(/cannot act as a parent container/i);
      }
    });
  });
});
