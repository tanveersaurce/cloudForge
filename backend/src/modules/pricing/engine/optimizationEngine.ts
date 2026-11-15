import { getPriceRate } from '../data/awsPricingCatalog.js';
import type {
  CostEstimationResult,
  CostOptimizationRecommendation,
  WorkloadAssumptions,
} from '../types/pricing.types.js';

interface ArchitectureNodeInput {
  id: string;
  type: string;
  data: {
    resourceType: string;
    resourceName?: string;
    label?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export class CostOptimizationEngine {
  public static generateRecommendations(
    nodes: ArchitectureNodeInput[],
    assumptions: WorkloadAssumptions,
    region: string = 'us-east-1',
    costResult: Omit<CostEstimationResult, 'recommendations' | 'potentialMonthlySavings'>,
  ): CostOptimizationRecommendation[] {
    const recommendations: CostOptimizationRecommendation[] = [];

    // 1. EC2 Graviton Alternative (t3 -> t4g, m5 -> m6g)
    const ec2Nodes = nodes.filter((n) => n.data.resourceType === 'aws_instance');
    for (const ec2 of ec2Nodes) {
      const currentType = (ec2.data.metadata?.instance_type as string) || 't3.micro';

      // Check Graviton counterpart
      let gravitonType: string | null = null;
      if (currentType === 't3.micro') gravitonType = 't4g.micro';
      else if (currentType === 't3.small') gravitonType = 't4g.small';
      else if (currentType === 't3.medium') gravitonType = 't4g.medium';
      else if (currentType === 't3.large') gravitonType = 't4g.large';
      else if (currentType === 'm5.large') gravitonType = 'm6g.large';
      else if (currentType === 'm5.xlarge') gravitonType = 'm6g.xlarge';

      if (gravitonType) {
        const currentRate = getPriceRate(`ec2:${currentType}`, region);
        const gravRate = getPriceRate(`ec2:${gravitonType}`, region);

        if (currentRate && gravRate) {
          const currentMonthly = currentRate.pricePerUnit * assumptions.monthlyOperatingHours;
          const optimizedMonthly = gravRate.pricePerUnit * assumptions.monthlyOperatingHours;
          const savings = Math.max(0, currentMonthly - optimizedMonthly);

          if (savings > 0) {
            const savingsPercent = Math.round((savings / currentMonthly) * 100);
            recommendations.push({
              recommendationId: `OPT-COMPUTE-GRAVITON-${ec2.id}`,
              title: `Adopt AWS Graviton (${gravitonType}) for ${ec2.data.label || currentType}`,
              category: 'compute',
              priority: 'high',
              affectedResourceIds: [ec2.id],
              currentConfiguration: { instance_type: currentType },
              proposedConfiguration: { instance_type: gravitonType },
              explanation: `Switching from ${currentType} (x86) to ${gravitonType} (ARM64 Graviton) provides up to 20% lower hourly pricing with superior compute price-performance. Ensure your application binary or runtime container supports ARM64 architecture.`,
              estimatedCurrentCost: Math.round(currentMonthly * 100) / 100,
              estimatedOptimizedCost: Math.round(optimizedMonthly * 100) / 100,
              estimatedMonthlySavings: Math.round(savings * 100) / 100,
              savingsPercentage: savingsPercent,
              currency: 'USD',
              performanceImpact: 'improved',
              securityImpact: 'neutral',
              availabilityImpact: 'neutral',
              implementationEffort: 'low',
              confidenceLevel: 'high',
              requiredAssumptions: [
                'Application workload supports ARM64 architecture or interpreted runtimes (Node.js, Python, Go, Java, Docker Multi-Arch).',
              ],
              documentationReferences: [
                {
                  title: 'AWS Graviton Processor Overview',
                  url: 'https://aws.amazon.com/ec2/graviton/',
                },
              ],
              status: 'pending',
            });
          }
        }
      }
    }

    // 2. Storage Optimization: EBS gp2 -> gp3
    const ebsNodes = nodes.filter((n) => n.data.resourceType === 'aws_ebs_volume');
    for (const ebs of ebsNodes) {
      const currentType = (ebs.data.metadata?.volume_type as string) || 'gp2';
      const sizeGb = Number(ebs.data.metadata?.size || 50);

      if (currentType === 'gp2') {
        const gp2Rate = getPriceRate('ebs:gp2', region);
        const gp3Rate = getPriceRate('ebs:gp3', region);

        if (gp2Rate && gp3Rate) {
          const currentMonthly = sizeGb * gp2Rate.pricePerUnit;
          const optimizedMonthly = sizeGb * gp3Rate.pricePerUnit;
          const savings = currentMonthly - optimizedMonthly;

          recommendations.push({
            recommendationId: `OPT-STORAGE-GP3-${ebs.id}`,
            title: `Upgrade EBS Volume "${ebs.data.label || ebs.id}" from gp2 to gp3`,
            category: 'storage',
            priority: 'high',
            affectedResourceIds: [ebs.id],
            currentConfiguration: { volume_type: 'gp2', size: sizeGb },
            proposedConfiguration: { volume_type: 'gp3', size: sizeGb },
            explanation: `gp3 volumes provide 20% lower cost per GB than gp2 ($0.08 vs $0.10/GB-month) while delivering a baseline 3,000 IOPS and 125 MB/s throughput independently of volume size. This modification can be applied online without volume detachment.`,
            estimatedCurrentCost: Math.round(currentMonthly * 100) / 100,
            estimatedOptimizedCost: Math.round(optimizedMonthly * 100) / 100,
            estimatedMonthlySavings: Math.round(savings * 100) / 100,
            savingsPercentage: 20,
            currency: 'USD',
            performanceImpact: 'improved',
            securityImpact: 'neutral',
            availabilityImpact: 'neutral',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: ['EBS volume modification applied via AWS Elastic Volumes API.'],
            documentationReferences: [
              {
                title: 'Migrating from gp2 to gp3 EBS Volumes',
                url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-volume-types.html',
              },
            ],
            status: 'pending',
          });
        }
      }
    }

    // 3. Database Multi-AZ in Development Preset
    if (assumptions.preset === 'Development') {
      const multiAzDbs = nodes.filter(
        (n) => n.data.resourceType === 'aws_db_instance' && n.data.metadata?.multi_az === true,
      );

      for (const db of multiAzDbs) {
        const instanceClass = (db.data.metadata?.instance_class as string) || 'db.t3.micro';
        const rate = getPriceRate(`rds:${instanceClass}`, region);

        if (rate) {
          const currentMonthly = rate.pricePerUnit * 2.0 * assumptions.monthlyOperatingHours;
          const optimizedMonthly = rate.pricePerUnit * 1.0 * assumptions.monthlyOperatingHours;
          const savings = currentMonthly - optimizedMonthly;

          recommendations.push({
            recommendationId: `OPT-DB-SINGLEAZ-${db.id}`,
            title: `Disable Multi-AZ for Non-Production Database "${db.data.label || db.id}"`,
            category: 'database',
            priority: 'medium',
            affectedResourceIds: [db.id],
            currentConfiguration: { multi_az: true, instance_class: instanceClass },
            proposedConfiguration: { multi_az: false, instance_class: instanceClass },
            explanation: `In a Development environment, running synchronous standby Multi-AZ replicas doubles instance and storage costs without adding development productivity value. Standby failover is generally only essential for production SLA workloads.`,
            estimatedCurrentCost: Math.round(currentMonthly * 100) / 100,
            estimatedOptimizedCost: Math.round(optimizedMonthly * 100) / 100,
            estimatedMonthlySavings: Math.round(savings * 100) / 100,
            savingsPercentage: 50,
            currency: 'USD',
            performanceImpact: 'neutral',
            securityImpact: 'neutral',
            availabilityImpact: 'trade-off',
            implementationEffort: 'low',
            confidenceLevel: 'high',
            requiredAssumptions: [
              'This architecture is verified as a non-production or staging tier where brief maintenance windows are acceptable.',
            ],
            documentationReferences: [
              {
                title: 'Amazon RDS Multi-AZ Deployments',
                url: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html',
              },
            ],
            status: 'pending',
          });
        }
      }
    }

    // 4. Networking Optimization: S3 Gateway Endpoint to bypass NAT Gateway data processing
    const hasNatGateway = nodes.some((n) => n.data.resourceType === 'aws_nat_gateway');
    const hasS3Bucket = nodes.some((n) => n.data.resourceType === 'aws_s3_bucket');
    const natNodes = nodes.filter((n) => n.data.resourceType === 'aws_nat_gateway');

    if (hasNatGateway && hasS3Bucket && assumptions.monthlyNatTrafficGb >= 20) {
      const dataRate = getPriceRate('nat_gateway:data', region);
      if (dataRate) {
        // Assume ~50% of NAT traffic is S3 object traffic in typical cloud workloads
        const s3TrafficGb = Math.round(assumptions.monthlyNatTrafficGb * 0.5);
        const savings = s3TrafficGb * dataRate.pricePerUnit;

        recommendations.push({
          recommendationId: `OPT-NET-S3-GATEWAY-ENDPOINT`,
          title: 'Implement Free Gateway VPC Endpoint for Amazon S3',
          category: 'networking',
          priority: 'high',
          affectedResourceIds: natNodes.map((n) => n.id),
          currentConfiguration: { s3_access_path: 'via NAT Gateway ($0.045/GB)' },
          proposedConfiguration: { s3_access_path: 'via Gateway VPC Endpoint ($0.00/GB - Free)' },
          explanation: `Routing private subnet traffic destined for Amazon S3 through a Gateway VPC Endpoint is completely free of charge ($0.00/hour and $0.00/GB). This eliminates the $0.045/GB NAT Gateway data processing fee for all S3 API transfers.`,
          estimatedCurrentCost: Math.round(assumptions.monthlyNatTrafficGb * dataRate.pricePerUnit * 100) / 100,
          estimatedOptimizedCost: Math.round((assumptions.monthlyNatTrafficGb - s3TrafficGb) * dataRate.pricePerUnit * 100) / 100,
          estimatedMonthlySavings: Math.round(savings * 100) / 100,
          savingsPercentage: Math.round((savings / (assumptions.monthlyNatTrafficGb * dataRate.pricePerUnit)) * 100),
          currency: 'USD',
          performanceImpact: 'improved',
          securityImpact: 'improved',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: [
            'Estimated that approximately 50% of outbound private traffic targets Amazon S3 buckets.',
          ],
          documentationReferences: [
            {
              title: 'Gateway Endpoints for Amazon S3',
              url: 'https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html',
            },
          ],
          status: 'pending',
        });
      }
    }

    // 5. Pricing Model: 1-Year Compute Savings Plans for Steady-State Workloads
    if (assumptions.monthlyOperatingHours >= 700 && costResult.totalEstimatedMonthly >= 50) {
      const computeTotal = costResult.serviceBreakdown.find((s) => s.serviceCode === 'AmazonEC2')?.monthlyCost || 0;
      if (computeTotal > 30) {
        const potentialSavings = Math.round(computeTotal * 0.35 * 100) / 100;
        recommendations.push({
          recommendationId: `OPT-PRICING-SAVINGS-PLANS`,
          title: 'Enroll Steady-State Compute in 1-Year Compute Savings Plans',
          category: 'pricing-model',
          priority: 'medium',
          affectedResourceIds: ec2Nodes.map((n) => n.id),
          currentConfiguration: { pricing_model: 'On-Demand (No Commitment)' },
          proposedConfiguration: { pricing_model: 'Compute Savings Plan (1-Year No Upfront)' },
          explanation: `Workloads running 24x7 (>700 hours/month) achieve approximately 35% lower hourly rates through 1-Year Compute Savings Plans. Compute Savings Plans apply automatically across EC2 instance families, regions, and AWS Lambda regardless of instance generations.`,
          estimatedCurrentCost: computeTotal,
          estimatedOptimizedCost: Math.round((computeTotal - potentialSavings) * 100) / 100,
          estimatedMonthlySavings: potentialSavings,
          savingsPercentage: 35,
          currency: 'USD',
          performanceImpact: 'neutral',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'medium',
          requiredAssumptions: [
            'Requires 1-year financial commitment to steady compute utilization baseline.',
          ],
          documentationReferences: [
            {
              title: 'AWS Savings Plans Documentation',
              url: 'https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html',
            },
          ],
          status: 'pending',
        });
      }
    }

    return recommendations.sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings);
  }

  public static calculateAchievableSavings(
    recommendations: CostOptimizationRecommendation[],
    resourceCostsInput?: Map<string, number> | Record<string, number>,
  ): {
    individualSavingsSum: number;
    combinedAchievableSavings: number;
    hasOverlappingRecommendations: boolean;
    overlapNotes: string[];
  } {
    const overlapNotes: string[] = [];

    // 1. Input Validation: Validate resource cost inputs
    const costLookup = new Map<string, number>();
    if (resourceCostsInput) {
      const entries =
        resourceCostsInput instanceof Map
          ? resourceCostsInput.entries()
          : Object.entries(resourceCostsInput);
      for (const [k, v] of entries) {
        if (typeof v === 'number' && !isNaN(v) && isFinite(v) && v >= 0) {
          costLookup.set(k, Math.round(v * 100) / 100);
        } else {
          overlapNotes.push(
            `Resource "${k}" has invalid input cost (${v}). Negative, NaN, or infinite costs are ignored and treated as unknown.`,
          );
        }
      }
    }

    // Validate recommendation numbers: estimatedCurrentCost and estimatedMonthlySavings
    const sanitizedRecs: CostOptimizationRecommendation[] = recommendations.map((r) => {
      let validCurrent = r.estimatedCurrentCost;
      let validMonthly = r.estimatedMonthlySavings;

      if (typeof validCurrent !== 'number' || isNaN(validCurrent) || !isFinite(validCurrent) || validCurrent < 0) {
        overlapNotes.push(
          `Recommendation "${r.title}" has invalid estimatedCurrentCost (${r.estimatedCurrentCost}). Treated as $0.00.`,
        );
        validCurrent = 0;
      }
      if (typeof validMonthly !== 'number' || isNaN(validMonthly) || !isFinite(validMonthly) || validMonthly < 0) {
        overlapNotes.push(
          `Recommendation "${r.title}" has invalid estimatedMonthlySavings (${r.estimatedMonthlySavings}). Treated as $0.00.`,
        );
        validMonthly = 0;
      }

      return {
        ...r,
        estimatedCurrentCost: validCurrent,
        estimatedMonthlySavings: validMonthly,
      };
    });

    const individualSavingsSum =
      Math.round(sanitizedRecs.reduce((sum, r) => sum + r.estimatedMonthlySavings, 0) * 100) / 100;

    if (sanitizedRecs.length === 0) {
      return {
        individualSavingsSum: 0,
        combinedAchievableSavings: 0,
        hasOverlappingRecommendations: overlapNotes.length > 0,
        overlapNotes,
      };
    }

    const architecturalRecs = sanitizedRecs.filter((r) => r.category !== 'pricing-model');
    const pricingModelRecs = sanitizedRecs.filter((r) => r.category === 'pricing-model');

    interface ResourceState {
      currentCost: number;
      remainingCost: number;
      appliedSavings: number;
      modifiedAttributes: Map<string, string>;
    }

    const resourceStates = new Map<string, ResourceState>();
    let combinedSavings = 0;

    function getOrInitResourceState(resId: string, fallbackShare: number): ResourceState {
      let state = resourceStates.get(resId);
      if (!state) {
        const knownCost = costLookup.get(resId);
        const initialCost = knownCost !== undefined ? knownCost : fallbackShare;
        state = {
          currentCost: initialCost,
          remainingCost: initialCost,
          appliedSavings: 0,
          modifiedAttributes: new Map(),
        };
        resourceStates.set(resId, state);
      }
      return state;
    }

    // Helper: Compute effective costs and weights for a recommendation
    // Fixes partially unknown resource costs by never silently assigning zero weight to unknown resources
    function computeAllocationCosts(
      rec: CostOptimizationRecommendation,
      currentStates: Map<string, ResourceState>,
      recordWarnings = false,
    ): {
      effectiveCosts: number[];
      weights: number[];
    } {
      const resourceCount = Math.max(1, rec.affectedResourceIds.length);
      const equalShareCost = (rec.estimatedCurrentCost || rec.estimatedMonthlySavings) / resourceCount;

      interface CostInfo {
        resId: string;
        cost: number;
        isKnown: boolean;
      }

      const costInfos: CostInfo[] = rec.affectedResourceIds.map((resId) => {
        const state = currentStates.get(resId);
        if (state !== undefined) {
          return { resId, cost: state.currentCost, isKnown: true };
        }
        if (costLookup.has(resId)) {
          return { resId, cost: costLookup.get(resId)!, isKnown: true };
        }
        return { resId, cost: 0, isKnown: false };
      });

      const knownItems = costInfos.filter((c) => c.isKnown);
      const unknownItems = costInfos.filter((c) => !c.isKnown);
      const sumKnownCosts = knownItems.reduce((sum, c) => sum + c.cost, 0);

      const effectiveCosts: number[] = [];
      let unknownFallback = 0;

      if (unknownItems.length === 0) {
        for (const item of costInfos) effectiveCosts.push(item.cost);
      } else if (knownItems.length === 0) {
        unknownFallback = rec.estimatedCurrentCost > 0 ? rec.estimatedCurrentCost / resourceCount : equalShareCost;
        for (let i = 0; i < resourceCount; i++) effectiveCosts.push(unknownFallback);
      } else {
        // Partially known: some known, some unknown. Explicit fallback allocation:
        if (rec.estimatedCurrentCost > sumKnownCosts) {
          unknownFallback = (rec.estimatedCurrentCost - sumKnownCosts) / unknownItems.length;
        } else if (knownItems.length > 0 && sumKnownCosts > 0) {
          unknownFallback = sumKnownCosts / knownItems.length;
        } else {
          unknownFallback = equalShareCost;
        }

        for (const item of costInfos) {
          effectiveCosts.push(item.isKnown ? item.cost : unknownFallback);
        }
      }

      // Record Fallback Transparency warning if costs were imputed
      if (recordWarnings && unknownItems.length > 0) {
        if (knownItems.length > 0) {
          overlapNotes.push(
            `Recommendation "${rec.title}" has partially unknown resource costs: actual known cost for [${knownItems.map((k) => `${k.resId}: $${k.cost.toFixed(2)}`).join(', ')}], and imputed estimated fallback cost of $${unknownFallback.toFixed(2)} for [${unknownItems.map((u) => u.resId).join(', ')}].`,
          );
        } else {
          overlapNotes.push(
            `Recommendation "${rec.title}" has unknown resource costs for [${unknownItems.map((u) => u.resId).join(', ')}]; imputed estimated fallback cost of $${unknownFallback.toFixed(2)} each.`,
          );
        }
      }

      const totalEffectiveCost = effectiveCosts.reduce((sum, c) => sum + c, 0);
      const weights: number[] = [];
      if (totalEffectiveCost > 0 && rec.affectedResourceIds.length > 1) {
        for (let i = 0; i < rec.affectedResourceIds.length; i++) {
          weights.push(effectiveCosts[i] / totalEffectiveCost);
        }
      } else {
        for (let i = 0; i < rec.affectedResourceIds.length; i++) {
          weights.push(1 / resourceCount);
        }
      }

      return { effectiveCosts, weights };
    }

    // Helper: Estimate achievable savings for an architectural recommendation against resource baselines
    function estimateArchitecturalAchievable(rec: CostOptimizationRecommendation): number {
      const { effectiveCosts, weights } = computeAllocationCosts(rec, resourceStates, false);

      const discountRatio =
        rec.savingsPercentage > 0
          ? Math.min(1, Math.max(0, rec.savingsPercentage / 100))
          : rec.estimatedCurrentCost > 0
            ? Math.min(1, Math.max(0, rec.estimatedMonthlySavings / rec.estimatedCurrentCost))
            : 0;

      let achievableTotal = 0;
      for (let i = 0; i < rec.affectedResourceIds.length; i++) {
        const resId = rec.affectedResourceIds[i];
        const resBaseline = effectiveCosts[i];
        const nominalShare = rec.estimatedMonthlySavings * weights[i];

        const state = resourceStates.get(resId);
        if (state) {
          const comp = Math.round(state.remainingCost * discountRatio * 100) / 100;
          achievableTotal += Math.min(state.remainingCost, comp);
        } else {
          achievableTotal += Math.min(resBaseline, nominalShare);
        }
      }

      return Math.round(Math.min(rec.estimatedMonthlySavings, achievableTotal) * 100) / 100;
    }

    // Helper: Check if two architectural recommendations conflict
    function architecturalRecsConflict(
      a: CostOptimizationRecommendation,
      b: CostOptimizationRecommendation,
    ): { hasConflict: boolean; resId?: string; key?: string } {
      const aKeys = Object.keys(a.proposedConfiguration || {});
      const bKeys = Object.keys(b.proposedConfiguration || {});
      if (aKeys.length === 0 || bKeys.length === 0) return { hasConflict: false };

      const commonKeys = aKeys.filter((k) => bKeys.includes(k));
      if (commonKeys.length === 0) return { hasConflict: false };

      for (const resId of a.affectedResourceIds) {
        if (b.affectedResourceIds.includes(resId)) {
          return { hasConflict: true, resId, key: commonKeys[0] };
        }
      }
      return { hasConflict: false };
    }

    // Simulate an architectural candidate subset to evaluate total achievable savings
    function simulateArchitecturalSubset(
      subset: CostOptimizationRecommendation[],
      initialStates: Map<string, ResourceState>,
    ): { totalSavings: number } {
      const simStates = new Map<string, ResourceState>();
      for (const [k, v] of initialStates.entries()) {
        simStates.set(k, {
          currentCost: v.currentCost,
          remainingCost: v.remainingCost,
          appliedSavings: v.appliedSavings,
          modifiedAttributes: new Map(v.modifiedAttributes),
        });
      }

      let simTotal = 0;
      for (const rec of subset) {
        const { effectiveCosts, weights } = computeAllocationCosts(rec, simStates, false);
        const discountRatio =
          rec.savingsPercentage > 0
            ? Math.min(1, Math.max(0, rec.savingsPercentage / 100))
            : rec.estimatedCurrentCost > 0
              ? Math.min(1, Math.max(0, rec.estimatedMonthlySavings / rec.estimatedCurrentCost))
              : 0;

        let recSav = 0;
        for (let i = 0; i < rec.affectedResourceIds.length; i++) {
          const resId = rec.affectedResourceIds[i];
          const weight = weights[i];
          const nominalSavings = rec.estimatedMonthlySavings * weight;
          const fallbackCost = effectiveCosts[i];

          let state = simStates.get(resId);
          if (!state) {
            const known = costLookup.get(resId);
            const init = known !== undefined ? known : fallbackCost;
            state = { currentCost: init, remainingCost: init, appliedSavings: 0, modifiedAttributes: new Map() };
            simStates.set(resId, state);

            const maxPoss = Math.min(state.remainingCost, nominalSavings);
            const alloc = Math.round(maxPoss * 100) / 100;
            state.remainingCost = Math.max(0, Math.round((state.remainingCost - alloc) * 100) / 100);
            state.appliedSavings += alloc;
            recSav += alloc;
          } else {
            const comp = Math.round(state.remainingCost * discountRatio * 100) / 100;
            const finalSav = Math.min(state.remainingCost, comp);
            state.remainingCost = Math.max(0, Math.round((state.remainingCost - finalSav) * 100) / 100);
            state.appliedSavings += finalSav;
            recSav += finalSav;
          }
        }
        recSav = Math.round(Math.min(rec.estimatedMonthlySavings, recSav) * 100) / 100;
        simTotal += recSav;
      }
      return { totalSavings: Math.round(simTotal * 100) / 100 };
    }

    // Partition architectural recommendations into conflict components and find optimal subset
    function selectOptimalArchitecturalRecs(
      recs: CostOptimizationRecommendation[],
    ): CostOptimizationRecommendation[] {
      if (recs.length <= 1) return recs;

      const sorted = [...recs].sort((a, b) => {
        const achA = estimateArchitecturalAchievable(a);
        const achB = estimateArchitecturalAchievable(b);
        if (Math.abs(achB - achA) > 0.001) return achB - achA;
        if (b.estimatedMonthlySavings !== a.estimatedMonthlySavings) {
          return b.estimatedMonthlySavings - a.estimatedMonthlySavings;
        }
        return a.recommendationId.localeCompare(b.recommendationId);
      });

      const visited = new Set<string>();
      const components: CostOptimizationRecommendation[][] = [];

      for (const rec of sorted) {
        if (visited.has(rec.recommendationId)) continue;
        const component: CostOptimizationRecommendation[] = [];
        const queue = [rec];
        visited.add(rec.recommendationId);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          component.push(curr);

          for (const other of sorted) {
            if (!visited.has(other.recommendationId)) {
              if (architecturalRecsConflict(curr, other).hasConflict) {
                visited.add(other.recommendationId);
                queue.push(other);
              }
            }
          }
        }
        components.push(component);
      }

      const optimalRecs: CostOptimizationRecommendation[] = [];

      for (const comp of components) {
        if (comp.length === 1) {
          optimalRecs.push(comp[0]);
          continue;
        }

        // Safe complexity limit: 15
        if (comp.length > 15) {
          const greedySelected: CostOptimizationRecommendation[] = [];
          for (const cand of comp) {
            let conflicts = false;
            for (const sel of greedySelected) {
              if (architecturalRecsConflict(cand, sel).hasConflict) {
                conflicts = true;
                break;
              }
            }
            if (!conflicts) greedySelected.push(cand);
          }
          optimalRecs.push(...greedySelected);
          continue;
        }

        // Branch-and-bound search over component
        let bestSubset: CostOptimizationRecommendation[] = [];
        let bestSavings = -1;

        function search(
          idx: number,
          currentSel: CostOptimizationRecommendation[],
          excludedIds: Set<string>,
        ) {
          if (idx === comp.length) {
            const { totalSavings } = simulateArchitecturalSubset(currentSel, resourceStates);
            if (totalSavings > bestSavings + 0.001) {
              bestSavings = totalSavings;
              bestSubset = [...currentSel];
            } else if (Math.abs(totalSavings - bestSavings) <= 0.001) {
              if (
                bestSubset.length === 0 ||
                currentSel.length < bestSubset.length ||
                (currentSel.length === bestSubset.length &&
                  currentSel.map((r) => r.recommendationId).sort().join(',') <
                    bestSubset.map((r) => r.recommendationId).sort().join(','))
              ) {
                bestSavings = totalSavings;
                bestSubset = [...currentSel];
              }
            }
            return;
          }

          const currRec = comp[idx];
          // Branch 1: Include (if not conflicted)
          if (!excludedIds.has(currRec.recommendationId)) {
            const nextExcluded = new Set(excludedIds);
            for (let j = idx + 1; j < comp.length; j++) {
              if (architecturalRecsConflict(currRec, comp[j]).hasConflict) {
                nextExcluded.add(comp[j].recommendationId);
              }
            }
            search(idx + 1, [...currentSel, currRec], nextExcluded);
          }
          // Branch 2: Exclude
          search(idx + 1, currentSel, excludedIds);
        }

        search(0, [], new Set());
        optimalRecs.push(...bestSubset);
      }

      return optimalRecs.sort((a, b) => {
        const achA = estimateArchitecturalAchievable(a);
        const achB = estimateArchitecturalAchievable(b);
        if (Math.abs(achB - achA) > 0.001) return achB - achA;
        if (b.estimatedMonthlySavings !== a.estimatedMonthlySavings) {
          return b.estimatedMonthlySavings - a.estimatedMonthlySavings;
        }
        return a.recommendationId.localeCompare(b.recommendationId);
      });
    }

    // 1. Process Architectural Recommendations
    const optimalArchitecturalRecs = selectOptimalArchitecturalRecs(architecturalRecs);
    const acceptedArchIds = new Set(optimalArchitecturalRecs.map((r) => r.recommendationId));

    // Record notes for architectural recommendations excluded due to conflict
    for (const rec of architecturalRecs) {
      if (acceptedArchIds.has(rec.recommendationId)) continue;
      for (const accepted of optimalArchitecturalRecs) {
        const conflict = architecturalRecsConflict(rec, accepted);
        if (conflict.hasConflict) {
          overlapNotes.push(
            `Recommendation "${rec.title}" is mutually exclusive with accepted recommendation "${accepted.recommendationId}" on resource "${conflict.resId}" (both modify ${conflict.key}). Kept dominant recommendation.`,
          );
          break;
        }
      }
    }

    for (const rec of optimalArchitecturalRecs) {
      // Cost-Weighted Resource Allocation with Fallback & Transparency warnings:
      const { effectiveCosts, weights } = computeAllocationCosts(rec, resourceStates, true);

      const discountRatio =
        rec.savingsPercentage > 0
          ? Math.min(1, Math.max(0, rec.savingsPercentage / 100))
          : rec.estimatedCurrentCost > 0
            ? Math.min(1, Math.max(0, rec.estimatedMonthlySavings / rec.estimatedCurrentCost))
            : 0;

      let recAchievableSavings = 0;
      let hadCompoundingAdjustment = false;

      for (let i = 0; i < rec.affectedResourceIds.length; i++) {
        const resId = rec.affectedResourceIds[i];
        const weight = weights[i];
        const nominalSavings = rec.estimatedMonthlySavings * weight;
        const fallbackCost = effectiveCosts[i];

        const isNewResource = !resourceStates.has(resId);
        const state = getOrInitResourceState(resId, fallbackCost);

        if (isNewResource) {
          const maxPossibleSavings = Math.min(state.remainingCost, nominalSavings);
          const allocatedSavings = Math.round(maxPossibleSavings * 100) / 100;
          state.remainingCost = Math.max(0, Math.round((state.remainingCost - allocatedSavings) * 100) / 100);
          state.appliedSavings += allocatedSavings;
          for (const key of Object.keys(rec.proposedConfiguration || {})) {
            state.modifiedAttributes.set(key, rec.recommendationId);
          }
          recAchievableSavings += allocatedSavings;
        } else {
          // Resource-Level Compounding on individual remainingCost:
          const compoundedSavings = Math.round(state.remainingCost * discountRatio * 100) / 100;
          const finalResourceSavings = Math.min(state.remainingCost, compoundedSavings);
          state.remainingCost = Math.max(0, Math.round((state.remainingCost - finalResourceSavings) * 100) / 100);
          state.appliedSavings += finalResourceSavings;
          for (const key of Object.keys(rec.proposedConfiguration || {})) {
            state.modifiedAttributes.set(key, rec.recommendationId);
          }
          recAchievableSavings += finalResourceSavings;
          if (finalResourceSavings < nominalSavings) {
            hadCompoundingAdjustment = true;
          }
        }
      }

      recAchievableSavings = Math.round(recAchievableSavings * 100) / 100;
      recAchievableSavings = Math.min(rec.estimatedMonthlySavings, recAchievableSavings);

      if (hadCompoundingAdjustment && recAchievableSavings < rec.estimatedMonthlySavings) {
        overlapNotes.push(
          `Recommendation "${rec.title}" savings adjusted from $${rec.estimatedMonthlySavings.toFixed(2)} to $${recAchievableSavings.toFixed(2)} due to resource-level compounding on resource(s) ${rec.affectedResourceIds.join(', ')}.`,
        );
      }

      combinedSavings += recAchievableSavings;
    }

    // 2. Process Pricing Model Recommendations (Savings Plans)
    // Helper: Check if two Savings Plans conflict
    function spRecsConflict(
      a: CostOptimizationRecommendation,
      b: CostOptimizationRecommendation,
    ): { hasConflict: boolean; resId?: string } {
      for (const resId of a.affectedResourceIds) {
        if (b.affectedResourceIds.includes(resId)) {
          return { hasConflict: true, resId };
        }
      }
      return { hasConflict: false };
    }

    // Helper: Estimate achievable savings for a Savings Plan
    function estimateSpAchievable(spRec: CostOptimizationRecommendation): number {
      let baseline = 0;
      const resourceCount = Math.max(1, spRec.affectedResourceIds.length);
      const equalShare = (spRec.estimatedCurrentCost || 0) / resourceCount;

      for (const resId of spRec.affectedResourceIds) {
        const state = resourceStates.get(resId);
        if (state) {
          baseline += state.remainingCost;
        } else {
          const known = costLookup.get(resId);
          baseline += known !== undefined ? known : equalShare;
        }
      }

      let discount = 0;
      if (typeof spRec.savingsPercentage === 'number' && !isNaN(spRec.savingsPercentage)) {
        if (spRec.savingsPercentage >= 0 && spRec.savingsPercentage <= 100) {
          discount = spRec.savingsPercentage;
        }
      }
      const nominal = Math.round(baseline * (discount / 100) * 100) / 100;
      return Math.round(Math.min(baseline, Math.min(spRec.estimatedMonthlySavings, nominal)) * 100) / 100;
    }

    function simulateSpSubset(
      subset: CostOptimizationRecommendation[],
    ): { totalSavings: number } {
      let simTotal = 0;
      const simStates = new Map<string, ResourceState>();
      for (const [k, v] of resourceStates.entries()) {
        simStates.set(k, {
          currentCost: v.currentCost,
          remainingCost: v.remainingCost,
          appliedSavings: v.appliedSavings,
          modifiedAttributes: new Map(v.modifiedAttributes),
        });
      }

      for (const spRec of subset) {
        let baseline = 0;
        const resourceCount = Math.max(1, spRec.affectedResourceIds.length);
        const equalShareCost = (spRec.estimatedCurrentCost || 0) / resourceCount;

        for (const resId of spRec.affectedResourceIds) {
          const state = simStates.get(resId);
          if (state) {
            baseline += state.remainingCost;
          } else {
            const known = costLookup.get(resId);
            baseline += known !== undefined ? known : equalShareCost;
          }
        }
        baseline = Math.round(baseline * 100) / 100;

        let pct = 0;
        if (typeof spRec.savingsPercentage === 'number' && !isNaN(spRec.savingsPercentage)) {
          if (spRec.savingsPercentage >= 0 && spRec.savingsPercentage <= 100) {
            pct = spRec.savingsPercentage;
          }
        }
        const nominal = Math.round(baseline * (pct / 100) * 100) / 100;
        const planSav = Math.min(baseline, nominal);

        for (const resId of spRec.affectedResourceIds) {
          const state = simStates.get(resId);
          if (state) {
            const share = planSav / resourceCount;
            state.remainingCost = Math.max(0, Math.round((state.remainingCost - share) * 100) / 100);
          }
        }
        simTotal += planSav;
      }
      return { totalSavings: Math.round(simTotal * 100) / 100 };
    }

    // Partition Savings Plans into conflict components and find optimal subset
    function selectOptimalSpRecs(
      recs: CostOptimizationRecommendation[],
    ): CostOptimizationRecommendation[] {
      if (recs.length <= 1) return recs;

      const sorted = [...recs].sort((a, b) => {
        const achA = estimateSpAchievable(a);
        const achB = estimateSpAchievable(b);
        if (Math.abs(achB - achA) > 0.001) return achB - achA;
        if (b.estimatedMonthlySavings !== a.estimatedMonthlySavings) {
          return b.estimatedMonthlySavings - a.estimatedMonthlySavings;
        }
        return a.recommendationId.localeCompare(b.recommendationId);
      });

      const visited = new Set<string>();
      const components: CostOptimizationRecommendation[][] = [];

      for (const rec of sorted) {
        if (visited.has(rec.recommendationId)) continue;
        const component: CostOptimizationRecommendation[] = [];
        const queue = [rec];
        visited.add(rec.recommendationId);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          component.push(curr);

          for (const other of sorted) {
            if (!visited.has(other.recommendationId)) {
              if (spRecsConflict(curr, other).hasConflict) {
                visited.add(other.recommendationId);
                queue.push(other);
              }
            }
          }
        }
        components.push(component);
      }

      const optimalRecs: CostOptimizationRecommendation[] = [];

      for (const comp of components) {
        if (comp.length === 1) {
          optimalRecs.push(comp[0]);
          continue;
        }

        // Safe complexity limit: 15
        if (comp.length > 15) {
          const greedySelected: CostOptimizationRecommendation[] = [];
          for (const cand of comp) {
            let conflicts = false;
            for (const sel of greedySelected) {
              if (spRecsConflict(cand, sel).hasConflict) {
                conflicts = true;
                break;
              }
            }
            if (!conflicts) greedySelected.push(cand);
          }
          optimalRecs.push(...greedySelected);
          continue;
        }

        // Branch-and-bound search over component
        let bestSubset: CostOptimizationRecommendation[] = [];
        let bestSavings = -1;

        function search(
          idx: number,
          currentSel: CostOptimizationRecommendation[],
          excludedIds: Set<string>,
        ) {
          if (idx === comp.length) {
            const { totalSavings } = simulateSpSubset(currentSel);
            if (totalSavings > bestSavings + 0.001) {
              bestSavings = totalSavings;
              bestSubset = [...currentSel];
            } else if (Math.abs(totalSavings - bestSavings) <= 0.001) {
              if (
                bestSubset.length === 0 ||
                currentSel.length < bestSubset.length ||
                (currentSel.length === bestSubset.length &&
                  currentSel.map((r) => r.recommendationId).sort().join(',') <
                    bestSubset.map((r) => r.recommendationId).sort().join(','))
              ) {
                bestSavings = totalSavings;
                bestSubset = [...currentSel];
              }
            }
            return;
          }

          const currRec = comp[idx];
          // Branch 1: Include (if not conflicted)
          if (!excludedIds.has(currRec.recommendationId)) {
            const nextExcluded = new Set(excludedIds);
            for (let j = idx + 1; j < comp.length; j++) {
              if (spRecsConflict(currRec, comp[j]).hasConflict) {
                nextExcluded.add(comp[j].recommendationId);
              }
            }
            search(idx + 1, [...currentSel, currRec], nextExcluded);
          }
          // Branch 2: Exclude
          search(idx + 1, currentSel, excludedIds);
        }

        search(0, [], new Set());
        optimalRecs.push(...bestSubset);
      }

      return optimalRecs.sort((a, b) => {
        const achA = estimateSpAchievable(a);
        const achB = estimateSpAchievable(b);
        if (Math.abs(achB - achA) > 0.001) return achB - achA;
        if (b.estimatedMonthlySavings !== a.estimatedMonthlySavings) {
          return b.estimatedMonthlySavings - a.estimatedMonthlySavings;
        }
        return a.recommendationId.localeCompare(b.recommendationId);
      });
    }

    const optimalSpRecs = selectOptimalSpRecs(pricingModelRecs);
    const acceptedSpIds = new Set(optimalSpRecs.map((r) => r.recommendationId));

    // Record notes for excluded Savings Plans
    for (const rec of pricingModelRecs) {
      if (acceptedSpIds.has(rec.recommendationId)) continue;
      for (const accepted of optimalSpRecs) {
        const conflict = spRecsConflict(rec, accepted);
        if (conflict.hasConflict) {
          overlapNotes.push(
            `Pricing model recommendation "${rec.title}" overlaps with applied commitment plan "${accepted.title}" on resource "${conflict.resId}". Excluded to avoid multiple commitment plans on the same compute baseline.`,
          );
          break;
        }
      }
    }

    const committedResources = new Map<string, string>();

    for (const spRec of optimalSpRecs) {
      // Calculate eligible compute baseline using ONLY the plan's affected resources
      let planEligibleBaseline = 0;
      let hadPriorArchitecturalReductions = false;

      const resourceCount = Math.max(1, spRec.affectedResourceIds.length);
      const equalShareCost = (spRec.estimatedCurrentCost || 0) / resourceCount;

      for (const resId of spRec.affectedResourceIds) {
        const state = resourceStates.get(resId);
        if (state) {
          planEligibleBaseline += state.remainingCost;
          if (state.appliedSavings > 0) {
            hadPriorArchitecturalReductions = true;
          }
        } else {
          const knownCost = costLookup.get(resId);
          const resCost = knownCost !== undefined ? knownCost : equalShareCost;
          planEligibleBaseline += resCost;
        }
      }

      planEligibleBaseline = Math.round(planEligibleBaseline * 100) / 100;

      // Remove Unsafe Default: Validate percentage boundaries (0–100)
      let effectiveDiscountPct = 0;
      const rawPct = spRec.savingsPercentage;

      if (rawPct === undefined || rawPct === null || typeof rawPct !== 'number' || isNaN(rawPct)) {
        overlapNotes.push(
          `Pricing model recommendation "${spRec.title}" has missing or invalid savingsPercentage (${rawPct}). Expected number between 0 and 100; treated as 0% discount.`,
        );
        effectiveDiscountPct = 0;
      } else if (rawPct < 0) {
        overlapNotes.push(
          `Pricing model recommendation "${spRec.title}" has negative savingsPercentage (${rawPct}%). Percentage must be between 0 and 100; treated as 0% discount.`,
        );
        effectiveDiscountPct = 0;
      } else if (rawPct > 100) {
        overlapNotes.push(
          `Pricing model recommendation "${spRec.title}" has savingsPercentage exceeding 100% (${rawPct}%). Percentage must be between 0 and 100; treated as 0% discount.`,
        );
        effectiveDiscountPct = 0;
      } else {
        effectiveDiscountPct = rawPct;
      }

      const nominalSavings = Math.round(planEligibleBaseline * (effectiveDiscountPct / 100) * 100) / 100;
      const planSavings = Math.min(planEligibleBaseline, nominalSavings);

      for (const resId of spRec.affectedResourceIds) {
        committedResources.set(resId, spRec.title);
        const state = resourceStates.get(resId);
        if (state) {
          const share = planSavings / resourceCount;
          state.remainingCost = Math.max(0, Math.round((state.remainingCost - share) * 100) / 100);
        }
      }

      combinedSavings += planSavings;

      if (hadPriorArchitecturalReductions && planSavings < spRec.estimatedMonthlySavings && effectiveDiscountPct > 0) {
        overlapNotes.push(
          `Savings Plan recommendation adjusted from $${spRec.estimatedMonthlySavings.toFixed(2)} to $${planSavings.toFixed(2)} based on remaining eligible compute baseline of affected resources ($${planEligibleBaseline.toFixed(2)}).`,
        );
      }
    }

    const combinedAchievableSavings = Math.round(combinedSavings * 100) / 100;

    return {
      individualSavingsSum,
      combinedAchievableSavings,
      hasOverlappingRecommendations: overlapNotes.length > 0,
      overlapNotes,
    };
  }
}
