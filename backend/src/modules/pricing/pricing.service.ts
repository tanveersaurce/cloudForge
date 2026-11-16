import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { BASE_PRICING_RATES, PRICING_METADATA, REGION_PRICE_MULTIPLIERS } from './data/awsPricingCatalog.js';
import { CostCalculator } from './engine/costCalculator.js';
import { CostOptimizationEngine } from './engine/optimizationEngine.js';
import type {
  CostEstimationResult,
  PricingDimensionRate,
  WorkloadAssumptions,
} from './types/pricing.types.js';
import { getDefaultAssumptions, WORKLOAD_PRESETS } from './utils/workloadPresets.js';

export class PricingService {
  public static getServices() {
    return [
      { code: 'AmazonEC2', name: 'Amazon Elastic Compute Cloud (EC2)', category: 'Compute' },
      { code: 'AmazonRDS', name: 'Amazon Relational Database Service (RDS)', category: 'Database' },
      { code: 'AmazonS3', name: 'Amazon Simple Storage Service (S3)', category: 'Storage' },
      { code: 'AmazonVPC', name: 'Amazon Virtual Private Cloud & NAT Gateways', category: 'Networking' },
      { code: 'ElasticLoadBalancing', name: 'Elastic Load Balancing (ALB/NLB)', category: 'Networking' },
      { code: 'AWSLambda', name: 'AWS Lambda (Serverless Compute)', category: 'Compute' },
      { code: 'AmazonCloudFront', name: 'Amazon CloudFront CDN', category: 'Networking & Content Delivery' },
      { code: 'AWSDataTransfer', name: 'AWS Regional & Internet Data Transfer', category: 'Networking' },
    ];
  }

  public static getRegions() {
    return Object.entries(REGION_PRICE_MULTIPLIERS).map(([region, multiplier]) => ({
      region,
      name: region,
      multiplier,
      isDefault: region === 'us-east-1',
    }));
  }

  public static getServicePricing(serviceCode: string, region: string = 'us-east-1'): PricingDimensionRate[] {
    const multiplier = REGION_PRICE_MULTIPLIERS[region] ?? 1.0;
    const rates: PricingDimensionRate[] = [];

    for (const [key, base] of Object.entries(BASE_PRICING_RATES)) {
      if (base.serviceCode.toLowerCase() === serviceCode.toLowerCase()) {
        rates.push({
          serviceCode: base.serviceCode,
          resourceType: base.resourceType,
          region,
          dimension: key,
          unit: base.unit,
          pricePerUnit: Math.round(base.price * multiplier * 1000000) / 1000000,
          currency: 'USD',
          priceType: 'OnDemand',
          source: PRICING_METADATA.source,
          retrievedAt: PRICING_METADATA.retrievalTimestamp,
        });
      }
    }

    return rates;
  }

  public static async getCostAssumptions(
    architectureId: string,
    userId: string,
  ): Promise<WorkloadAssumptions> {
    const arch = await prisma.architecture.findUnique({
      where: { id: architectureId },
    });

    if (!arch) throw ApiError.notFound('Architecture not found');
    if (!arch.userId || arch.userId !== userId) {
      throw new ApiError(403, 'You do not have access to this architecture', 'FORBIDDEN');
    }

    try {
      const stored = await prisma.costAssumptions.findUnique({
        where: { architectureId },
      });
      if (stored) {
        return {
          preset: stored.preset as WorkloadAssumptions['preset'],
          monthlyOperatingHours: stored.monthlyOperatingHours,
          averageCpuUtilization: stored.averageCpuUtilization,
          monthlyDataTransferOutGb: stored.monthlyDataTransferOutGb,
          monthlyS3StorageGb: stored.monthlyS3StorageGb,
          monthlyS3Requests: stored.monthlyS3Requests,
          monthlyNatTrafficGb: stored.monthlyNatTrafficGb,
          monthlyLambdaInvocations: stored.monthlyLambdaInvocations,
          averageLambdaDurationMs: stored.averageLambdaDurationMs,
        };
      }
    } catch {
      // Table may not exist yet in unmigrated database
    }

    return getDefaultAssumptions();
  }

  public static async saveCostAssumptions(
    architectureId: string,
    userId: string,
    patch: Partial<WorkloadAssumptions>,
  ): Promise<WorkloadAssumptions> {
    const arch = await prisma.architecture.findUnique({
      where: { id: architectureId },
    });

    if (!arch) throw ApiError.notFound('Architecture not found');
    if (!arch.userId || arch.userId !== userId) {
      throw new ApiError(403, 'You do not have access to this architecture', 'FORBIDDEN');
    }

    const base = patch.preset && WORKLOAD_PRESETS[patch.preset]
      ? WORKLOAD_PRESETS[patch.preset]
      : getDefaultAssumptions();

    const merged = { ...base, ...patch };

    try {
      const upserted = await prisma.costAssumptions.upsert({
        where: { architectureId },
        create: {
          architectureId,
          preset: merged.preset,
          monthlyOperatingHours: merged.monthlyOperatingHours,
          averageCpuUtilization: merged.averageCpuUtilization,
          monthlyDataTransferOutGb: merged.monthlyDataTransferOutGb,
          monthlyS3StorageGb: merged.monthlyS3StorageGb,
          monthlyS3Requests: merged.monthlyS3Requests,
          monthlyNatTrafficGb: merged.monthlyNatTrafficGb,
          monthlyLambdaInvocations: merged.monthlyLambdaInvocations,
          averageLambdaDurationMs: merged.averageLambdaDurationMs,
        },
        update: {
          preset: merged.preset,
          monthlyOperatingHours: merged.monthlyOperatingHours,
          averageCpuUtilization: merged.averageCpuUtilization,
          monthlyDataTransferOutGb: merged.monthlyDataTransferOutGb,
          monthlyS3StorageGb: merged.monthlyS3StorageGb,
          monthlyS3Requests: merged.monthlyS3Requests,
          monthlyNatTrafficGb: merged.monthlyNatTrafficGb,
          monthlyLambdaInvocations: merged.monthlyLambdaInvocations,
          averageLambdaDurationMs: merged.averageLambdaDurationMs,
        },
      });

      return {
        preset: upserted.preset as WorkloadAssumptions['preset'],
        monthlyOperatingHours: upserted.monthlyOperatingHours,
        averageCpuUtilization: upserted.averageCpuUtilization,
        monthlyDataTransferOutGb: upserted.monthlyDataTransferOutGb,
        monthlyS3StorageGb: upserted.monthlyS3StorageGb,
        monthlyS3Requests: upserted.monthlyS3Requests,
        monthlyNatTrafficGb: upserted.monthlyNatTrafficGb,
        monthlyLambdaInvocations: upserted.monthlyLambdaInvocations,
        averageLambdaDurationMs: upserted.averageLambdaDurationMs,
      };
    } catch {
      // If table is not present, safely return merged assumptions
      return merged;
    }
  }

  public static async calculateCost(
    architectureId: string,
    userId: string,
    overrideAssumptions?: Partial<WorkloadAssumptions>,
  ): Promise<CostEstimationResult> {
    const arch = await prisma.architecture.findUnique({
      where: { id: architectureId },
    });

    if (!arch) throw ApiError.notFound('Architecture not found');
    if (!arch.userId || arch.userId !== userId) {
      throw new ApiError(403, 'You do not have access to this architecture', 'FORBIDDEN');
    }

    let storedAssumptions: WorkloadAssumptions | null = null;
    try {
      const dbAssumptions = await prisma.costAssumptions.findUnique({
        where: { architectureId },
      });
      if (dbAssumptions) {
        storedAssumptions = {
          preset: dbAssumptions.preset as WorkloadAssumptions['preset'],
          monthlyOperatingHours: dbAssumptions.monthlyOperatingHours,
          averageCpuUtilization: dbAssumptions.averageCpuUtilization,
          monthlyDataTransferOutGb: dbAssumptions.monthlyDataTransferOutGb,
          monthlyS3StorageGb: dbAssumptions.monthlyS3StorageGb,
          monthlyS3Requests: dbAssumptions.monthlyS3Requests,
          monthlyNatTrafficGb: dbAssumptions.monthlyNatTrafficGb,
          monthlyLambdaInvocations: dbAssumptions.monthlyLambdaInvocations,
          averageLambdaDurationMs: dbAssumptions.averageLambdaDurationMs,
        };
      }
    } catch {
      // Table may not exist yet in database
    }

    const baseAssumptions = storedAssumptions || getDefaultAssumptions();
    const assumptions = overrideAssumptions
      ? { ...baseAssumptions, ...overrideAssumptions }
      : baseAssumptions;

    let nodes: Array<{
      id: string;
      type: string;
      data: {
        resourceType: string;
        resourceName?: string;
        label?: string;
        metadata?: Record<string, unknown>;
        [key: string]: unknown;
      };
    }> = [];

    if (Array.isArray(arch.nodes)) {
      nodes = arch.nodes as typeof nodes;
    } else if (typeof arch.nodes === 'string') {
      try {
        const parsed = JSON.parse(arch.nodes);
        if (Array.isArray(parsed)) nodes = parsed;
      } catch {
        nodes = [];
      }
    }

    // 1. Calculate baseline cost
    const costResult = CostCalculator.calculateCost(
      architectureId,
      arch.region || 'us-east-1',
      nodes,
      assumptions,
    );

    // 2. Generate Intelligent Cost Optimization Recommendations
    const recommendations = CostOptimizationEngine.generateRecommendations(
      nodes,
      assumptions,
      arch.region || 'us-east-1',
      costResult,
    );

    const resourceCostMap = new Map<string, number>();
    for (const item of costResult.resourceItems) {
      resourceCostMap.set(item.resourceId, item.monthlyCost);
    }
    const savingsAnalysis = CostOptimizationEngine.calculateAchievableSavings(recommendations, resourceCostMap);

    const fullResult: CostEstimationResult = {
      ...costResult,
      potentialMonthlySavings: savingsAnalysis.combinedAchievableSavings,
      individualSavingsSum: savingsAnalysis.individualSavingsSum,
      hasOverlappingRecommendations: savingsAnalysis.hasOverlappingRecommendations,
      recommendations,
    };

    // 3. Persist estimation run to database for history
    try {
      await prisma.costEstimationRun.create({
        data: {
          architectureId,
          currency: 'USD',
          totalEstimatedMonthly: fullResult.totalEstimatedMonthly,
          totalEstimatedHourly: fullResult.totalEstimatedHourly,
          serviceBreakdown: fullResult.serviceBreakdown as unknown as Prisma.InputJsonValue,
          resourceItems: fullResult.resourceItems as unknown as Prisma.InputJsonValue,
          potentialMonthlySavings: fullResult.potentialMonthlySavings,
          recommendations: fullResult.recommendations as unknown as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Non-blocking history record
    }

    return fullResult;
  }

  public static async applyOptimization(
    architectureId: string,
    userId: string,
    recommendationId: string,
  ): Promise<CostEstimationResult> {
    const arch = await prisma.architecture.findUnique({
      where: { id: architectureId },
    });

    if (!arch) throw ApiError.notFound('Architecture not found');
    if (!arch.userId || arch.userId !== userId) {
      throw new ApiError(403, 'You do not have access to this architecture', 'FORBIDDEN');
    }

    // Calculate current to find recommendation
    const current = await this.calculateCost(architectureId, userId);
    const rec = current.recommendations.find((r) => r.recommendationId === recommendationId);

    if (!rec) {
      throw ApiError.notFound(`Recommendation "${recommendationId}" not found or no longer applicable`);
    }

    const nodes = (Array.isArray(arch.nodes) ? arch.nodes : []) as Array<{
      id: string;
      type: string;
      data: {
        resourceType: string;
        resourceName?: string;
        label?: string;
        metadata?: Record<string, unknown>;
        [key: string]: unknown;
      };
    }>;

    // Apply configuration changes to target resources
    let updatedNodesCount = 0;
    const modifiedNodes = nodes.map((node) => {
      if (rec.affectedResourceIds.includes(node.id)) {
        updatedNodesCount++;
        return {
          ...node,
          data: {
            ...node.data,
            metadata: {
              ...(node.data.metadata || {}),
              ...rec.proposedConfiguration,
            },
          },
        };
      }
      return node;
    });

    if (updatedNodesCount > 0) {
      await prisma.architecture.update({
        where: { id: architectureId },
        data: {
          nodes: modifiedNodes as unknown as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
    }

    // Recalculate cost with new configuration
    return this.calculateCost(architectureId, userId);
  }

  public static async applyAllOptimizations(
    architectureId: string,
    userId: string,
  ): Promise<{
    result: CostEstimationResult;
    summary: {
      applied: string[];
      skipped: string[];
      conflicting: Array<{
        recommendationId: string;
        title: string;
        reason: string;
        conflictingWith: string[];
      }>;
      failed: string[];
    };
  }> {
    const arch = await prisma.architecture.findUnique({
      where: { id: architectureId },
    });

    if (!arch) throw ApiError.notFound('Architecture not found');
    if (!arch.userId || arch.userId !== userId) {
      throw new ApiError(403, 'You do not have access to this architecture', 'FORBIDDEN');
    }

    const current = await this.calculateCost(architectureId, userId);
    const recommendations = current.recommendations.filter((r) => r.status === 'pending');

    if (recommendations.length === 0) {
      return {
        result: current,
        summary: { applied: [], skipped: [], conflicting: [], failed: [] },
      };
    }

    // --- Step 1: Conflict Detection ---
    // Group recommendations by affected resource ID
    const recsByResource = new Map<string, typeof recommendations>();
    for (const rec of recommendations) {
      for (const resId of rec.affectedResourceIds) {
        const list = recsByResource.get(resId) ?? [];
        list.push(rec);
        recsByResource.set(resId, list);
      }
    }

    // Find conflicting recommendations: same resource, same config key, different value
    const conflictingIds = new Set<string>();
    const conflictingDetails = new Map<
      string,
      { title: string; reason: string; conflictingWith: string[] }
    >();

    for (const [resId, recs] of recsByResource) {
      if (recs.length <= 1) continue;

      // Compare each pair of recommendations on this resource
      for (let i = 0; i < recs.length; i++) {
        for (let j = i + 1; j < recs.length; j++) {
          const a = recs[i];
          const b = recs[j];
          const conflictKeys: string[] = [];

          const aKeys = Object.keys(a.proposedConfiguration || {});

          for (const key of aKeys) {
            if (key in b.proposedConfiguration) {
              const aVal = JSON.stringify(a.proposedConfiguration[key]);
              const bVal = JSON.stringify(b.proposedConfiguration[key]);
              if (aVal !== bVal) {
                conflictKeys.push(key);
              }
            }
          }

          if (conflictKeys.length > 0) {
            conflictingIds.add(a.recommendationId);
            conflictingIds.add(b.recommendationId);

            const reason = `Conflicting configuration on resource "${resId}": ${conflictKeys.join(', ')}`;
            if (!conflictingDetails.has(a.recommendationId)) {
              conflictingDetails.set(a.recommendationId, {
                title: a.title,
                reason,
                conflictingWith: [b.recommendationId],
              });
            } else {
              const d = conflictingDetails.get(a.recommendationId)!;
              if (!d.conflictingWith.includes(b.recommendationId)) {
                d.conflictingWith.push(b.recommendationId);
              }
            }

            if (!conflictingDetails.has(b.recommendationId)) {
              conflictingDetails.set(b.recommendationId, {
                title: b.title,
                reason,
                conflictingWith: [a.recommendationId],
              });
            } else {
              const d = conflictingDetails.get(b.recommendationId)!;
              if (!d.conflictingWith.includes(a.recommendationId)) {
                d.conflictingWith.push(a.recommendationId);
              }
            }
          }
        }
      }
    }

    const conflictingList = Array.from(conflictingDetails.entries()).map(
      ([recommendationId, detail]) => ({
        recommendationId,
        title: detail.title,
        reason: detail.reason,
        conflictingWith: detail.conflictingWith,
      }),
    );

    // --- Step 2: Apply only non-conflicting recommendations ---
    const nonConflictingRecs = recommendations.filter(
      (r) => !conflictingIds.has(r.recommendationId),
    );

    const appliedIds: string[] = [];
    const skippedIds: string[] = [];
    const failedIds: string[] = [];

    if (nonConflictingRecs.length === 0) {
      return {
        result: current,
        summary: {
          applied: [],
          skipped: skippedIds,
          conflicting: conflictingList,
          failed: [],
        },
      };
    }

    const nodes = (Array.isArray(arch.nodes) ? arch.nodes : []) as Array<{
      id: string;
      type: string;
      data: {
        resourceType: string;
        resourceName?: string;
        label?: string;
        metadata?: Record<string, unknown>;
        [key: string]: unknown;
      };
    }>;

    const modifiedNodes = nodes.map((node) => {
      const applicableRecs = nonConflictingRecs.filter((r) =>
        r.affectedResourceIds.includes(node.id),
      );

      if (applicableRecs.length === 0) return node;

      // Merge all proposed configurations; later recs override earlier ones
      const mergedMetadata = applicableRecs.reduce(
        (acc, rec) => ({ ...acc, ...rec.proposedConfiguration }),
        {} as Record<string, unknown>,
      );

      for (const rec of applicableRecs) {
        if (!appliedIds.includes(rec.recommendationId)) {
          appliedIds.push(rec.recommendationId);
        }
      }

      return {
        ...node,
        data: {
          ...node.data,
          metadata: {
            ...(node.data.metadata || {}),
            ...mergedMetadata,
          },
        },
      };
    });

    try {
      await prisma.architecture.update({
        where: { id: architectureId },
        data: {
          nodes: modifiedNodes as unknown as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      // Transaction failed — nothing was applied
      failedIds.push(...nonConflictingRecs.map((r) => r.recommendationId));
      return {
        result: current,
        summary: {
          applied: [],
          skipped: [],
          conflicting: conflictingList,
          failed: failedIds,
        },
      };
    }

    // Mark skipped (pending but not applied due to being on resources with conflicts)
    for (const rec of recommendations) {
      if (!appliedIds.includes(rec.recommendationId) && !conflictingIds.has(rec.recommendationId)) {
        skippedIds.push(rec.recommendationId);
      }
    }

    // Recalculate cost with all optimizations applied
    const result = await this.calculateCost(architectureId, userId);

    return {
      result,
      summary: {
        applied: appliedIds,
        skipped: skippedIds,
        conflicting: conflictingList,
        failed: failedIds,
      },
    };
  }
}
