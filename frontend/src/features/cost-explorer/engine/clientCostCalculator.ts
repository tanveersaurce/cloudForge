import type {
  ArchitectureFlowEdge,
  ArchitectureFlowNode,
} from '@/features/architecture-builder/types/architecture.types';
import type {
  CostEstimationResult,
  CostItemEstimate,
  CostOptimizationRecommendation,
  DimensionBreakdown,
  ServiceCostSummary,
  WorkloadAssumptions,
} from '../types/pricing.types';

export const CLIENT_BASE_RATES: Record<string, number> = {
  'ec2:t3.micro': 0.0104,
  'ec2:t3.small': 0.0208,
  'ec2:t3.medium': 0.0416,
  'ec2:t3.large': 0.0832,
  'ec2:t4g.micro': 0.0084,
  'ec2:t4g.small': 0.0168,
  'ec2:t4g.medium': 0.0336,
  'ec2:t4g.large': 0.0672,
  'ec2:m5.large': 0.096,
  'ec2:m5.xlarge': 0.192,
  'ec2:m6g.large': 0.077,
  'rds:db.t3.micro': 0.017,
  'rds:db.t3.small': 0.034,
  'rds:db.t3.medium': 0.068,
  'rds:db.t4g.micro': 0.014,
  'rds:db.t4g.small': 0.028,
  'rds:db.t4g.medium': 0.056,
  'rds:storage_gp3': 0.115,
  'ebs:gp3': 0.08,
  'ebs:gp2': 0.10,
  's3:standard': 0.023,
  'nat_gateway:hour': 0.045,
  'nat_gateway:data': 0.045,
  'alb:hour': 0.0225,
  'alb:lcu_hour': 0.008,
};

export const DEFAULT_CLIENT_ASSUMPTIONS: WorkloadAssumptions = {
  preset: 'Small Production',
  monthlyOperatingHours: 730,
  averageCpuUtilization: 50,
  monthlyDataTransferOutGb: 100,
  monthlyS3StorageGb: 50,
  monthlyS3Requests: 50000,
  monthlyNatTrafficGb: 50,
  monthlyLambdaInvocations: 1000000,
  averageLambdaDurationMs: 200,
};

function roundMoney(num: number): number {
  return Math.round(num * 100) / 100;
}

export function calculateClientCost(
  architectureId: string,
  region: string = 'us-east-1',
  nodes: ArchitectureFlowNode[],
  _edges: ArchitectureFlowEdge[] = [],
  assumptions: WorkloadAssumptions = DEFAULT_CLIENT_ASSUMPTIONS,
): CostEstimationResult {
  const resourceItems: CostItemEstimate[] = [];
  let totalMonthly = 0;
  let totalHourly = 0;

  for (const node of nodes) {
    const type = node.data.resourceType;
    const label = node.data.label || node.data.resourceName || node.id;
    const meta = node.data.metadata || {};

    const dimensions: DimensionBreakdown[] = [];
    const warnings: string[] = [];
    let itemMonthly = 0;
    let serviceCode = 'Other';
    let isAvailable = true;

    switch (type) {
      case 'aws_instance': {
        serviceCode = 'AmazonEC2';
        const instanceType = (meta.instance_type as string) || 't3.micro';
        const rate = CLIENT_BASE_RATES[`ec2:${instanceType}`] ?? 0.0104;
        const computeCost = rate * assumptions.monthlyOperatingHours;

        dimensions.push({
          name: `Compute (${instanceType})`,
          unit: 'Hrs',
          quantity: assumptions.monthlyOperatingHours,
          unitPrice: rate,
          extendedCost: roundMoney(computeCost),
        });
        itemMonthly += computeCost;

        const rootSize = Number(meta.root_volume_size || 20);
        const ebsRate = CLIENT_BASE_RATES['ebs:gp3'] ?? 0.08;
        const ebsCost = rootSize * ebsRate;
        dimensions.push({
          name: `Root EBS Volume (gp3)`,
          unit: 'GB-Mo',
          quantity: rootSize,
          unitPrice: ebsRate,
          extendedCost: roundMoney(ebsCost),
        });
        itemMonthly += ebsCost;
        break;
      }

      case 'aws_db_instance': {
        serviceCode = 'AmazonRDS';
        const instanceClass = (meta.instance_class as string) || 'db.t3.micro';
        const isMultiAz = meta.multi_az === true;
        const rate = CLIENT_BASE_RATES[`rds:${instanceClass}`] ?? 0.017;
        const multiMultiplier = isMultiAz ? 2.0 : 1.0;
        const instanceCost = rate * multiMultiplier * assumptions.monthlyOperatingHours;

        dimensions.push({
          name: `RDS Instance (${instanceClass}${isMultiAz ? ' Multi-AZ' : ''})`,
          unit: 'Hrs',
          quantity: assumptions.monthlyOperatingHours,
          unitPrice: roundMoney(rate * multiMultiplier),
          extendedCost: roundMoney(instanceCost),
        });
        itemMonthly += instanceCost;

        const storageGb = Number(meta.allocated_storage || 20);
        const storageRate = CLIENT_BASE_RATES['rds:storage_gp3'] ?? 0.115;
        const storageCost = storageGb * storageRate * multiMultiplier;
        dimensions.push({
          name: `Allocated Storage (${storageGb} GB gp3)`,
          unit: 'GB-Mo',
          quantity: storageGb * (isMultiAz ? 2 : 1),
          unitPrice: storageRate,
          extendedCost: roundMoney(storageCost),
        });
        itemMonthly += storageCost;
        break;
      }

      case 'aws_s3_bucket': {
        serviceCode = 'AmazonS3';
        const s3Rate = CLIENT_BASE_RATES['s3:standard'] ?? 0.023;
        const storageCost = assumptions.monthlyS3StorageGb * s3Rate;
        dimensions.push({
          name: `Standard Storage (${assumptions.monthlyS3StorageGb} GB)`,
          unit: 'GB-Mo',
          quantity: assumptions.monthlyS3StorageGb,
          unitPrice: s3Rate,
          extendedCost: roundMoney(storageCost),
        });
        itemMonthly += storageCost;
        break;
      }

      case 'aws_ebs_volume': {
        serviceCode = 'AmazonEC2';
        const volType = (meta.volume_type as string) || 'gp3';
        const sizeGb = Number(meta.size || 50);
        const rate = CLIENT_BASE_RATES[`ebs:${volType}`] ?? 0.08;
        const cost = sizeGb * rate;
        dimensions.push({
          name: `EBS Volume (${sizeGb} GB ${volType})`,
          unit: 'GB-Mo',
          quantity: sizeGb,
          unitPrice: rate,
          extendedCost: roundMoney(cost),
        });
        itemMonthly += cost;
        break;
      }

      case 'aws_nat_gateway': {
        serviceCode = 'AmazonVPC';
        const hrRate = CLIENT_BASE_RATES['nat_gateway:hour'] ?? 0.045;
        const dataRate = CLIENT_BASE_RATES['nat_gateway:data'] ?? 0.045;
        const hrCost = hrRate * assumptions.monthlyOperatingHours;
        const dataCost = assumptions.monthlyNatTrafficGb * dataRate;

        dimensions.push({
          name: 'NAT Running Hours',
          unit: 'Hrs',
          quantity: assumptions.monthlyOperatingHours,
          unitPrice: hrRate,
          extendedCost: roundMoney(hrCost),
        });
        dimensions.push({
          name: `Data Processed (${assumptions.monthlyNatTrafficGb} GB)`,
          unit: 'GB',
          quantity: assumptions.monthlyNatTrafficGb,
          unitPrice: dataRate,
          extendedCost: roundMoney(dataCost),
        });
        itemMonthly += hrCost + dataCost;
        break;
      }

      case 'aws_lb': {
        serviceCode = 'ElasticLoadBalancing';
        const hrRate = CLIENT_BASE_RATES['alb:hour'] ?? 0.0225;
        const lcuRate = CLIENT_BASE_RATES['alb:lcu_hour'] ?? 0.008;
        const hrCost = hrRate * assumptions.monthlyOperatingHours;
        const lcuCost = lcuRate * assumptions.monthlyOperatingHours;

        dimensions.push({
          name: 'ALB Running Hours',
          unit: 'Hrs',
          quantity: assumptions.monthlyOperatingHours,
          unitPrice: hrRate,
          extendedCost: roundMoney(hrCost),
        });
        dimensions.push({
          name: 'LCU Capacity Units',
          unit: 'LCU-Hrs',
          quantity: assumptions.monthlyOperatingHours,
          unitPrice: lcuRate,
          extendedCost: roundMoney(lcuCost),
        });
        itemMonthly += hrCost + lcuCost;
        break;
      }

      case 'aws_vpc':
      case 'aws_subnet':
      case 'aws_internet_gateway':
      case 'aws_security_group':
      case 'aws_route_table':
      case 'aws_iam_role':
      case 'aws_iam_policy': {
        serviceCode = type.startsWith('aws_iam') ? 'AWSIdentity' : 'AmazonVPC';
        dimensions.push({
          name: 'AWS Managed Core Resource (Free)',
          unit: 'N/A',
          quantity: 1,
          unitPrice: 0.0,
          extendedCost: 0.0,
        });
        break;
      }

      default: {
        isAvailable = false;
        warnings.push(`Resource type "${type}" has no active AWS charges.`);
      }
    }

    itemMonthly = roundMoney(itemMonthly);
    const itemHourly = roundMoney(itemMonthly / (assumptions.monthlyOperatingHours || 730));

    totalMonthly += itemMonthly;
    totalHourly += itemHourly;

    resourceItems.push({
      resourceId: node.id,
      resourceName: label,
      resourceType: type,
      serviceCode,
      region,
      dimensions,
      monthlyCost: itemMonthly,
      hourlyCost: itemHourly,
      currency: 'USD',
      isPricingAvailable: isAvailable,
      pricingSource: 'AWS Pricing Calculator Engine',
      pricingRetrievedAt: new Date().toISOString(),
      warnings,
    });
  }

  totalMonthly = roundMoney(totalMonthly);
  totalHourly = roundMoney(totalHourly);
  const totalAnnual = roundMoney(totalMonthly * 12);

  // Group service breakdown
  const serviceMap = new Map<string, { monthlyCost: number; resourceCount: number; serviceName: string }>();
  for (const item of resourceItems) {
    const cur = serviceMap.get(item.serviceCode) || {
      monthlyCost: 0,
      resourceCount: 0,
      serviceName: item.serviceCode,
    };
    cur.monthlyCost += item.monthlyCost;
    cur.resourceCount += 1;
    serviceMap.set(item.serviceCode, cur);
  }

  const serviceBreakdown: ServiceCostSummary[] = Array.from(serviceMap.entries()).map(
    ([code, data]) => ({
      serviceCode: code,
      serviceName: data.serviceName,
      monthlyCost: roundMoney(data.monthlyCost),
      percentage: totalMonthly > 0 ? roundMoney((data.monthlyCost / totalMonthly) * 100) : 0,
      resourceCount: data.resourceCount,
    }),
  ).sort((a, b) => b.monthlyCost - a.monthlyCost);

  // Generate Recommendations
  const recommendations: CostOptimizationRecommendation[] = [];

  // 1. Graviton
  const ec2Nodes = nodes.filter((n) => n.data.resourceType === 'aws_instance');
  for (const ec2 of ec2Nodes) {
    const cur = (ec2.data.metadata?.instance_type as string) || 't3.micro';
    if (cur.startsWith('t3.') || cur.startsWith('m5.')) {
      const grav = cur.replace('t3.', 't4g.').replace('m5.', 'm6g.');
      const curRate = CLIENT_BASE_RATES[`ec2:${cur}`] ?? 0.0104;
      const gravRate = CLIENT_BASE_RATES[`ec2:${grav}`] ?? curRate * 0.8;
      const curCost = curRate * assumptions.monthlyOperatingHours;
      const optCost = gravRate * assumptions.monthlyOperatingHours;
      const savings = Math.max(0, curCost - optCost);

      if (savings > 0) {
        recommendations.push({
          recommendationId: `OPT-COMPUTE-GRAVITON-${ec2.id}`,
          title: `Adopt AWS Graviton (${grav}) for ${ec2.data.label || cur}`,
          category: 'compute',
          priority: 'high',
          affectedResourceIds: [ec2.id],
          currentConfiguration: { instance_type: cur },
          proposedConfiguration: { instance_type: grav },
          explanation: `Switching from ${cur} to ${grav} (ARM64) provides up to 20% lower cost and higher performance.`,
          estimatedCurrentCost: roundMoney(curCost),
          estimatedOptimizedCost: roundMoney(optCost),
          estimatedMonthlySavings: roundMoney(savings),
          savingsPercentage: Math.round((savings / curCost) * 100),
          currency: 'USD',
          performanceImpact: 'improved',
          securityImpact: 'neutral',
          availabilityImpact: 'neutral',
          implementationEffort: 'low',
          confidenceLevel: 'high',
          requiredAssumptions: ['Workload binaries or containers support ARM64.'],
          documentationReferences: [{ title: 'AWS Graviton', url: 'https://aws.amazon.com/ec2/graviton/' }],
          status: 'pending',
        });
      }
    }
  }

  // 2. EBS gp2 -> gp3
  const ebsNodes = nodes.filter((n) => n.data.resourceType === 'aws_ebs_volume');
  for (const ebs of ebsNodes) {
    if (ebs.data.metadata?.volume_type === 'gp2') {
      const size = Number(ebs.data.metadata?.size || 50);
      const curCost = size * 0.10;
      const optCost = size * 0.08;
      const savings = curCost - optCost;

      recommendations.push({
        recommendationId: `OPT-STORAGE-GP3-${ebs.id}`,
        title: `Upgrade EBS Volume "${ebs.data.label || ebs.id}" to gp3`,
        category: 'storage',
        priority: 'high',
        affectedResourceIds: [ebs.id],
        currentConfiguration: { volume_type: 'gp2', size },
        proposedConfiguration: { volume_type: 'gp3', size },
        explanation: 'gp3 volumes save 20% compared to gp2 while offering higher baseline IOPS.',
        estimatedCurrentCost: roundMoney(curCost),
        estimatedOptimizedCost: roundMoney(optCost),
        estimatedMonthlySavings: roundMoney(savings),
        savingsPercentage: 20,
        currency: 'USD',
        performanceImpact: 'improved',
        securityImpact: 'neutral',
        availabilityImpact: 'neutral',
        implementationEffort: 'low',
        confidenceLevel: 'high',
        requiredAssumptions: ['Online EBS volume modification.'],
        documentationReferences: [{ title: 'EBS gp3 Types', url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-volume-types.html' }],
        status: 'pending',
      });
    }
  }

  // 3. S3 Gateway Endpoint
  const hasNat = nodes.some((n) => n.data.resourceType === 'aws_nat_gateway');
  const hasS3 = nodes.some((n) => n.data.resourceType === 'aws_s3_bucket');
  if (hasNat && hasS3) {
    const natTraffic = assumptions.monthlyNatTrafficGb || 50;
    const savings = roundMoney(natTraffic * 0.5 * 0.045);
    recommendations.push({
      recommendationId: 'OPT-NET-S3-GATEWAY-ENDPOINT',
      title: 'Implement Free Gateway VPC Endpoint for Amazon S3',
      category: 'networking',
      priority: 'high',
      affectedResourceIds: nodes.filter((n) => n.data.resourceType === 'aws_nat_gateway').map((n) => n.id),
      currentConfiguration: { s3_routing: 'via NAT Gateway ($0.045/GB)' },
      proposedConfiguration: { s3_routing: 'via Gateway Endpoint ($0.00/GB - Free)' },
      explanation: 'Routing S3 traffic through a Gateway VPC Endpoint is 100% free and eliminates NAT data processing fees.',
      estimatedCurrentCost: roundMoney(natTraffic * 0.045),
      estimatedOptimizedCost: roundMoney(natTraffic * 0.5 * 0.045),
      estimatedMonthlySavings: savings,
      savingsPercentage: 50,
      currency: 'USD',
      performanceImpact: 'improved',
      securityImpact: 'improved',
      availabilityImpact: 'neutral',
      implementationEffort: 'low',
      confidenceLevel: 'high',
      requiredAssumptions: ['Approx 50% of outbound NAT traffic accesses S3.'],
      documentationReferences: [{ title: 'Gateway Endpoints', url: 'https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html' }],
      status: 'pending',
    });
  }

  const potentialMonthlySavings = roundMoney(
    recommendations.reduce((sum, r) => sum + r.estimatedMonthlySavings, 0),
  );

  return {
    architectureId,
    region,
    currency: 'USD',
    totalEstimatedMonthly: totalMonthly,
    totalEstimatedHourly: totalHourly,
    totalEstimatedAnnual: totalAnnual,
    assumptions,
    serviceBreakdown,
    resourceItems,
    missingAssumptions: [],
    potentialMonthlySavings,
    recommendations,
    calculatedAt: new Date().toISOString(),
  };
}
