import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchitectureValidationEngine } from './engine/validationEngine.js';
import { validationRegistry } from './engine/validationRegistry.js';
import { computeSubnetPlacementRule, internetGatewayAttachmentRule, subnetVpcContainmentRule } from './rules/structuralRules.js';
import { cidrFormatRule, natGatewayPublicPlacementRule, subnetCidrContainmentRule, subnetCidrOverlapRule } from './rules/networkRules.js';
import { publicRdsInstanceRule, s3PublicAccessBlockRule, storageEncryptionRule, unrestrictedManagementPortsRule, wildcardIamPermissionsRule } from './rules/securityRules.js';
import { albMultiAzSubnetsRule, automatedBackupRetentionRule, multiAzDatabaseRule } from './rules/reliabilityRules.js';
import { ValidationService } from './validation.service.js';

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
  });
});
