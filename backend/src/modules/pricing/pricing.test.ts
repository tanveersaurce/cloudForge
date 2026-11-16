import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      expect(s3Item?.monthlyCost).toBe(1.22);
      expect(result.totalEstimatedMonthly).toBe(191.37);
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
      expect(analysis.overlapNotes.some((n) => n.includes('compounding'))).toBe(true);
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

    it('allocates multi-resource recommendation savings proportionally without multiplying', () => {
      const rec = {
        recommendationId: 'REC-MULTI-NAT',
        title: 'Bypass NAT Gateways for S3',
        category: 'networking' as const,
        priority: 'high' as const,
        affectedResourceIds: ['nat-1', 'nat-2'],
        currentConfiguration: { s3_routing: 'NAT' },
        proposedConfiguration: { s3_routing: 'Gateway Endpoint' },
        explanation: 'Multi-resource gateway endpoint',
        estimatedCurrentCost: 90.0,
        estimatedOptimizedCost: 45.0,
        estimatedMonthlySavings: 45.0, // Total savings across both NATs
        savingsPercentage: 50,
        currency: 'USD',
        performanceImpact: 'improved' as const,
        securityImpact: 'neutral' as const,
        availabilityImpact: 'neutral' as const,
        implementationEffort: 'low' as const,
        confidenceLevel: 'high' as const,
        requiredAssumptions: [],
        documentationReferences: [],
        status: 'pending' as const,
      };

      const analysis = CostOptimizationEngine.calculateAchievableSavings([rec]);

      // Total savings must equal 45.00, NOT 45 * 2 = 90.00!
      expect(analysis.individualSavingsSum).toBe(45.0);
      expect(analysis.combinedAchievableSavings).toBe(45.0);
    });

    it('compounds multiple compatible recommendations across multiple resources at the resource level', () => {
      const recs = [
        {
          recommendationId: 'REC-MULTI-GRAVITON',
          title: 'Graviton on EC2 Cluster',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-1', 'ec2-2'],
          currentConfiguration: { instance_type: 't3.medium' },
          proposedConfiguration: { instance_type: 't4g.medium' },
          explanation: '',
          estimatedCurrentCost: 100.0, // $50 each
          estimatedOptimizedCost: 80.0, // $40 each
          estimatedMonthlySavings: 20.0, // $10 each (20%)
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
          recommendationId: 'REC-MULTI-SCHEDULE',
          title: 'Weekend Auto-Shutdown Schedule',
          category: 'compute' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-1', 'ec2-2'],
          currentConfiguration: { schedule: '24x7' },
          proposedConfiguration: { schedule: 'business-hours' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 70.0,
          estimatedMonthlySavings: 30.0, // 30% reduction
          savingsPercentage: 30,
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

      // Rec 1: $10 saved per instance ($20 total). Remaining cost per instance: $40.
      // Rec 2: 30% discount compounded on $40 remaining = $12 saved per instance ($24 total).
      // Combined savings = $20 + $24 = $44.00 (individual sum = $50.00).
      expect(analysis.individualSavingsSum).toBe(50.0);
      expect(analysis.combinedAchievableSavings).toBe(44.0);
      expect(analysis.hasOverlappingRecommendations).toBe(true);
    });

    it('rejects conflicting recommendations across multiple resources', () => {
      const recs = [
        {
          recommendationId: 'REC-GRAVITON',
          title: 'Upgrade to Graviton',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-1', 'ec2-2'],
          currentConfiguration: { instance_type: 't3.medium' },
          proposedConfiguration: { instance_type: 't4g.medium' },
          explanation: '',
          estimatedCurrentCost: 60.0,
          estimatedOptimizedCost: 48.0,
          estimatedMonthlySavings: 12.0,
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
          recommendationId: 'REC-AMD',
          title: 'Switch to AMD',
          category: 'compute' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-1', 'ec2-3'], // Overlaps on ec2-1
          currentConfiguration: { instance_type: 't3.medium' },
          proposedConfiguration: { instance_type: 't3a.medium' },
          explanation: '',
          estimatedCurrentCost: 60.0,
          estimatedOptimizedCost: 54.0,
          estimatedMonthlySavings: 6.0,
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

      // Conflict on ec2-1 -> REC-AMD is excluded
      expect(analysis.combinedAchievableSavings).toBe(12.0);
      expect(analysis.hasOverlappingRecommendations).toBe(true);
      expect(analysis.overlapNotes.some((n) => n.includes('mutually exclusive'))).toBe(true);
    });

    it('deducts architectural compute savings exactly once across multiple EC2 instances before Savings Plans', () => {
      const recs = [
        {
          recommendationId: 'REC-EC2-1',
          title: 'Graviton Web',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { instance_type: 't3.medium' },
          proposedConfiguration: { instance_type: 't4g.medium' },
          explanation: '',
          estimatedCurrentCost: 30.0,
          estimatedOptimizedCost: 20.0,
          estimatedMonthlySavings: 10.0,
          savingsPercentage: 33.3,
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
          recommendationId: 'REC-EC2-2',
          title: 'Graviton API',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-2'],
          currentConfiguration: { instance_type: 'm5.large' },
          proposedConfiguration: { instance_type: 'm6g.large' },
          explanation: '',
          estimatedCurrentCost: 70.0,
          estimatedOptimizedCost: 55.0,
          estimatedMonthlySavings: 15.0,
          savingsPercentage: 21.4,
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
          affectedResourceIds: ['ec2-1', 'ec2-2'],
          currentConfiguration: { pricing_model: 'On-Demand' },
          proposedConfiguration: { pricing_model: 'Savings Plan' },
          explanation: '',
          estimatedCurrentCost: 100.0, // Total compute spend
          estimatedOptimizedCost: 65.0,
          estimatedMonthlySavings: 35.0, // 35% of 100
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

      // Architectural compute reductions: $10 + $15 = $25 (deducted exactly once!).
      // Remaining eligible baseline: $100 - $25 = $75.
      // Adjusted Savings Plan: $75 * 0.35 = $26.25.
      // Combined savings = $25 + $26.25 = $51.25.
      expect(analysis.combinedAchievableSavings).toBe(51.25);
    });

    it('handles multiple Savings Plan recommendations by picking dominant commitment plan', () => {
      const recs = [
        {
          recommendationId: 'REC-SP-3YR',
          title: '3-Year Compute Savings Plan',
          category: 'pricing-model' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { pricing_model: 'On-Demand' },
          proposedConfiguration: { pricing_model: '3-Year SP' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 50.0,
          estimatedMonthlySavings: 50.0,
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
          recommendationId: 'REC-SP-1YR',
          title: '1-Year Compute Savings Plan',
          category: 'pricing-model' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { pricing_model: 'On-Demand' },
          proposedConfiguration: { pricing_model: '1-Year SP' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 65.0,
          estimatedMonthlySavings: 35.0,
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

      // Only the dominant 3-Year plan ($50) is applied, 1-Year plan excluded to avoid double commitment
      expect(analysis.combinedAchievableSavings).toBe(50.0);
      expect(analysis.overlapNotes.some((n) => n.includes('overlaps with applied commitment plan'))).toBe(true);
    });

    it('safely handles zero-cost and missing-cost resources without throwing or NaN', () => {
      const rec = {
        recommendationId: 'REC-FREE-IAM',
        title: 'Delete Unused Role',
        category: 'compute' as const,
        priority: 'low' as const,
        affectedResourceIds: ['iam-role-1'],
        currentConfiguration: {},
        proposedConfiguration: {},
        explanation: '',
        estimatedCurrentCost: 0.0,
        estimatedOptimizedCost: 0.0,
        estimatedMonthlySavings: 0.0,
        savingsPercentage: 0,
        currency: 'USD',
        performanceImpact: 'neutral' as const,
        securityImpact: 'neutral' as const,
        availabilityImpact: 'neutral' as const,
        implementationEffort: 'low' as const,
        confidenceLevel: 'low' as const,
        requiredAssumptions: [],
        documentationReferences: [],
        status: 'pending' as const,
      };

      const analysis = CostOptimizationEngine.calculateAchievableSavings([rec]);
      expect(analysis.combinedAchievableSavings).toBe(0.0);
      expect(isNaN(analysis.combinedAchievableSavings)).toBe(false);
    });

    it('separates S3 Tier 1 (PUT/COPY/POST/LIST) and Tier 2 (GET/SELECT) request dimensions accurately', () => {
      const assumptions = {
        ...getDefaultAssumptions(),
        monthlyS3StorageGb: 100,
        monthlyS3PutRequests: 20000,
        monthlyS3GetRequests: 100000,
      };

      const nodes = [
        {
          id: 's3-bucket',
          type: 'awsResource',
          data: { resourceType: 'aws_s3_bucket', label: 'App S3' },
        },
      ];

      const result = CostCalculator.calculateCost('arch-s3-reqs', 'us-east-1', nodes, assumptions);
      const s3Item = result.resourceItems[0];

      // Storage: 100 GB @ $0.023 = $2.30
      // Tier 1: 20k @ $0.005/1k = $0.10
      // Tier 2: 100k @ $0.0004/1k = $0.04
      // Total = $2.44
      expect(s3Item.monthlyCost).toBe(2.44);

      const tier1Dim = s3Item.dimensions.find((d) => d.name.includes('Tier 1 Requests'));
      const tier2Dim = s3Item.dimensions.find((d) => d.name.includes('Tier 2 Requests'));

      expect(tier1Dim).toBeDefined();
      expect(tier1Dim?.extendedCost).toBe(0.1);
      expect(tier2Dim).toBeDefined();
      expect(tier2Dim?.extendedCost).toBe(0.04);
    });

    it('verifies strict parity between backend and frontend calculators on shared benchmark fixture within 0.01 tolerance', async () => {
      const { BENCHMARK_NODES, BENCHMARK_ASSUMPTIONS, BENCHMARK_EXPECTED } = await import(
        './data/pricingBenchmarkFixtures.js'
      );
      const { calculateClientCost } = await import(
        '../../../../frontend/src/features/cost-explorer/engine/clientCostCalculator.js'
      );

      const backendResult = CostCalculator.calculateCost(
        'arch-bench',
        'us-east-1',
        BENCHMARK_NODES,
        BENCHMARK_ASSUMPTIONS,
      );

      const frontendResult = calculateClientCost(
        'arch-bench',
        'us-east-1',
        BENCHMARK_NODES as any,
        [],
        BENCHMARK_ASSUMPTIONS,
      );

      const TOLERANCE = 0.01;

      // 1. Total Monthly Cost Parity
      const totalDiff = Math.abs(backendResult.totalEstimatedMonthly - frontendResult.totalEstimatedMonthly);
      expect(totalDiff).toBeLessThanOrEqual(TOLERANCE);
      expect(backendResult.totalEstimatedMonthly).toBe(BENCHMARK_EXPECTED.totalEstimatedMonthly);
      expect(frontendResult.totalEstimatedMonthly).toBe(BENCHMARK_EXPECTED.totalEstimatedMonthly);

      // Hourly Cost Parity
      const hourlyDiff = Math.abs(backendResult.totalEstimatedHourly - frontendResult.totalEstimatedHourly);
      expect(hourlyDiff).toBeLessThanOrEqual(TOLERANCE);

      // 2. Resource-Level Cost Parity
      expect(backendResult.resourceItems.length).toBe(frontendResult.resourceItems.length);
      for (const bItem of backendResult.resourceItems) {
        const fItem = frontendResult.resourceItems.find((f) => f.resourceId === bItem.resourceId);
        expect(fItem).toBeDefined();
        const diff = Math.abs(bItem.monthlyCost - fItem!.monthlyCost);
        expect(diff).toBeLessThanOrEqual(TOLERANCE);

        const hDiff = Math.abs(bItem.hourlyCost - fItem!.hourlyCost);
        expect(hDiff).toBeLessThanOrEqual(TOLERANCE);

        // Compare individual dimension extendedCosts, unitPrice, quantity
        expect(bItem.dimensions.length).toBe(fItem!.dimensions.length);
        for (let i = 0; i < bItem.dimensions.length; i++) {
          const dimDiff = Math.abs(bItem.dimensions[i].extendedCost - fItem!.dimensions[i].extendedCost);
          expect(dimDiff).toBeLessThanOrEqual(TOLERANCE);
          const priceDiff = Math.abs(bItem.dimensions[i].unitPrice - fItem!.dimensions[i].unitPrice);
          expect(priceDiff).toBeLessThanOrEqual(TOLERANCE);
          expect(bItem.dimensions[i].quantity).toBe(fItem!.dimensions[i].quantity);
        }
      }

      // 3. Service Breakdown Parity
      for (const bService of backendResult.serviceBreakdown) {
        const fService = frontendResult.serviceBreakdown.find((f) => f.serviceCode === bService.serviceCode);
        expect(fService).toBeDefined();
        const serviceDiff = Math.abs(bService.monthlyCost - fService!.monthlyCost);
        expect(serviceDiff).toBeLessThanOrEqual(TOLERANCE);
        const pctDiff = Math.abs(bService.percentage - fService!.percentage);
        expect(pctDiff).toBeLessThanOrEqual(0.01);
      }
    });

    it('handles three Savings Plans where first and third overlap but second does not', () => {
      const recs = [
        {
          recommendationId: 'REC-SP-1',
          title: 'EC2-1 3-Year Savings Plan',
          category: 'pricing-model' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: {},
          proposedConfiguration: {},
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 50.0,
          estimatedMonthlySavings: 50.0,
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
          recommendationId: 'REC-SP-2',
          title: 'EC2-2 1-Year Savings Plan',
          category: 'pricing-model' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-2'],
          currentConfiguration: {},
          proposedConfiguration: {},
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 70.0,
          estimatedMonthlySavings: 30.0,
          savingsPercentage: 30,
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
        {
          recommendationId: 'REC-SP-3',
          title: 'EC2-1 1-Year Savings Plan (Conflicting)',
          category: 'pricing-model' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: {},
          proposedConfiguration: {},
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 65.0,
          estimatedMonthlySavings: 35.0,
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

      // SP-1 ($50 on ec2-1) and SP-2 ($30 on ec2-2) are independent -> both accepted = $80.
      // SP-3 ($35 on ec2-1) is rejected due to conflict with SP-1 on ec2-1.
      expect(analysis.combinedAchievableSavings).toBe(80.0);
      expect(analysis.hasOverlappingRecommendations).toBe(true);
      expect(analysis.overlapNotes.some((n) => n.includes('overlaps with applied commitment plan') && n.includes('ec2-1'))).toBe(true);
    });

    it('handles two independent Savings Plans on separate EC2 resources without conflict', () => {
      const recs = [
        {
          recommendationId: 'REC-SP-A',
          title: 'EC2-A Savings Plan',
          category: 'pricing-model' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-a'],
          currentConfiguration: {},
          proposedConfiguration: {},
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 60.0,
          estimatedMonthlySavings: 40.0,
          savingsPercentage: 40,
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
          recommendationId: 'REC-SP-B',
          title: 'EC2-B Savings Plan',
          category: 'pricing-model' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-b'],
          currentConfiguration: {},
          proposedConfiguration: {},
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 75.0,
          estimatedMonthlySavings: 25.0,
          savingsPercentage: 25,
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

      // Both independent plans applied: $40 + $25 = $65.
      expect(analysis.combinedAchievableSavings).toBe(65.0);
      expect(analysis.hasOverlappingRecommendations).toBe(false);
      expect(analysis.overlapNotes.length).toBe(0);
    });

    it('allocates multi-resource recommendation savings proportionally using unequal EC2 resource costs', () => {
      const resourceCosts = new Map<string, number>([
        ['ec2-web', 30.0],
        ['ec2-api', 70.0],
      ]);

      const recs = [
        {
          recommendationId: 'REC-FLEET-OPT',
          title: 'Fleet-wide Workload Optimization',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-web', 'ec2-api'],
          currentConfiguration: { fleet_scaling: 'standard' },
          proposedConfiguration: { fleet_scaling: 'optimized' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 80.0,
          estimatedMonthlySavings: 20.0,
          savingsPercentage: 20,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'medium' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
      ];

      const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, resourceCosts);

      // Total savings = $20. Proportional allocation:
      // ec2-web ($30 / $100 = 30%) -> $6.00
      // ec2-api ($70 / $100 = 70%) -> $14.00
      expect(analysis.combinedAchievableSavings).toBe(20.0);
    });

    it('determines dominant recommendation deterministically regardless of input array ordering', () => {
      const recA = {
        recommendationId: 'REC-LOW-SAVINGS',
        title: 'Upgrade to t3.medium',
        category: 'compute' as const,
        priority: 'medium' as const,
        affectedResourceIds: ['ec2-1'],
        currentConfiguration: { instance_type: 't3.small' },
        proposedConfiguration: { instance_type: 't3.medium' },
        explanation: '',
        estimatedCurrentCost: 100.0,
        estimatedOptimizedCost: 70.0,
        estimatedMonthlySavings: 30.0,
        savingsPercentage: 30,
        currency: 'USD',
        performanceImpact: 'neutral' as const,
        securityImpact: 'neutral' as const,
        availabilityImpact: 'neutral' as const,
        implementationEffort: 'low' as const,
        confidenceLevel: 'medium' as const,
        requiredAssumptions: [],
        documentationReferences: [],
        status: 'pending' as const,
      };

      const recB = {
        recommendationId: 'REC-HIGH-SAVINGS',
        title: 'Migrate to c6g.medium (Graviton)',
        category: 'compute' as const,
        priority: 'high' as const,
        affectedResourceIds: ['ec2-1'],
        currentConfiguration: { instance_type: 't3.small' },
        proposedConfiguration: { instance_type: 'c6g.medium' },
        explanation: '',
        estimatedCurrentCost: 100.0,
        estimatedOptimizedCost: 40.0,
        estimatedMonthlySavings: 60.0,
        savingsPercentage: 60,
        currency: 'USD',
        performanceImpact: 'neutral' as const,
        securityImpact: 'neutral' as const,
        availabilityImpact: 'neutral' as const,
        implementationEffort: 'low' as const,
        confidenceLevel: 'high' as const,
        requiredAssumptions: [],
        documentationReferences: [],
        status: 'pending' as const,
      };

      // Order 1: [Low, High]
      const analysis1 = CostOptimizationEngine.calculateAchievableSavings([recA, recB]);
      // Order 2: [High, Low]
      const analysis2 = CostOptimizationEngine.calculateAchievableSavings([recB, recA]);

      // Both orders must keep dominant recB ($60) and exclude recA ($30)
      expect(analysis1.combinedAchievableSavings).toBe(60.0);
      expect(analysis2.combinedAchievableSavings).toBe(60.0);
      expect(analysis1.combinedAchievableSavings).toBe(analysis2.combinedAchievableSavings);
    });

    it('calculates Savings Plan after optimizations affecting only a subset of resources without deducting unrelated resources', () => {
      const resourceCosts = new Map<string, number>([
        ['ec2-1', 100.0],
        ['ec2-2', 100.0],
        ['ec2-unrelated', 100.0],
      ]);

      const recs = [
        // Architectural optimization on ec2-1 only ($20 reduction -> remaining $80)
        {
          recommendationId: 'REC-OPT-EC2-1',
          title: 'Right-size EC2-1',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-1'],
          currentConfiguration: { instance_type: 't3.large' },
          proposedConfiguration: { instance_type: 't3.medium' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 80.0,
          estimatedMonthlySavings: 20.0,
          savingsPercentage: 20,
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
        // Architectural optimization on ec2-unrelated ($50 reduction)
        {
          recommendationId: 'REC-OPT-UNRELATED',
          title: 'Right-size Unrelated EC2',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-unrelated'],
          currentConfiguration: { instance_type: 'm5.xlarge' },
          proposedConfiguration: { instance_type: 'm5.large' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 50.0,
          estimatedMonthlySavings: 50.0,
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
        // Savings Plan covering ONLY ec2-1 and ec2-2 (NOT ec2-unrelated)
        {
          recommendationId: 'REC-SP-CLUSTER',
          title: 'Compute Savings Plan for Cluster',
          category: 'pricing-model' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-1', 'ec2-2'],
          currentConfiguration: { pricing_model: 'On-Demand' },
          proposedConfiguration: { pricing_model: 'Savings Plan' },
          explanation: '',
          estimatedCurrentCost: 200.0,
          estimatedOptimizedCost: 140.0,
          estimatedMonthlySavings: 60.0,
          savingsPercentage: 30, // 30% discount
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

      const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, resourceCosts);

      // Architectural savings:
      // ec2-1: $20 (remaining: $80)
      // ec2-unrelated: $50 (remaining: $50)
      // Savings Plan eligible baseline for ['ec2-1', 'ec2-2']:
      // ec2-1 remaining ($80) + ec2-2 remaining ($100) = $180.
      // (The $50 reduction on ec2-unrelated is strictly NOT deducted!)
      // SP savings = $180 * 0.30 = $54.00.
      // Total combined = $20 + $50 + $54 = $124.00.
      expect(analysis.combinedAchievableSavings).toBe(124.0);
    });

    it('ensures savings never exceed resource baseline', () => {
      const resourceCosts = new Map<string, number>([
        ['ec2-small', 25.0],
      ]);

      const recs = [
        {
          recommendationId: 'REC-OVERSIZED-SAVINGS',
          title: 'Overly Ambitious Optimization',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-small'],
          currentConfiguration: { instance_type: 't3.nano' },
          proposedConfiguration: { instance_type: 'serverless' },
          explanation: '',
          estimatedCurrentCost: 25.0,
          estimatedOptimizedCost: 0.0,
          estimatedMonthlySavings: 60.0, // Nominally claims $60 savings on a $25 resource
          savingsPercentage: 100,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'low' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        },
      ];

      const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, resourceCosts);

      // Savings must be clamped to the actual remaining baseline ($25.00)
      expect(analysis.combinedAchievableSavings).toBe(25.0);
    });

    describe('Partially Unknown Resource Costs & Robust Fallback Allocation', () => {
      it('allocates savings proportionally when all resource costs are known', () => {
        const resourceCosts = new Map<string, number>([
          ['ec2-1', 40.0],
          ['ec2-2', 60.0],
        ]);
        const recs = [
          {
            recommendationId: 'REC-ALL-KNOWN',
            title: 'Fleet Optimization',
            category: 'compute' as const,
            priority: 'high' as const,
            affectedResourceIds: ['ec2-1', 'ec2-2'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 80.0,
            estimatedMonthlySavings: 20.0,
            savingsPercentage: 20,
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

        const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, resourceCosts);
        // ec2-1: 40/100 * 20 = $8.00; ec2-2: 60/100 * 20 = $12.00
        expect(analysis.combinedAchievableSavings).toBe(20.0);
      });

      it('allocates savings when one resource is known and one is unknown without assigning zero weight', () => {
        const resourceCosts = new Map<string, number>([
          ['ec2-known', 60.0],
          // ec2-unknown is not in map
        ]);
        const recs = [
          {
            recommendationId: 'REC-ONE-UNKNOWN',
            title: 'Cluster Optimization',
            category: 'compute' as const,
            priority: 'high' as const,
            affectedResourceIds: ['ec2-known', 'ec2-unknown'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 80.0,
            estimatedMonthlySavings: 20.0,
            savingsPercentage: 20,
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

        const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, resourceCosts);
        // Fallback cost for ec2-unknown = $100 - $60 = $40. Total = $100.
        // ec2-known: 60%, ec2-unknown: 40% (never 0 weight!).
        // Total savings = 20.0, never exceeds estimatedMonthlySavings or baseline.
        expect(analysis.combinedAchievableSavings).toBe(20.0);
      });

      it('allocates savings equally when all resource costs are unknown', () => {
        const recs = [
          {
            recommendationId: 'REC-ALL-UNKNOWN',
            title: 'Unknown Cluster Optimization',
            category: 'compute' as const,
            priority: 'high' as const,
            affectedResourceIds: ['ec2-u1', 'ec2-u2'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 70.0,
            estimatedMonthlySavings: 30.0,
            savingsPercentage: 30,
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
        // Equal share: $15 each. Total = $30.
        expect(analysis.combinedAchievableSavings).toBe(30.0);
      });

      it('handles zero-cost resources by ensuring allocated savings never exceed zero baseline', () => {
        const resourceCosts = new Map<string, number>([
          ['iam-zero', 0.0],
          ['ec2-active', 100.0],
        ]);
        const recs = [
          {
            recommendationId: 'REC-ZERO-COST-MIXED',
            title: 'Security and Compute Optimization',
            category: 'compute' as const,
            priority: 'medium' as const,
            affectedResourceIds: ['iam-zero', 'ec2-active'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 75.0,
            estimatedMonthlySavings: 25.0,
            savingsPercentage: 25,
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

        const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, resourceCosts);
        // iam-zero has 0 cost, ec2-active has $100. ec2-active gets 100% weight ($25), iam-zero gets $0.
        expect(analysis.combinedAchievableSavings).toBe(25.0);

        // Standalone recommendation solely on zero-cost resource
        const zeroOnlyRec = [
          {
            recommendationId: 'REC-ZERO-STANDALONE',
            title: 'Delete Free Role',
            category: 'compute' as const,
            priority: 'low' as const,
            affectedResourceIds: ['iam-zero'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 0.0,
            estimatedOptimizedCost: 0.0,
            estimatedMonthlySavings: 15.0, // claims $15 nominal savings on a $0 resource
            savingsPercentage: 100,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'low' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];
        const zeroAnalysis = CostOptimizationEngine.calculateAchievableSavings(zeroOnlyRec, resourceCosts);
        expect(zeroAnalysis.combinedAchievableSavings).toBe(0.0);
      });
    });

    describe('Achievable Savings Dominance Selection', () => {
      it('selects dominant recommendation based on achievable savings rather than nominal savings', () => {
        const resourceCosts = new Map<string, number>([
          ['ec2-bottleneck', 15.0],
          ['ec2-large', 85.0],
        ]);

        // REC-HIGH-NOMINAL: Claims $50.00 nominal savings, but affects only ec2-bottleneck ($15.00 baseline)
        // Achievable savings against resource baseline is strictly capped at $15.00.
        const recHighNominal = {
          recommendationId: 'REC-HIGH-NOMINAL',
          title: 'Nominally High Savings Option',
          category: 'compute' as const,
          priority: 'high' as const,
          affectedResourceIds: ['ec2-bottleneck'],
          currentConfiguration: { instance_type: 't3.small' },
          proposedConfiguration: { instance_type: 't3.nano' },
          explanation: '',
          estimatedCurrentCost: 15.0,
          estimatedOptimizedCost: 0.0,
          estimatedMonthlySavings: 50.0, // High nominal claim ($50)
          savingsPercentage: 100,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        };

        // REC-HIGH-ACHIEVABLE: Claims $35.00 nominal savings across ec2-bottleneck ($15) and ec2-large ($85)
        // Achievable savings against resource baselines is $35.00 ($35.00 > $15.00).
        const recHighAchievable = {
          recommendationId: 'REC-HIGH-ACHIEVABLE',
          title: 'Achievable High Savings Option',
          category: 'compute' as const,
          priority: 'medium' as const,
          affectedResourceIds: ['ec2-bottleneck', 'ec2-large'],
          currentConfiguration: { instance_type: 't3.small' },
          proposedConfiguration: { instance_type: 'c6g.medium' },
          explanation: '',
          estimatedCurrentCost: 100.0,
          estimatedOptimizedCost: 65.0,
          estimatedMonthlySavings: 35.0, // Lower nominal claim ($35), but fully achievable
          savingsPercentage: 35,
          currency: 'USD',
          performanceImpact: 'neutral' as const,
          securityImpact: 'neutral' as const,
          availabilityImpact: 'neutral' as const,
          implementationEffort: 'low' as const,
          confidenceLevel: 'high' as const,
          requiredAssumptions: [],
          documentationReferences: [],
          status: 'pending' as const,
        };

        // Order 1: [NominalHigh ($50 nom / $15 ach), AchievableHigh ($35 nom / $35 ach)]
        const analysis1 = CostOptimizationEngine.calculateAchievableSavings([recHighNominal, recHighAchievable], resourceCosts);
        // Order 2: [AchievableHigh ($35 nom / $35 ach), NominalHigh ($50 nom / $15 ach)]
        const analysis2 = CostOptimizationEngine.calculateAchievableSavings([recHighAchievable, recHighNominal], resourceCosts);

        // Both orders must select REC-HIGH-ACHIEVABLE ($35.00) and reject REC-HIGH-NOMINAL ($15.00)
        expect(analysis1.combinedAchievableSavings).toBe(35.0);
        expect(analysis2.combinedAchievableSavings).toBe(35.0);
        expect(analysis1.overlapNotes.some((n) => n.includes('mutually exclusive') && n.includes('REC-HIGH-ACHIEVABLE'))).toBe(true);
      });
    });

    describe('Savings Plan Percentage Boundary Validation', () => {
      const resourceCosts = new Map<string, number>([
        ['ec2-compute', 100.0],
      ]);

      it('produces zero savings when savingsPercentage is explicitly zero (no 35% fallback)', () => {
        const recs = [
          {
            recommendationId: 'REC-SP-ZERO',
            title: 'Zero Discount Savings Plan',
            category: 'pricing-model' as const,
            priority: 'low' as const,
            affectedResourceIds: ['ec2-compute'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 100.0,
            estimatedMonthlySavings: 0.0,
            savingsPercentage: 0,
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

        const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, resourceCosts);
        // Must be exactly $0.00 (not 35% fallback!)
        expect(analysis.combinedAchievableSavings).toBe(0.0);
      });

      it('produces zero savings and records warning when savingsPercentage is negative', () => {
        const recs = [
          {
            recommendationId: 'REC-SP-NEG',
            title: 'Negative Discount Savings Plan',
            category: 'pricing-model' as const,
            priority: 'low' as const,
            affectedResourceIds: ['ec2-compute'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 100.0,
            estimatedMonthlySavings: 0.0,
            savingsPercentage: -15,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'low' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];

        const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, resourceCosts);
        expect(analysis.combinedAchievableSavings).toBe(0.0);
        expect(analysis.overlapNotes.some((n) => n.includes('negative savingsPercentage (-15%)'))).toBe(true);
      });

      it('produces zero savings and records warning when savingsPercentage is missing or NaN', () => {
        const recs = [
          {
            recommendationId: 'REC-SP-MISSING',
            title: 'Missing Percentage Savings Plan',
            category: 'pricing-model' as const,
            priority: 'low' as const,
            affectedResourceIds: ['ec2-compute'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 100.0,
            estimatedMonthlySavings: 30.0,
            savingsPercentage: NaN,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'low' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];

        const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, resourceCosts);
        expect(analysis.combinedAchievableSavings).toBe(0.0);
        expect(analysis.overlapNotes.some((n) => n.includes('missing or invalid savingsPercentage'))).toBe(true);
      });

      it('produces zero savings and records warning when savingsPercentage exceeds 100%', () => {
        const recs = [
          {
            recommendationId: 'REC-SP-OVER100',
            title: 'Over 100 Percent Savings Plan',
            category: 'pricing-model' as const,
            priority: 'low' as const,
            affectedResourceIds: ['ec2-compute'],
            currentConfiguration: {},
            proposedConfiguration: {},
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 0.0,
            estimatedMonthlySavings: 150.0,
            savingsPercentage: 150,
            currency: 'USD',
            performanceImpact: 'neutral' as const,
            securityImpact: 'neutral' as const,
            availabilityImpact: 'neutral' as const,
            implementationEffort: 'low' as const,
            confidenceLevel: 'low' as const,
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending' as const,
          },
        ];

        const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, resourceCosts);
        expect(analysis.combinedAchievableSavings).toBe(0.0);
        expect(analysis.overlapNotes.some((n) => n.includes('savingsPercentage exceeding 100% (150%)'))).toBe(true);
      });
    });

    describe('Optimization Engine Critical Fixes (Phase 08 Audit)', () => {
      it('selects optimal combination over greedy in conflict component with > 15 recommendations', () => {
        // Component of 16 conflicting recommendations modifying instance_type on ec2-1 and/or ec2-2
        // Rec-Dominant: affects [ec2-1, ec2-2], saves $100
        // Rec-Sub1: affects ec2-1, saves $60
        // Rec-Sub2: affects ec2-2, saves $60
        // Rec-3..Rec-16: 13 small conflicting recommendations on ec2-1 saving $2 each
        // Greedy would pick Rec-Dominant ($100) and reject everything else.
        // Optimizer branch-and-bound evaluates Rec-Sub1 ($60) + Rec-Sub2 ($60) = $120.
        const recs: CostOptimizationRecommendation[] = [
          {
            recommendationId: 'REC-DOMINANT',
            title: 'Multi-Resource Instance Upgrade',
            category: 'compute',
            priority: 'high',
            affectedResourceIds: ['ec2-1', 'ec2-2'],
            currentConfiguration: { instance_type: 'm5.large' },
            proposedConfiguration: { instance_type: 'm6g.large' },
            explanation: '',
            estimatedCurrentCost: 200.0,
            estimatedOptimizedCost: 100.0,
            estimatedMonthlySavings: 100.0,
            savingsPercentage: 50,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          },
          {
            recommendationId: 'REC-SUB-1',
            title: 'EC2-1 Dedicated Optimization',
            category: 'compute',
            priority: 'high',
            affectedResourceIds: ['ec2-1'],
            currentConfiguration: { instance_type: 'm5.large' },
            proposedConfiguration: { instance_type: 'c6g.large' },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 40.0,
            estimatedMonthlySavings: 60.0,
            savingsPercentage: 60,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          },
          {
            recommendationId: 'REC-SUB-2',
            title: 'EC2-2 Dedicated Optimization',
            category: 'compute',
            priority: 'high',
            affectedResourceIds: ['ec2-2'],
            currentConfiguration: { instance_type: 'm5.large' },
            proposedConfiguration: { instance_type: 'c6g.large' },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 40.0,
            estimatedMonthlySavings: 60.0,
            savingsPercentage: 60,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          },
        ];

        // Add 13 more conflicting recommendations (total 16 in component)
        for (let i = 3; i <= 15; i++) {
          recs.push({
            recommendationId: `REC-EXTRA-${i}`,
            title: `Extra Rec ${i}`,
            category: 'compute',
            priority: 'low',
            affectedResourceIds: ['ec2-1'],
            currentConfiguration: { instance_type: 'm5.large' },
            proposedConfiguration: { instance_type: `t4g.${i}xlarge` },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 98.0,
            estimatedMonthlySavings: 2.0,
            savingsPercentage: 2,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'low',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          });
        }

        const costs = new Map<string, number>([
          ['ec2-1', 100.0],
          ['ec2-2', 100.0],
        ]);

        const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, costs);
        // Optimal combination (REC-SUB-1 + REC-SUB-2) achieves $120.00
        expect(analysis.combinedAchievableSavings).toBe(120.0);
        // Completed within search budget: no heuristic fallback claimed
        expect(analysis.overlapNotes.some((n) => n.includes('heuristic optimization strategy'))).toBe(false);
      });

      it('transparently reports heuristic fallback when conflict component exceeds search complexity limit', () => {
        // Build a component with 30 mutually overlapping recommendations that exhaust search steps
        const recs: CostOptimizationRecommendation[] = [];
        const resources: string[] = [];
        for (let r = 1; r <= 10; r++) resources.push(`res-${r}`);

        for (let i = 1; i <= 30; i++) {
          // Each recommendation overlaps with adjacent resources
          const r1 = `res-${(i % 10) + 1}`;
          const r2 = `res-${((i + 1) % 10) + 1}`;
          recs.push({
            recommendationId: `REC-CHAIN-${i}`,
            title: `Chain Rec ${i}`,
            category: 'compute',
            priority: 'medium',
            affectedResourceIds: [r1, r2],
            currentConfiguration: { instance_type: 't3.medium' },
            proposedConfiguration: { instance_type: 't4g.medium' },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 80.0,
            estimatedMonthlySavings: 20.0,
            savingsPercentage: 20,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'medium',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          });
        }

        const costs = new Map<string, number>();
        for (let r = 1; r <= 10; r++) costs.set(`res-${r}`, 100.0);

        const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, costs);
        expect(analysis.combinedAchievableSavings).toBeGreaterThan(0);
        expect(analysis.overlapNotes.some((n) => n.includes('heuristic optimization strategy'))).toBe(true);
      });

      it('allocates Savings Plan savings proportionally with unequal resource costs', () => {
        // Prompt example:
        // EC2-A: $20, EC2-B: $180 -> Total baseline: $200
        // 10% Savings Plan discount -> Total savings: $20
        // EC2-A allocation must be $2, EC2-B allocation must be $18 (NOT $10 each)
        const costs = new Map<string, number>([
          ['ec2-a', 20.0],
          ['ec2-b', 180.0],
        ]);

        const recs: CostOptimizationRecommendation[] = [
          {
            recommendationId: 'REC-SP-PROPORTIONAL',
            title: '10 Percent Savings Plan',
            category: 'pricing-model',
            priority: 'high',
            affectedResourceIds: ['ec2-a', 'ec2-b'],
            currentConfiguration: { pricing_model: 'On-Demand' },
            proposedConfiguration: { pricing_model: 'Savings Plan' },
            explanation: '',
            estimatedCurrentCost: 200.0,
            estimatedOptimizedCost: 180.0,
            estimatedMonthlySavings: 20.0,
            savingsPercentage: 10,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          },
        ];

        const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, costs);
        expect(analysis.combinedAchievableSavings).toBe(20.0);

        // Verify proportional allocation via subsequent compounding:
        // If EC2-A was allocated $2, its remaining cost is $18.
        // A subsequent 50% discount on EC2-A should save 50% of $18 = $9.00.
        // (If it had been allocated $10 equally, its remaining cost would be $10 and 50% would be $5.00)
        const recsWithFollowUp: CostOptimizationRecommendation[] = [
          // Follow-up recommendation on EC2-A modifying root volume size (compatible with pricing model)
          {
            recommendationId: 'REC-EC2A-STORAGE',
            title: 'EC2-A Storage Optimization',
            category: 'storage',
            priority: 'medium',
            affectedResourceIds: ['ec2-a'],
            currentConfiguration: { volume_type: 'gp2' },
            proposedConfiguration: { volume_type: 'gp3' },
            explanation: '',
            estimatedCurrentCost: 20.0,
            estimatedOptimizedCost: 10.0,
            estimatedMonthlySavings: 10.0,
            savingsPercentage: 50,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          },
          recs[0],
        ];

        // Architectural optimization first: EC2-A gets $10 reduction (remaining: $10).
        // Then Savings Plan baseline: EC2-A ($10) + EC2-B ($180) = $190.
        // 10% SP savings = $19.00.
        // Proportional: EC2-A ($10/$190) = $1.00; EC2-B ($180/$190) = $18.00.
        // Combined total = $10 (arch) + $19 (SP) = $29.00.
        const analysisWithFollowUp = CostOptimizationEngine.calculateAchievableSavings(recsWithFollowUp, costs);
        expect(analysisWithFollowUp.combinedAchievableSavings).toBe(29.0);
      });

      it('safely handles zero-cost resources and rounding boundaries without negative cost or lost cents', () => {
        // Zero-cost resource: EC2-ZERO: $0, EC2-ACTIVE: $100
        const costs = new Map<string, number>([
          ['ec2-zero', 0.0],
          ['ec2-active', 100.0],
        ]);

        const recs: CostOptimizationRecommendation[] = [
          {
            recommendationId: 'REC-SP-ZERO-RES',
            title: 'Savings Plan with Zero-Cost Resource',
            category: 'pricing-model',
            priority: 'medium',
            affectedResourceIds: ['ec2-zero', 'ec2-active'],
            currentConfiguration: { pricing_model: 'On-Demand' },
            proposedConfiguration: { pricing_model: 'Savings Plan' },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 80.0,
            estimatedMonthlySavings: 20.0,
            savingsPercentage: 20,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          },
        ];

        const analysis = CostOptimizationEngine.calculateAchievableSavings(recs, costs);
        expect(analysis.combinedAchievableSavings).toBe(20.0);

        // Rounding boundary test: 3 resources of $33.33, $33.33, $33.34 = $100.00
        const splitCosts = new Map<string, number>([
          ['res-1', 33.33],
          ['res-2', 33.33],
          ['res-3', 33.34],
        ]);

        const splitRecs: CostOptimizationRecommendation[] = [
          {
            recommendationId: 'REC-SP-SPLIT',
            title: '10 Percent Savings Plan Split Across 3 Resources',
            category: 'pricing-model',
            priority: 'high',
            affectedResourceIds: ['res-1', 'res-2', 'res-3'],
            currentConfiguration: { pricing_model: 'On-Demand' },
            proposedConfiguration: { pricing_model: 'Savings Plan' },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 90.0,
            estimatedMonthlySavings: 10.0,
            savingsPercentage: 10,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          },
        ];

        const splitAnalysis = CostOptimizationEngine.calculateAchievableSavings(splitRecs, splitCosts);
        // Total allocated reconciles exactly to 10.00
        expect(splitAnalysis.combinedAchievableSavings).toBe(10.0);
      });

      it('guarantees exact cross-engine parity between backend and frontend on critical optimization fixes', async () => {
        const { calculateAchievableSavings: frontendCalc } = await import(
          '../../../../frontend/src/features/cost-explorer/engine/clientCostCalculator.js'
        );

        // Test 1: Unequal SP allocation
        const spCosts = new Map<string, number>([
          ['ec2-a', 20.0],
          ['ec2-b', 180.0],
        ]);
        const spRecs: CostOptimizationRecommendation[] = [
          {
            recommendationId: 'REC-SP-PARITY',
            title: 'Parity 10% Savings Plan',
            category: 'pricing-model',
            priority: 'high',
            affectedResourceIds: ['ec2-a', 'ec2-b'],
            currentConfiguration: { pricing_model: 'On-Demand' },
            proposedConfiguration: { pricing_model: 'Savings Plan' },
            explanation: '',
            estimatedCurrentCost: 200.0,
            estimatedOptimizedCost: 180.0,
            estimatedMonthlySavings: 20.0,
            savingsPercentage: 10,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          },
        ];

        const backendSp = CostOptimizationEngine.calculateAchievableSavings(spRecs, spCosts);
        const frontendSp = frontendCalc(spRecs as any, spCosts);
        expect(backendSp.combinedAchievableSavings).toBe(frontendSp.combinedAchievableSavings);
        expect(backendSp.overlapNotes).toEqual(frontendSp.overlapNotes);

        // Test 2: > 15 recommendations conflict component
        const compRecs: CostOptimizationRecommendation[] = [
          {
            recommendationId: 'REC-DOMINANT',
            title: 'Dominant',
            category: 'compute',
            priority: 'high',
            affectedResourceIds: ['ec2-1', 'ec2-2'],
            currentConfiguration: { instance_type: 'm5.large' },
            proposedConfiguration: { instance_type: 'm6g.large' },
            explanation: '',
            estimatedCurrentCost: 200.0,
            estimatedOptimizedCost: 100.0,
            estimatedMonthlySavings: 100.0,
            savingsPercentage: 50,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          },
          {
            recommendationId: 'REC-SUB-1',
            title: 'Sub 1',
            category: 'compute',
            priority: 'high',
            affectedResourceIds: ['ec2-1'],
            currentConfiguration: { instance_type: 'm5.large' },
            proposedConfiguration: { instance_type: 'c6g.large' },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 40.0,
            estimatedMonthlySavings: 60.0,
            savingsPercentage: 60,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          },
          {
            recommendationId: 'REC-SUB-2',
            title: 'Sub 2',
            category: 'compute',
            priority: 'high',
            affectedResourceIds: ['ec2-2'],
            currentConfiguration: { instance_type: 'm5.large' },
            proposedConfiguration: { instance_type: 'c6g.large' },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 40.0,
            estimatedMonthlySavings: 60.0,
            savingsPercentage: 60,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          },
        ];
        for (let i = 3; i <= 15; i++) {
          compRecs.push({
            recommendationId: `REC-EXTRA-${i}`,
            title: `Extra ${i}`,
            category: 'compute',
            priority: 'low',
            affectedResourceIds: ['ec2-1'],
            currentConfiguration: { instance_type: 'm5.large' },
            proposedConfiguration: { instance_type: `t4g.${i}xlarge` },
            explanation: '',
            estimatedCurrentCost: 100.0,
            estimatedOptimizedCost: 98.0,
            estimatedMonthlySavings: 2.0,
            savingsPercentage: 2,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'low',
            requiredAssumptions: [],
            documentationReferences: [],
            status: 'pending',
          });
        }
        const compCosts = new Map<string, number>([
          ['ec2-1', 100.0],
          ['ec2-2', 100.0],
        ]);

        const backendComp = CostOptimizationEngine.calculateAchievableSavings(compRecs, compCosts);
        const frontendComp = frontendCalc(compRecs as any, compCosts);
        expect(backendComp.combinedAchievableSavings).toBe(120.0);
        expect(frontendComp.combinedAchievableSavings).toBe(120.0);
        expect(backendComp.combinedAchievableSavings).toBe(frontendComp.combinedAchievableSavings);
        expect(backendComp.overlapNotes).toEqual(frontendComp.overlapNotes);
      });
    });
  });

  describe('Apply All Optimization (Phase 09)', () => {
    function makeRecommendation(overrides: Partial<any> = {}): any {
      return {
        recommendationId: 'REC-1',
        title: 'Test Recommendation',
        category: 'compute',
        priority: 'high',
        affectedResourceIds: ['ec2-1'],
        currentConfiguration: { instance_type: 't3.micro' },
        proposedConfiguration: { instance_type: 't4g.micro' },
        explanation: 'Test',
        estimatedCurrentCost: 100.0,
        estimatedOptimizedCost: 80.0,
        estimatedMonthlySavings: 20.0,
        savingsPercentage: 20,
        currency: 'USD',
        performanceImpact: 'neutral',
        securityImpact: 'neutral',
        availabilityImpact: 'neutral',
        implementationEffort: 'low',
        confidenceLevel: 'high',
        requiredAssumptions: [],
        documentationReferences: [],
        status: 'pending',
        ...overrides,
      };
    }

    function mockCalculateCost(recs: any[]) {
      return vi.spyOn(PricingService, 'calculateCost').mockResolvedValue({
        architectureId: 'arch-1',
        region: 'us-east-1',
        currency: 'USD',
        totalEstimatedMonthly: 100.0,
        totalEstimatedHourly: 0.14,
        totalEstimatedAnnual: 1200.0,
        assumptions: getDefaultAssumptions(),
        serviceBreakdown: [],
        resourceItems: [],
        missingAssumptions: [],
        potentialMonthlySavings: recs.reduce((sum, r) => sum + r.estimatedMonthlySavings, 0),
        recommendations: recs,
        calculatedAt: new Date().toISOString(),
      } as any);
    }

    beforeEach(() => {
      mockArchitectures.push({
        id: 'arch-1',
        userId: 'user-1',
        name: 'Test Arch',
        description: null,
        region: 'us-east-1',
        status: 'draft',
        resourceCount: 2,
        nodes: [
          {
            id: 'ec2-1',
            type: 'awsResource',
            data: {
              resourceType: 'aws_instance',
              label: 'EC2 1',
              metadata: { instance_type: 't3.micro', ami: 'ami-0c55b159cbfafe1f0' },
            },
          },
          {
            id: 'ec2-2',
            type: 'awsResource',
            data: {
              resourceType: 'aws_instance',
              label: 'EC2 2',
              metadata: { instance_type: 't3.micro', ami: 'ami-0c55b159cbfafe1f0' },
            },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    afterEach(() => {
      mockArchitectures.length = 0;
      vi.restoreAllMocks();
    });

    it('applies multiple non-conflicting recommendations', async () => {
      const recs = [
        makeRecommendation({ recommendationId: 'REC-1', affectedResourceIds: ['ec2-1'], proposedConfiguration: { instance_type: 't4g.micro' } }),
        makeRecommendation({ recommendationId: 'REC-2', affectedResourceIds: ['ec2-2'], proposedConfiguration: { volume_type: 'gp3' } }),
      ];
      mockCalculateCost(recs);

      const result = await PricingService.applyAllOptimizations('arch-1', 'user-1');

      expect(result.summary.applied).toHaveLength(2);
      expect(result.summary.conflicting).toHaveLength(0);
      expect(result.summary.failed).toHaveLength(0);
      expect(result.summary.skipped).toHaveLength(0);
      expect(mockPrisma.architecture.update).toHaveBeenCalledTimes(1);
    });

    it('detects same-key conflicting recommendations', async () => {
      const recs = [
        makeRecommendation({ recommendationId: 'REC-1', affectedResourceIds: ['ec2-1'], proposedConfiguration: { instance_type: 't4g.micro' } }),
        makeRecommendation({ recommendationId: 'REC-2', affectedResourceIds: ['ec2-1'], proposedConfiguration: { instance_type: 'c6g.large' } }),
      ];
      mockCalculateCost(recs);

      const result = await PricingService.applyAllOptimizations('arch-1', 'user-1');

      expect(result.summary.conflicting).toHaveLength(2);
      expect(result.summary.applied).toHaveLength(0);
      expect(result.summary.conflicting[0].conflictingWith).toContain('REC-2');
      expect(result.summary.conflicting[1].conflictingWith).toContain('REC-1');
    });

    it('applies different-key non-conflicting recommendations on same resource', async () => {
      const recs = [
        makeRecommendation({ recommendationId: 'REC-1', affectedResourceIds: ['ec2-1'], proposedConfiguration: { instance_type: 't4g.micro' } }),
        makeRecommendation({ recommendationId: 'REC-2', affectedResourceIds: ['ec2-1'], proposedConfiguration: { root_volume_size: 100 } }),
      ];
      mockCalculateCost(recs);

      const result = await PricingService.applyAllOptimizations('arch-1', 'user-1');

      expect(result.summary.applied).toHaveLength(2);
      expect(result.summary.conflicting).toHaveLength(0);
    });

    it('counts recommendation affecting multiple resources only once', async () => {
      const recs = [
        makeRecommendation({ recommendationId: 'REC-1', affectedResourceIds: ['ec2-1', 'ec2-2'], proposedConfiguration: { instance_type: 't4g.micro' } }),
      ];
      mockCalculateCost(recs);

      const result = await PricingService.applyAllOptimizations('arch-1', 'user-1');

      expect(result.summary.applied).toHaveLength(1);
      expect(result.summary.applied[0]).toBe('REC-1');
    });

    it('handles missing target resource IDs gracefully', async () => {
      const recs = [
        makeRecommendation({ recommendationId: 'REC-1', affectedResourceIds: ['nonexistent-resource'], proposedConfiguration: { instance_type: 't4g.micro' } }),
      ];
      mockCalculateCost(recs);

      const result = await PricingService.applyAllOptimizations('arch-1', 'user-1');

      // No node matches 'nonexistent-resource', so nothing is applied
      expect(result.summary.applied).toHaveLength(0);
    });

    it('returns ownership violation error', async () => {
      const recs = [makeRecommendation()];
      mockCalculateCost(recs);

      // Use wrong userId
      await expect(PricingService.applyAllOptimizations('arch-1', 'user-2')).rejects.toThrow(/access to this architecture/);
    });

    it('returns unambiguous result when database update fails', async () => {
      const recs = [makeRecommendation()];
      mockCalculateCost(recs);

      // Make update fail
      mockPrisma.architecture.update.mockRejectedValueOnce(new Error('DB connection lost'));

      const result = await PricingService.applyAllOptimizations('arch-1', 'user-1');

      expect(result.summary.failed).toHaveLength(1);
      expect(result.summary.applied).toHaveLength(0);
    });

    it('handles empty recommendations list', async () => {
      mockCalculateCost([]);

      const result = await PricingService.applyAllOptimizations('arch-1', 'user-1');

      expect(result.summary.applied).toHaveLength(0);
      expect(result.summary.skipped).toHaveLength(0);
      expect(result.summary.conflicting).toHaveLength(0);
      expect(result.summary.failed).toHaveLength(0);
      expect(result.summary.partialTargets).toHaveLength(0);
    });

    it('handles partial target availability (some targets exist, some missing)', async () => {
      const recs = [
        makeRecommendation({ recommendationId: 'REC-1', affectedResourceIds: ['ec2-1', 'missing-resource'], proposedConfiguration: { instance_type: 't4g.micro' } }),
      ];
      mockCalculateCost(recs);

      const result = await PricingService.applyAllOptimizations('arch-1', 'user-1');

      // ec2-1 exists, missing-resource doesn't → partial target
      expect(result.summary.applied).toHaveLength(0);
      expect(result.summary.partialTargets).toHaveLength(1);
      expect(result.summary.partialTargets[0]).toBe('REC-1');
      expect(result.summary.failed).toHaveLength(0);
      expect(result.summary.conflicting).toHaveLength(0);
    });

    it('returns unambiguous result when cost recalculation fails after DB update', async () => {
      const recs = [makeRecommendation()];
      mockCalculateCost(recs);

      // First call (current cost) succeeds, second call (recalculation) fails
      const calcSpy = vi.spyOn(PricingService, 'calculateCost');
      calcSpy.mockResolvedValueOnce({
        architectureId: 'arch-1',
        region: 'us-east-1',
        currency: 'USD',
        totalEstimatedMonthly: 100.0,
        totalEstimatedHourly: 0.14,
        totalEstimatedAnnual: 1200.0,
        assumptions: getDefaultAssumptions(),
        serviceBreakdown: [],
        resourceItems: [],
        missingAssumptions: [],
        potentialMonthlySavings: 20.0,
        recommendations: recs,
        calculatedAt: new Date().toISOString(),
      } as any);
      calcSpy.mockRejectedValueOnce(new Error('Pricing engine unavailable'));

      const result = await PricingService.applyAllOptimizations('arch-1', 'user-1');

      // DB update succeeded (applied), but recalculation failed
      expect(result.summary.applied).toHaveLength(1);
      expect(result.summary.recalculationFailed).toBe(true);
      // Result falls back to pre-update cost
      expect(result.result.totalEstimatedMonthly).toBe(100.0);
    });
  });
});
