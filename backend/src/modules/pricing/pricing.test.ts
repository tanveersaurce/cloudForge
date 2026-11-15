import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPriceRate, REGION_PRICE_MULTIPLIERS } from './data/awsPricingCatalog.js';
import { CostCalculator } from './engine/costCalculator.js';
import { CostOptimizationEngine } from './engine/optimizationEngine.js';
import { PricingService } from './pricing.service.js';
import { getDefaultAssumptions, WORKLOAD_PRESETS } from './utils/workloadPresets.js';

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

const { mockArchitectures, mockAssumptions, mockRuns, mockPrisma } = vi.hoisted(() => {
  const architectures: StoredArchitecture[] = [];
  const assumptions: Record<string, unknown> = {};
  const runs: unknown[] = [];

  const prismaMock = {
    architecture: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const found = architectures.find((a) => a.id === where.id);
        if (!found) return null;
        return {
          ...found,
          costAssumptions: assumptions[where.id] ?? null,
        };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { nodes?: unknown[]; updatedAt?: Date } }) => {
        const found = architectures.find((a) => a.id === where.id);
        if (!found) throw new Error('Not found');
        if (data.nodes !== undefined) found.nodes = data.nodes;
        if (data.updatedAt) found.updatedAt = data.updatedAt;
        return found;
      }),
    },
    costAssumptions: {
      upsert: vi.fn(async ({ where, create, update }: { where: { architectureId: string }; create: unknown; update: unknown }) => {
        const merged = { ...((create as object) || {}), ...((update as object) || {}) };
        assumptions[where.architectureId] = merged;
        return merged;
      }),
    },
    costEstimationRun: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        runs.push(data);
        return data;
      }),
    },
  };

  return {
    mockArchitectures: architectures,
    mockAssumptions: assumptions,
    mockRuns: runs,
    mockPrisma: prismaMock,
  };
});

vi.mock('../../config/database.js', () => ({
  prisma: mockPrisma,
  checkDatabaseConnection: vi.fn(async () => ({ connected: true, latencyMs: 1.0 })),
  disconnectDatabase: vi.fn(async () => undefined),
}));

describe('AWS Cost Estimation Engine & Intelligent Optimization (Phase 08)', () => {
  beforeEach(() => {
    mockArchitectures.length = 0;
    mockRuns.length = 0;
    for (const key of Object.keys(mockAssumptions)) {
      delete mockAssumptions[key];
    }
    vi.clearAllMocks();
  });

  describe('Official AWS Pricing Catalog & Regional Rates', () => {
    it('retrieves official on-demand rates and applies regional multipliers', () => {
      const usEastRate = getPriceRate('ec2:t3.micro', 'us-east-1');
      expect(usEastRate).not.toBeNull();
      expect(usEastRate?.pricePerUnit).toBe(0.0104);
      expect(usEastRate?.currency).toBe('USD');

      // Regional adjustment in Tokyo (ap-northeast-1: 1.14x)
      const tokyoRate = getPriceRate('ec2:t3.micro', 'ap-northeast-1');
      expect(tokyoRate).not.toBeNull();
      expect(tokyoRate?.pricePerUnit).toBeCloseTo(0.0104 * 1.14, 4);

      // S3 Standard rate
      const s3Rate = getPriceRate('s3:standard', 'us-east-1');
      expect(s3Rate?.pricePerUnit).toBe(0.023);

      // NAT Gateway rate
      const natRate = getPriceRate('nat_gateway:hour', 'us-east-1');
      expect(natRate?.pricePerUnit).toBe(0.045);
    });

    it('calculates commitment discounts for Reserved Instances and Spot models', () => {
      const onDemand = getPriceRate('ec2:m5.large', 'us-east-1', 'OnDemand');
      const reserved = getPriceRate('ec2:m5.large', 'us-east-1', 'Reserved1Yr');
      const spot = getPriceRate('ec2:m5.large', 'us-east-1', 'Spot');

      expect(onDemand?.pricePerUnit).toBe(0.096);
      expect(reserved?.pricePerUnit).toBeCloseTo(0.096 * 0.65, 4); // ~35% off
      expect(spot?.pricePerUnit).toBeCloseTo(0.096 * 0.30, 4); // ~70% off
    });
  });

  describe('Workload Assumptions Presets', () => {
    it('provides realistic workload defaults across presets', () => {
      const dev = WORKLOAD_PRESETS.Development;
      expect(dev.monthlyOperatingHours).toBe(240); // 10 hrs * 24 business days

      const smallProd = getDefaultAssumptions();
      expect(smallProd.monthlyOperatingHours).toBe(730); // 24x7 standard month
      expect(smallProd.monthlyDataTransferOutGb).toBe(100);
      expect(smallProd.monthlyS3StorageGb).toBe(50);
    });
  });

  describe('Multi-Dimension Cost Calculator', () => {
    it('calculates compute, database, storage, and networking charges correctly without double counting', () => {
      const assumptions = getDefaultAssumptions(); // 730 hrs
      const nodes = [
        {
          id: 'ec2-app',
          type: 'awsResource',
          data: {
            resourceType: 'aws_instance',
            label: 'Web Server',
            metadata: { instance_type: 't3.micro', root_volume_size: 20 },
          },
        },
        {
          id: 'rds-db',
          type: 'awsResource',
          data: {
            resourceType: 'aws_db_instance',
            label: 'Primary DB',
            metadata: { instance_class: 'db.t3.micro', multi_az: true, allocated_storage: 50 },
          },
        },
        {
          id: 's3-media',
          type: 'awsResource',
          data: {
            resourceType: 'aws_s3_bucket',
            label: 'Media Bucket',
            metadata: {},
          },
        },
        {
          id: 'nat-gw',
          type: 'awsResource',
          data: {
            resourceType: 'aws_nat_gateway',
            label: 'Outbound NAT',
            metadata: {},
          },
        },
        {
          id: 'vpc-core',
          type: 'awsResource',
          data: {
            resourceType: 'aws_vpc',
            label: 'Core VPC',
            metadata: {},
          },
        },
      ];

      const result = CostCalculator.calculateCost('arch-calc-1', 'us-east-1', nodes, assumptions);

      expect(result.totalEstimatedMonthly).toBeGreaterThan(50);
      expect(result.totalEstimatedHourly).toBeGreaterThan(0);
      expect(result.totalEstimatedAnnual).toBeCloseTo(result.totalEstimatedMonthly * 12, 1);

      // Verify EC2 item
      const ec2Item = result.resourceItems.find((r) => r.resourceId === 'ec2-app');
      expect(ec2Item).toBeDefined();
      expect(ec2Item?.serviceCode).toBe('AmazonEC2');
      expect(ec2Item?.dimensions.some((d) => d.name.includes('Compute (t3.micro)'))).toBe(true);

      // Verify RDS Multi-AZ doubled rate
      const rdsItem = result.resourceItems.find((r) => r.resourceId === 'rds-db');
      expect(rdsItem).toBeDefined();
      expect(rdsItem?.dimensions.some((d) => d.name.includes('Multi-AZ'))).toBe(true);

      // Verify VPC is $0.00
      const vpcItem = result.resourceItems.find((r) => r.resourceId === 'vpc-core');
      expect(vpcItem?.monthlyCost).toBe(0.0);

      // Verify Service Breakdown
      expect(result.serviceBreakdown.length).toBeGreaterThanOrEqual(4);
      const totalBreakdown = result.serviceBreakdown.reduce((sum, s) => sum + s.percentage, 0);
      expect(totalBreakdown).toBeCloseTo(100, 0);
    });

    it('marks pricing as unavailable for unrecognized instances and records missing configuration assumptions', () => {
      const assumptions = getDefaultAssumptions();
      const nodes = [
        {
          id: 'ec2-unknown',
          type: 'awsResource',
          data: {
            resourceType: 'aws_instance',
            label: 'Mystery Box',
            metadata: { instance_type: 'c5.unknown-sku' },
          },
        },
        {
          id: 'ec2-unconfigured',
          type: 'awsResource',
          data: {
            resourceType: 'aws_instance',
            label: 'Blank EC2',
            metadata: {}, // Missing instance_type and root_volume_size
          },
        },
      ];

      const result = CostCalculator.calculateCost('arch-unknown', 'us-east-1', nodes, assumptions);

      const unknownItem = result.resourceItems.find((r) => r.resourceId === 'ec2-unknown');
      expect(unknownItem?.isPricingAvailable).toBe(false);
      expect(unknownItem?.warnings.some((w) => w.includes('Pricing unavailable'))).toBe(true);

      // Verify missing configuration assumptions recorded
      expect(result.missingAssumptions.some((a) => a.includes('instance_type not configured'))).toBe(true);
      expect(result.missingAssumptions.some((a) => a.includes('root_volume_size not configured'))).toBe(true);
    });

    it('ensures backend calculates deterministic benchmark estimates matching frontend client calculator', () => {
      const assumptions = getDefaultAssumptions();
      const nodes = [
        {
          id: 'ec2-prod',
          type: 'awsResource',
          data: {
            resourceType: 'aws_instance',
            label: 'Web Server',
            metadata: { instance_type: 't3.medium', root_volume_size: 30 },
          },
        },
        {
          id: 'rds-prod',
          type: 'awsResource',
          data: {
            resourceType: 'aws_db_instance',
            label: 'Production DB',
            metadata: { instance_class: 'db.t3.medium', multi_az: true, allocated_storage: 100 },
          },
        },
        {
          id: 'nat-prod',
          type: 'awsResource',
          data: {
            resourceType: 'aws_nat_gateway',
            label: 'NAT Gateway',
            metadata: {},
          },
        },
        {
          id: 's3-prod',
          type: 'awsResource',
          data: {
            resourceType: 'aws_s3_bucket',
            label: 'Static S3 Bucket',
            metadata: {},
          },
        },
      ];

      const result = CostCalculator.calculateCost('arch-parity', 'us-east-1', nodes, assumptions);

      const ec2Item = result.resourceItems.find((i) => i.resourceType === 'aws_instance');
      const rdsItem = result.resourceItems.find((i) => i.resourceType === 'aws_db_instance');
      const natItem = result.resourceItems.find((i) => i.resourceType === 'aws_nat_gateway');
      const s3Item = result.resourceItems.find((i) => i.resourceType === 'aws_s3_bucket');

      expect(ec2Item?.monthlyCost).toBe(32.77);
      expect(rdsItem?.monthlyCost).toBe(122.28);
      expect(natItem?.monthlyCost).toBe(35.1);
      expect(s3Item?.monthlyCost).toBe(1.4);
      expect(result.totalEstimatedMonthly).toBe(191.55);
    });
  });

  describe('Intelligent Cost Optimization Engine', () => {
    it('recommends Graviton migration for x86 instances with calculated savings', () => {
      const assumptions = getDefaultAssumptions();
      const nodes = [
        {
          id: 'ec2-large',
          type: 'awsResource',
          data: {
            resourceType: 'aws_instance',
            label: 'API Server',
            metadata: { instance_type: 't3.large' },
          },
        },
      ];

      const costResult = CostCalculator.calculateCost('arch-opt-1', 'us-east-1', nodes, assumptions);
      const recommendations = CostOptimizationEngine.generateRecommendations(
        nodes,
        assumptions,
        'us-east-1',
        costResult,
      );

      const gravitonRec = recommendations.find((r) => r.recommendationId.includes('GRAVITON'));
      expect(gravitonRec).toBeDefined();
      expect(gravitonRec?.proposedConfiguration.instance_type).toBe('t4g.large');
      expect(gravitonRec?.estimatedMonthlySavings).toBeGreaterThan(5);
      expect(gravitonRec?.performanceImpact).toBe('improved');
      expect(gravitonRec?.confidenceLevel).toBe('high');
    });

    it('recommends upgrading EBS gp2 to gp3 for 20% lower storage cost', () => {
      const assumptions = getDefaultAssumptions();
      const nodes = [
        {
          id: 'ebs-vol',
          type: 'awsResource',
          data: {
            resourceType: 'aws_ebs_volume',
            label: 'Data Disk',
            metadata: { volume_type: 'gp2', size: 100 },
          },
        },
      ];

      const costResult = CostCalculator.calculateCost('arch-opt-2', 'us-east-1', nodes, assumptions);
      const recommendations = CostOptimizationEngine.generateRecommendations(
        nodes,
        assumptions,
        'us-east-1',
        costResult,
      );

      const gp3Rec = recommendations.find((r) => r.recommendationId.includes('GP3'));
      expect(gp3Rec).toBeDefined();
      expect(gp3Rec?.proposedConfiguration.volume_type).toBe('gp3');
      expect(gp3Rec?.savingsPercentage).toBe(20);
      expect(gp3Rec?.estimatedMonthlySavings).toBe(2.0); // 100GB * (0.10 - 0.08)
    });

    it('recommends free S3 Gateway VPC Endpoint when NAT Gateway and S3 coexist', () => {
      const assumptions = getDefaultAssumptions();
      assumptions.monthlyNatTrafficGb = 100;

      const nodes = [
        {
          id: 'nat-1',
          type: 'awsResource',
          data: { resourceType: 'aws_nat_gateway', label: 'NAT' },
        },
        {
          id: 's3-1',
          type: 'awsResource',
          data: { resourceType: 'aws_s3_bucket', label: 'Bucket' },
        },
      ];

      const costResult = CostCalculator.calculateCost('arch-opt-3', 'us-east-1', nodes, assumptions);
      const recommendations = CostOptimizationEngine.generateRecommendations(
        nodes,
        assumptions,
        'us-east-1',
        costResult,
      );

      const endpointRec = recommendations.find((r) => r.recommendationId.includes('S3-GATEWAY-ENDPOINT'));
      expect(endpointRec).toBeDefined();
      expect(endpointRec?.estimatedMonthlySavings).toBeGreaterThan(0);
      expect(endpointRec?.securityImpact).toBe('improved');
    });
  });

  describe('PricingService End-to-End & Recommendation Application', () => {
    it('applies recommendation directly to resource metadata and recalculates lowered cost', async () => {
      const arch = {
        id: 'arch-user-1',
        userId: 'user-charlie',
        name: 'Optimization Target Arch',
        description: null,
        region: 'us-east-1',
        status: 'draft',
        resourceCount: 1,
        nodes: [
          {
            id: 'node-ebs',
            type: 'awsResource',
            data: {
              resourceType: 'aws_ebs_volume',
              label: 'Legacy Volume',
              metadata: { volume_type: 'gp2', size: 200 },
            },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockArchitectures.push(arch);

      // 1. Initial calculation
      const initial = await PricingService.calculateCost('arch-user-1', 'user-charlie');
      expect(initial.totalEstimatedMonthly).toBe(20.0); // 200GB * $0.10
      expect(initial.recommendations.length).toBeGreaterThan(0);

      const targetRec = initial.recommendations[0];
      expect(targetRec.recommendationId).toContain('GP3');

      // 2. Apply recommendation
      const afterApply = await PricingService.applyOptimization(
        'arch-user-1',
        'user-charlie',
        targetRec.recommendationId,
      );

      // Verify node metadata was updated to gp3
      const updatedNode = (arch.nodes as Array<{ data: { metadata: { volume_type: string } } }>)[0];
      expect(updatedNode.data.metadata.volume_type).toBe('gp3');

      // Verify cost was reduced
      expect(afterApply.totalEstimatedMonthly).toBe(16.0); // 200GB * $0.08
      expect(afterApply.totalEstimatedMonthly).toBeLessThan(initial.totalEstimatedMonthly);
    });

    it('enforces ownership: User B cannot view or apply optimizations to User A architecture', async () => {
      const arch = {
        id: 'arch-private',
        userId: 'user-alice',
        name: 'Private Arch',
        description: null,
        region: 'us-east-1',
        status: 'draft',
        resourceCount: 0,
        nodes: [],
        edges: [],
        viewport: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockArchitectures.push(arch);

      await expect(
        PricingService.calculateCost('arch-private', 'user-bob'),
      ).rejects.toThrow(/access/i);

      await expect(
        PricingService.applyOptimization('arch-private', 'user-bob', 'REC-1'),
      ).rejects.toThrow(/access/i);
    });
  });

  describe('Optimization Savings Accuracy & Compatibility Engine', () => {
    it('applies service-specific multipliers accurately instead of a flat rate', () => {
      // In Tokyo (ap-northeast-1): VPC is 1.38x, EC2 is 1.14x, S3 is 1.087x
      const vpcRate = getPriceRate('nat_gateway:hour', 'ap-northeast-1');
      const ec2Rate = getPriceRate('ec2:t3.micro', 'ap-northeast-1');
      const s3Rate = getPriceRate('s3:standard', 'ap-northeast-1');

      expect(vpcRate?.pricePerUnit).toBeCloseTo(0.045 * 1.38, 4);
      expect(ec2Rate?.pricePerUnit).toBeCloseTo(0.0104 * 1.14, 4);
      expect(s3Rate?.pricePerUnit).toBeCloseTo(0.023 * 1.087, 4);
    });

    it('flags unsupported regions in missingAssumptions and individual resource warnings', () => {
      const nodes = [
        {
          id: 'ec2-unsupported',
          type: 'awsResource',
          data: {
            resourceType: 'aws_instance',
            label: 'Compute in unsupported region',
            metadata: { instance_type: 't3.micro', root_volume_size: 20 },
          },
        },
      ];

      const result = CostCalculator.calculateCost(
        'arch-unsupp',
        'ap-south-1', // Unsupported region
        nodes,
        getDefaultAssumptions(),
      );

      expect(result.missingAssumptions.some((a) => a.includes('ap-south-1'))).toBe(true);
      expect(result.resourceItems[0].warnings.some((w) => w.includes('ap-south-1'))).toBe(true);
      expect(result.resourceItems[0].warnings.some((w) => w.includes('illustrative'))).toBe(true);
    });

    it('handles incompatible recommendations on the same resource by picking the highest-saving option', () => {
      const recs = [
        {
          recommendationId: 'REC-GRAVITON',
          title: 'Switch to Graviton t4g.medium',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { instance_type: 't3.medium' },
          proposedConfiguration: { instance_type: 't4g.medium' },
          explanation: 'ARM64 compute alternative',
          estimatedCurrentCost: 30.37,
          estimatedOptimizedCost: 24.53,
          estimatedMonthlySavings: 5.84,
          savingsPercentage: 19,
          currency: 'USD',
          performanceImpact: 'improved' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
        {
          recommendationId: 'REC-AMD',
          title: 'Switch to AMD t3a.medium',
          category: 'compute' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { instance_type: 't3.medium' },
          proposedConfiguration: { instance_type: 't3a.medium' },
          explanation: 'AMD x86 alternative',
          estimatedCurrentCost: 30.37,
          estimatedOptimizedCost: 27.33,
          estimatedMonthlySavings: 3.04,
          savingsPercentage: 10,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
      ];

      const analysis = CostOptimizationEngine.calculateAchievableSavings(recs);

      // Incompatible options: both propose instance_type on ec2-1
      expect(analysis.individualSavingsSum).toBe(8.88);
      expect(analysis.combinedAchievableSavings).toBe(5.84); // Kept highest saving
      expect(analysis.hasOverlappingRecommendations).toBe(true);
      expect(analysis.overlapNotes.some((n) => n.includes('mutually exclusive'))).toBe(true);
    });

    it('combines compatible recommendations on the same EBS volume sequentially without dropping', () => {
      const recs = [
        {
          recommendationId: 'REC-EBS-DOWNSIZE',
          title: 'Downsize Overprovisioned EBS Volume from 100GB to 50GB',
          category: 'storage' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ebs-1'],
          currentConfiguration: { size: 100 },
          proposedConfiguration: { size: 50 },
          explanation: 'Downsizing reduces capacity by 50%',
          estimatedCurrentCost: 10.0,
          estimatedOptimizedCost: 5.0,
          estimatedMonthlySavings: 5.0,
          savingsPercentage: 50,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
        {
          recommendationId: 'REC-EBS-GP3',
          title: 'Upgrade EBS Volume from gp2 to gp3',
          category: 'storage' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ebs-1'],
          currentConfiguration: { volume_type: 'gp2' },
          proposedConfiguration: { volume_type: 'gp3' },
          explanation: 'gp3 saves 20% over gp2 per GB',
          estimatedCurrentCost: 10.0,
          estimatedOptimizedCost: 8.0,
          estimatedMonthlySavings: 2.0,
          savingsPercentage: 20,
          currency: 'USD',
          performanceImpact: 'improved' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
      ];

      const analysis = CostOptimizationEngine.calculateAchievableSavings(recs);

      // Compatible: size downsize (50% = $5.00) + gp3 upgrade (20% of remaining $5.00 = $1.00)
      expect(analysis.individualSavingsSum).toBe(7.0);
      expect(analysis.combinedAchievableSavings).toBe(6.0); // NOT dropped to 5.0, NOT double-counted to 7.0
      expect(analysis.hasOverlappingRecommendations).toBe(true);
      expect(analysis.overlapNotes.some((n) => n.includes('compounded savings'))).toBe(true);
    });

    it('adjusts Savings Plans to baseline after architectural compute reductions', () => {
      const recs = [
        {
          recommendationId: 'REC-GRAVITON',
          title: 'Adopt Graviton',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { instance_type: 'm5.large' },
          proposedConfiguration: { instance_type: 'm6g.large' },
          explanation: '',
          estimatedCurrentCost: 70.08,
          estimatedOptimizedCost: 56.21,
          estimatedMonthlySavings: 13.87,
          savingsPercentage: 20,
          currency: 'USD',
          performanceImpact: 'improved' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
        {
          recommendationId: 'REC-SP',
          title: 'Compute Savings Plan',
          category: 'pricing-model' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { pricing_model: 'On-Demand' },
          proposedConfiguration: { pricing_model: 'Savings Plan' },
          explanation: '',
          estimatedCurrentCost: 70.08,
          estimatedOptimizedCost: 45.55,
          estimatedMonthlySavings: 24.53, // 35% of 70.08
          savingsPercentage: 35,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'medium' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
      ];

      const analysis = CostOptimizationEngine.calculateAchievableSavings(recs);

      // Post-Graviton compute baseline = 70.08 - 13.87 = 56.21
      // Adjusted Savings Plan = 56.21 * 0.35 = 19.67
      // Combined = 13.87 + 19.67 = 33.54
      expect(analysis.individualSavingsSum).toBe(38.4);
      expect(analysis.combinedAchievableSavings).toBe(33.54);
      expect(analysis.hasOverlappingRecommendations).toBe(true);
      expect(analysis.overlapNotes.some((n) => n.includes('Savings Plan recommendation adjusted'))).toBe(true);
    });
  });
});
