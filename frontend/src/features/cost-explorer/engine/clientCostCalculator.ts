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

export const SUPPORTED_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-southeast-1',
  'ap-northeast-1',
] as const;

export function isSupportedRegion(region: string): boolean {
  return SUPPORTED_REGIONS.includes(region as (typeof SUPPORTED_REGIONS)[number]);
}

/**
 * Service-specific regional price ratios relative to us-east-1 benchmark.
 * Sourced from AWS Price List snapshots.
 */
export const SERVICE_REGION_MULTIPLIERS: Record<string, Record<string, number>> = {
  AmazonEC2: {
    'us-east-1': 1.0,
    'us-east-2': 1.0,
    'us-west-1': 1.12,
    'us-west-2': 1.0,
    'eu-west-1': 1.08,
    'eu-central-1': 1.10,
    'ap-southeast-1': 1.15,
    'ap-northeast-1': 1.14,
  },
  AmazonRDS: {
    'us-east-1': 1.0,
    'us-east-2': 1.0,
    'us-west-1': 1.15,
    'us-west-2': 1.0,
    'eu-west-1': 1.09,
    'eu-central-1': 1.12,
    'ap-southeast-1': 1.18,
    'ap-northeast-1': 1.16,
  },
  AmazonS3: {
    'us-east-1': 1.0,
    'us-east-2': 1.0,
    'us-west-1': 1.13,
    'us-west-2': 1.0,
    'eu-west-1': 1.043,
    'eu-central-1': 1.065,
    'ap-southeast-1': 1.087,
    'ap-northeast-1': 1.087,
  },
  AmazonVPC: {
    'us-east-1': 1.0,
    'us-east-2': 1.0,
    'us-west-1': 1.18,
    'us-west-2': 1.0,
    'eu-west-1': 1.11,
    'eu-central-1': 1.15,
    'ap-southeast-1': 1.31,
    'ap-northeast-1': 1.38,
  },
  ElasticLoadBalancing: {
    'us-east-1': 1.0,
    'us-east-2': 1.0,
    'us-west-1': 1.11,
    'us-west-2': 1.0,
    'eu-west-1': 1.09,
    'eu-central-1': 1.11,
    'ap-southeast-1': 1.16,
    'ap-northeast-1': 1.14,
  },
  AWSLambda: {
    'us-east-1': 1.0,
    'us-east-2': 1.0,
    'us-west-1': 1.10,
    'us-west-2': 1.0,
    'eu-west-1': 1.05,
    'eu-central-1': 1.08,
    'ap-southeast-1': 1.10,
    'ap-northeast-1': 1.10,
  },
};

export function getServiceRegionMultiplier(
  serviceCode: string,
  region: string,
): { multiplier: number; isSupported: boolean } {
  if (!isSupportedRegion(region)) {
    return { multiplier: 1.0, isSupported: false };
  }
  const serviceRates = SERVICE_REGION_MULTIPLIERS[serviceCode];
  if (serviceRates && serviceRates[region] !== undefined) {
    return { multiplier: serviceRates[region], isSupported: true };
  }
  return { multiplier: 1.0, isSupported: true };
}

export const REGION_PRICE_MULTIPLIERS: Record<string, number> = {
  'us-east-1': 1.0,
  'us-east-2': 1.0,
  'us-west-1': 1.12,
  'us-west-2': 1.0,
  'eu-west-1': 1.08,
  'eu-central-1': 1.10,
  'ap-southeast-1': 1.15,
  'ap-northeast-1': 1.14,
};

export const CLIENT_BASE_RATES: Record<string, number> = {
  // EC2 Instances (Hourly)
  'ec2:t3.micro': 0.0104,
  'ec2:t3.small': 0.0208,
  'ec2:t3.medium': 0.0416,
  'ec2:t3.large': 0.0832,
  'ec2:t3.xlarge': 0.1664,
  'ec2:t4g.micro': 0.0084,
  'ec2:t4g.small': 0.0168,
  'ec2:t4g.medium': 0.0336,
  'ec2:t4g.large': 0.0672,
  'ec2:m5.large': 0.096,
  'ec2:m5.xlarge': 0.192,
  'ec2:m5.2xlarge': 0.384,
  'ec2:m6g.large': 0.077,
  'ec2:m6g.xlarge': 0.154,
  'ec2:c5.large': 0.085,
  'ec2:c5.xlarge': 0.170,

  // RDS Instances (Hourly)
  'rds:db.t3.micro': 0.017,
  'rds:db.t3.small': 0.034,
  'rds:db.t3.medium': 0.068,
  'rds:db.t4g.micro': 0.014,
  'rds:db.t4g.small': 0.028,
  'rds:db.t4g.medium': 0.056,
  'rds:db.m5.large': 0.171,
  'rds:db.m5.xlarge': 0.342,
  'rds:storage_gp3': 0.115,
  'rds:backup_storage': 0.095,

  // EBS Storage (GB-Month)
  'ebs:gp3': 0.08,
  'ebs:gp2': 0.10,
  'ebs:io2': 0.125,
  'ebs:io2_iops': 0.065,

  // S3 Storage (GB-Month)
  's3:standard': 0.023,
  's3:intelligent_frequent': 0.023,
  's3:intelligent_infrequent': 0.0125,
  's3:standard_ia': 0.0125,
  's3:requests_tier1': 0.005,

  // Networking
  'nat_gateway:hour': 0.045,
  'nat_gateway:data': 0.045,
  'alb:hour': 0.0225,
  'alb:lcu_hour': 0.008,
  'nlb:hour': 0.0225,
  'cloudfront:data': 0.085,
  'data_transfer:out_internet': 0.09,

  // Lambda
  'lambda:requests': 0.20,
  'lambda:gb_seconds_x86': 0.0000166667,
  'lambda:gb_seconds_arm': 0.0000133334,
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
  const missingAssumptions: string[] = [];

  if (!isSupportedRegion(region)) {
    missingAssumptions.push(
      `Region "${region}" is not calibrated in the benchmark pricing catalog; default us-east-1 rates applied as illustrative.`,
    );
  }

  let totalMonthly = 0;
  let totalHourly = 0;

  for (const node of nodes) {
    const type = node.data.resourceType;
    const label = node.data.label || node.data.resourceName || node.id;
    const meta = node.data.metadata || {};

    const dimensions: DimensionBreakdown[] = [];
    const warnings: string[] = [];
    if (!isSupportedRegion(region)) {
      warnings.push(`Region "${region}" is not calibrated in benchmark catalog; us-east-1 rates applied as illustrative.`);
    }
    let itemMonthly = 0;
    let serviceCode = 'Other';
    let isAvailable = true;

    switch (type) {
      case 'aws_instance': {
        serviceCode = 'AmazonEC2';
        const { multiplier: ec2Mult } = getServiceRegionMultiplier('AmazonEC2', region);
        const instanceType = (meta.instance_type as string) || 't3.micro';
        if (!meta.instance_type) {
          missingAssumptions.push(`${label}: instance_type not configured; assumed default t3.micro.`);
          warnings.push('instance_type not configured; assumed default t3.micro.');
        }

        const baseRate = CLIENT_BASE_RATES[`ec2:${instanceType}`];
        if (baseRate !== undefined) {
          const rate = Math.round(baseRate * ec2Mult * 1000000) / 1000000;
          const computeCost = rate * assumptions.monthlyOperatingHours;

          dimensions.push({
            name: `Compute (${instanceType})`,
            unit: 'Hrs',
            quantity: assumptions.monthlyOperatingHours,
            unitPrice: rate,
            extendedCost: roundMoney(computeCost),
          });
          itemMonthly += computeCost;
        } else {
          isAvailable = false;
          warnings.push(`Pricing unavailable for instance type "${instanceType}". Cost excluded from estimate.`);
        }

        const rootSize = Number(meta.root_volume_size || 20);
        if (!meta.root_volume_size) {
          missingAssumptions.push(`${label}: root_volume_size not configured; assumed default 20 GB gp3.`);
          warnings.push('root_volume_size not configured; assumed default 20 GB gp3.');
        }
        const baseEbsRate = CLIENT_BASE_RATES['ebs:gp3'] ?? 0.08;
        const ebsRate = Math.round(baseEbsRate * ec2Mult * 1000000) / 1000000;
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
        const { multiplier: rdsMult } = getServiceRegionMultiplier('AmazonRDS', region);
        const instanceClass = (meta.instance_class as string) || 'db.t3.micro';
        if (!meta.instance_class) {
          missingAssumptions.push(`${label}: instance_class not configured; assumed default db.t3.micro.`);
          warnings.push('instance_class not configured; assumed default db.t3.micro.');
        }
        const isMultiAz = meta.multi_az === true;
        if (meta.multi_az === undefined) {
          missingAssumptions.push(`${label}: multi_az not configured; assumed default Single-AZ deployment.`);
        }
        const baseRate = CLIENT_BASE_RATES[`rds:${instanceClass}`];

        if (baseRate !== undefined) {
          const rate = Math.round(baseRate * rdsMult * 1000000) / 1000000;
          const multiMultiplier = isMultiAz ? 2.0 : 1.0;
          const instanceCost = rate * multiMultiplier * assumptions.monthlyOperatingHours;

          dimensions.push({
            name: `RDS Instance (${instanceClass}${isMultiAz ? ' Multi-AZ' : ''})`,
            unit: 'Hrs',
            quantity: assumptions.monthlyOperatingHours,
            unitPrice: Math.round(rate * multiMultiplier * 1000000) / 1000000,
            extendedCost: roundMoney(instanceCost),
          });
          itemMonthly += instanceCost;
        } else {
          isAvailable = false;
          warnings.push(`Pricing unavailable for RDS class "${instanceClass}". Cost excluded from estimate.`);
        }

        const storageGb = Number(meta.allocated_storage || 20);
        if (!meta.allocated_storage) {
          missingAssumptions.push(`${label}: allocated_storage not configured; assumed default 20 GB gp3.`);
          warnings.push('allocated_storage not configured; assumed default 20 GB gp3.');
        }
        const baseStorageRate = CLIENT_BASE_RATES['rds:storage_gp3'] ?? 0.115;
        const storageRate = Math.round(baseStorageRate * rdsMult * 1000000) / 1000000;
        const storageCost = storageGb * storageRate * (isMultiAz ? 2.0 : 1.0);
        dimensions.push({
          name: `Allocated Storage (${storageGb} GB gp3${isMultiAz ? ' Multi-AZ' : ''})`,
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
        const { multiplier: s3Mult } = getServiceRegionMultiplier('AmazonS3', region);
        missingAssumptions.push(
          `${label}: S3 workload usage not customized; evaluated using preset assumption (${assumptions.monthlyS3StorageGb} GB storage, ${assumptions.monthlyS3Requests.toLocaleString()} requests).`,
        );
        warnings.push(
          `Evaluated using preset assumption: ${assumptions.monthlyS3StorageGb} GB storage, ${assumptions.monthlyS3Requests.toLocaleString()} requests.`,
        );
        const baseS3Rate = CLIENT_BASE_RATES['s3:standard'] ?? 0.023;
        const s3Rate = Math.round(baseS3Rate * s3Mult * 1000000) / 1000000;
        const baseReqRate = CLIENT_BASE_RATES['s3:requests_tier1'] ?? 0.005;
        const reqRate = Math.round(baseReqRate * s3Mult * 1000000) / 1000000;
        const storageCost = assumptions.monthlyS3StorageGb * s3Rate;
        const reqCost = (assumptions.monthlyS3Requests / 1000) * reqRate;

        dimensions.push({
          name: `Standard Storage (${assumptions.monthlyS3StorageGb} GB)`,
          unit: 'GB-Mo',
          quantity: assumptions.monthlyS3StorageGb,
          unitPrice: s3Rate,
          extendedCost: roundMoney(storageCost),
        });
        dimensions.push({
          name: `Requests (${assumptions.monthlyS3Requests.toLocaleString()} PUT/GET)`,
          unit: '1000-Req',
          quantity: assumptions.monthlyS3Requests / 1000,
          unitPrice: reqRate,
          extendedCost: roundMoney(reqCost),
        });
        itemMonthly += storageCost + reqCost;
        break;
      }

      case 'aws_ebs_volume': {
        serviceCode = 'AmazonEC2';
        const { multiplier: ebsMult } = getServiceRegionMultiplier('AmazonEC2', region);
        const volType = (meta.volume_type as string) || 'gp3';
        if (!meta.volume_type) {
          missingAssumptions.push(`${label}: volume_type not configured; assumed default gp3.`);
          warnings.push('volume_type not configured; assumed default gp3.');
        }
        const sizeGb = Number(meta.size || 50);
        if (!meta.size) {
          missingAssumptions.push(`${label}: size not configured; assumed default 50 GB.`);
          warnings.push('size not configured; assumed default 50 GB.');
        }
        const baseRate = CLIENT_BASE_RATES[`ebs:${volType}`];
        if (baseRate !== undefined) {
          const rate = Math.round(baseRate * ebsMult * 1000000) / 1000000;
          const cost = sizeGb * rate;
          dimensions.push({
            name: `EBS Volume (${sizeGb} GB ${volType})`,
            unit: 'GB-Mo',
            quantity: sizeGb,
            unitPrice: rate,
            extendedCost: roundMoney(cost),
          });
          itemMonthly += cost;
        } else {
          isAvailable = false;
          warnings.push(`Pricing unavailable for EBS volume type "${volType}". Cost excluded from estimate.`);
        }
        break;
      }

      case 'aws_nat_gateway': {
        serviceCode = 'AmazonVPC';
        const { multiplier: vpcMult } = getServiceRegionMultiplier('AmazonVPC', region);
        missingAssumptions.push(
          `${label}: NAT Gateway traffic not customized; evaluated using preset assumption (${assumptions.monthlyNatTrafficGb} GB data processed, ${assumptions.monthlyOperatingHours} operating hours).`,
        );
        warnings.push(
          `Evaluated using preset assumption: ${assumptions.monthlyNatTrafficGb} GB data processed, ${assumptions.monthlyOperatingHours} operating hours.`,
        );
        const baseHrRate = CLIENT_BASE_RATES['nat_gateway:hour'] ?? 0.045;
        const baseDataRate = CLIENT_BASE_RATES['nat_gateway:data'] ?? 0.045;
        const hrRate = Math.round(baseHrRate * vpcMult * 1000000) / 1000000;
        const dataRate = Math.round(baseDataRate * vpcMult * 1000000) / 1000000;
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
        const { multiplier: albMult } = getServiceRegionMultiplier('ElasticLoadBalancing', region);
        missingAssumptions.push(`${label}: ALB LCU not specified; assumed baseline 1.0 LCU usage.`);
        warnings.push('ALB capacity units assumed baseline 1.0 LCU usage.');
        const baseHrRate = CLIENT_BASE_RATES['alb:hour'] ?? 0.0225;
        const baseLcuRate = CLIENT_BASE_RATES['alb:lcu_hour'] ?? 0.008;
        const hrRate = Math.round(baseHrRate * albMult * 1000000) / 1000000;
        const lcuRate = Math.round(baseLcuRate * albMult * 1000000) / 1000000;
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
      pricingSource: 'AWS Price List Reference Snapshot (Illustrative)',
      pricingRetrievedAt: '2026-11-01T00:00:00.000Z',
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

  // 4. Compute Savings Plans (Steady-State Workloads)
  if (assumptions.monthlyOperatingHours >= 700 && totalMonthly >= 50) {
    const computeTotal = serviceBreakdown.find((s) => s.serviceCode === 'AmazonEC2')?.monthlyCost || 0;
    if (computeTotal > 30) {
      const potentialSavings = roundMoney(computeTotal * 0.35);
      recommendations.push({
        recommendationId: 'OPT-PRICING-SAVINGS-PLANS',
        title: 'Enroll Steady-State Compute in 1-Year Compute Savings Plans',
        category: 'pricing-model',
        priority: 'medium',
        affectedResourceIds: ec2Nodes.map((n) => n.id),
        currentConfiguration: { pricing_model: 'On-Demand (No Commitment)' },
        proposedConfiguration: { pricing_model: 'Compute Savings Plan (1-Year No Upfront)' },
        explanation: 'Workloads running 24x7 (>700 hours/month) achieve approximately 35% lower hourly rates through 1-Year Compute Savings Plans.',
        estimatedCurrentCost: computeTotal,
        estimatedOptimizedCost: roundMoney(computeTotal - potentialSavings),
        estimatedMonthlySavings: potentialSavings,
        savingsPercentage: 35,
        currency: 'USD',
        performanceImpact: 'neutral',
        securityImpact: 'neutral',
        availabilityImpact: 'neutral',
        implementationEffort: 'low',
        confidenceLevel: 'medium',
        requiredAssumptions: ['Requires 1-year financial commitment to steady compute utilization baseline.'],
        documentationReferences: [{ title: 'AWS Savings Plans Documentation', url: 'https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html' }],
        status: 'pending',
      });
    }
  }

  recommendations.sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings);

  const savingsAnalysis = calculateAchievableSavings(recommendations);

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
    missingAssumptions,
    potentialMonthlySavings: savingsAnalysis.combinedAchievableSavings,
    individualSavingsSum: savingsAnalysis.individualSavingsSum,
    hasOverlappingRecommendations: savingsAnalysis.hasOverlappingRecommendations,
    recommendations,
    calculatedAt: new Date().toISOString(),
  };
}

export function calculateAchievableSavings(
  recommendations: CostOptimizationRecommendation[],
): {
  individualSavingsSum: number;
  combinedAchievableSavings: number;
  hasOverlappingRecommendations: boolean;
  overlapNotes: string[];
} {
  const individualSavingsSum =
    Math.round(recommendations.reduce((sum, r) => sum + r.estimatedMonthlySavings, 0) * 100) / 100;

  if (recommendations.length <= 1) {
    return {
      individualSavingsSum,
      combinedAchievableSavings: individualSavingsSum,
      hasOverlappingRecommendations: false,
      overlapNotes: [],
    };
  }

  const architecturalRecs = recommendations.filter((r) => r.category !== 'pricing-model');
  const pricingModelRecs = recommendations.filter((r) => r.category === 'pricing-model');

  const resourceState = new Map<
    string,
    {
      remainingCost: number;
      modifiedAttributes: Map<string, string>;
      appliedRecs: CostOptimizationRecommendation[];
    }
  >();

  let combinedSavings = 0;
  const overlapNotes: string[] = [];
  const appliedArchitecturalComputeSavings = new Map<string, number>();

  for (const rec of architecturalRecs) {
    let recCanApply = true;
    let conflictReason = '';

    for (const resId of rec.affectedResourceIds) {
      const state = resourceState.get(resId);
      if (state) {
        const proposedKeys = Object.keys(rec.proposedConfiguration || {});
        for (const key of proposedKeys) {
          if (state.modifiedAttributes.has(key)) {
            recCanApply = false;
            conflictReason = `Recommendation "${rec.title}" is mutually exclusive with "${state.modifiedAttributes.get(key)}" on resource "${resId}" (both modify ${key}). Kept highest-saving recommendation.`;
            break;
          }
        }
        if (!recCanApply) break;
      }
    }

    if (!recCanApply) {
      overlapNotes.push(conflictReason);
      continue;
    }

    let achievableSavingsForRec = 0;
    let hasCompoundedAdjustment = false;
    const affectsAlreadyOptimizedResource = rec.affectedResourceIds.some((id) => resourceState.has(id));

    if (!affectsAlreadyOptimizedResource) {
      achievableSavingsForRec = rec.estimatedMonthlySavings;
      for (const resId of rec.affectedResourceIds) {
        const resBaseline = rec.estimatedCurrentCost || rec.estimatedMonthlySavings;
        const remaining = Math.max(0, resBaseline - rec.estimatedMonthlySavings);
        const modAttrs = new Map<string, string>();
        for (const key of Object.keys(rec.proposedConfiguration || {})) {
          modAttrs.set(key, rec.title);
        }
        resourceState.set(resId, {
          remainingCost: remaining,
          modifiedAttributes: modAttrs,
          appliedRecs: [rec],
        });
      }
    } else {
      for (const resId of rec.affectedResourceIds) {
        const state = resourceState.get(resId);
        if (state) {
          const discountRatio =
            rec.savingsPercentage > 0
              ? rec.savingsPercentage / 100
              : rec.estimatedCurrentCost > 0
                ? rec.estimatedMonthlySavings / rec.estimatedCurrentCost
                : 0;

          const adjustedResourceSavings = Math.round(state.remainingCost * discountRatio * 100) / 100;
          state.remainingCost = Math.max(0, state.remainingCost - adjustedResourceSavings);
          for (const key of Object.keys(rec.proposedConfiguration || {})) {
            state.modifiedAttributes.set(key, rec.title);
          }
          state.appliedRecs.push(rec);

          achievableSavingsForRec += adjustedResourceSavings;
          hasCompoundedAdjustment = true;
        } else {
          const share = rec.estimatedMonthlySavings / rec.affectedResourceIds.length;
          achievableSavingsForRec += share;
          const modAttrs = new Map<string, string>();
          for (const key of Object.keys(rec.proposedConfiguration || {})) {
            modAttrs.set(key, rec.title);
          }
          resourceState.set(resId, {
            remainingCost: Math.max(0, (rec.estimatedCurrentCost || share) - share),
            modifiedAttributes: modAttrs,
            appliedRecs: [rec],
          });
        }
      }

      achievableSavingsForRec = Math.round(achievableSavingsForRec * 100) / 100;
      if (hasCompoundedAdjustment && achievableSavingsForRec < rec.estimatedMonthlySavings) {
        overlapNotes.push(
          `Recommendation "${rec.title}" savings adjusted from $${rec.estimatedMonthlySavings.toFixed(2)} to $${achievableSavingsForRec.toFixed(2)} to account for compounded savings on resource(s) ${rec.affectedResourceIds.join(', ')}.`,
        );
      }
    }

    combinedSavings += achievableSavingsForRec;

    if (rec.category === 'compute') {
      for (const resId of rec.affectedResourceIds) {
        const prev = appliedArchitecturalComputeSavings.get(resId) || 0;
        appliedArchitecturalComputeSavings.set(resId, prev + achievableSavingsForRec);
      }
    }
  }

  for (const rec of pricingModelRecs) {
    let totalComputeReductions = 0;
    for (const resId of rec.affectedResourceIds) {
      totalComputeReductions += appliedArchitecturalComputeSavings.get(resId) || 0;
    }

    if (totalComputeReductions > 0) {
      const adjustedBaseline = Math.max(0, rec.estimatedCurrentCost - totalComputeReductions);
      const adjustedSavings = Math.round(adjustedBaseline * (rec.savingsPercentage / 100) * 100) / 100;

      combinedSavings += adjustedSavings;
      overlapNotes.push(
        `Savings Plan recommendation adjusted from $${rec.estimatedMonthlySavings.toFixed(2)} to $${adjustedSavings.toFixed(2)} to prevent double-counting with Graviton/rights-sizing optimizations.`,
      );
    } else {
      combinedSavings += rec.estimatedMonthlySavings;
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
