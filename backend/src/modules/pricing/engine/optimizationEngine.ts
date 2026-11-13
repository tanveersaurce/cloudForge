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
}
