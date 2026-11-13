import { getPriceRate, PRICING_METADATA } from '../data/awsPricingCatalog.js';
import type {
  CostEstimationResult,
  CostItemEstimate,
  DimensionBreakdown,
  ServiceCostSummary,
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

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export class CostCalculator {
  public static calculateCost(
    architectureId: string,
    region: string = 'us-east-1',
    nodes: ArchitectureNodeInput[],
    assumptions: WorkloadAssumptions,
  ): Omit<CostEstimationResult, 'recommendations' | 'potentialMonthlySavings'> {
    const resourceItems: CostItemEstimate[] = [];
    const missingAssumptions: string[] = [];

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
          const rateKey = `ec2:${instanceType}`;
          const rate = getPriceRate(rateKey, region);

          if (rate) {
            const computeCost = rate.pricePerUnit * assumptions.monthlyOperatingHours;
            dimensions.push({
              name: `Compute (${instanceType})`,
              unit: 'Hrs',
              quantity: assumptions.monthlyOperatingHours,
              unitPrice: rate.pricePerUnit,
              extendedCost: roundMoney(computeCost),
            });
            itemMonthly += computeCost;
          } else {
            isAvailable = false;
            warnings.push(`Pricing unavailable for instance type ${instanceType}`);
          }

          // Optional root volume storage
          const rootSize = Number(meta.root_volume_size || 20); // Default 20GB root
          const ebsRate = getPriceRate('ebs:gp3', region);
          if (ebsRate) {
            const ebsCost = rootSize * ebsRate.pricePerUnit;
            dimensions.push({
              name: `Root EBS Volume (gp3)`,
              unit: 'GB-Mo',
              quantity: rootSize,
              unitPrice: ebsRate.pricePerUnit,
              extendedCost: roundMoney(ebsCost),
            });
            itemMonthly += ebsCost;
          }
          break;
        }

        case 'aws_lambda_function': {
          serviceCode = 'AWSLambda';
          const memoryMb = Number(meta.memory_size || 128);
          const arch = (meta.architecture as string) || 'x86_64';
          const isArm = arch.includes('arm');
          const gbSecondsRateKey = isArm ? 'lambda:gb_seconds_arm' : 'lambda:gb_seconds_x86';
          const gbSecRate = getPriceRate(gbSecondsRateKey, region);
          const reqRate = getPriceRate('lambda:requests', region);

          if (gbSecRate && reqRate) {
            const totalGbSeconds =
              (memoryMb / 1024) *
              (assumptions.averageLambdaDurationMs / 1000) *
              assumptions.monthlyLambdaInvocations;
            const computeCost = totalGbSeconds * gbSecRate.pricePerUnit;
            const requestCost = (assumptions.monthlyLambdaInvocations / 1000000) * reqRate.pricePerUnit;

            dimensions.push({
              name: `Invocations (${assumptions.monthlyLambdaInvocations.toLocaleString()} calls)`,
              unit: '1M-Req',
              quantity: assumptions.monthlyLambdaInvocations / 1000000,
              unitPrice: reqRate.pricePerUnit,
              extendedCost: roundMoney(requestCost),
            });
            dimensions.push({
              name: `Compute Execution (${memoryMb} MB, ${assumptions.averageLambdaDurationMs} ms avg)`,
              unit: 'GB-Sec',
              quantity: roundMoney(totalGbSeconds),
              unitPrice: gbSecRate.pricePerUnit,
              extendedCost: roundMoney(computeCost),
            });
            itemMonthly += computeCost + requestCost;
          }
          break;
        }

        case 'aws_db_instance': {
          serviceCode = 'AmazonRDS';
          const instanceClass = (meta.instance_class as string) || 'db.t3.micro';
          const isMultiAz = meta.multi_az === true;
          const rateKey = `rds:${instanceClass}`;
          const rate = getPriceRate(rateKey, region);

          if (rate) {
            const multiMultiplier = isMultiAz ? 2.0 : 1.0;
            const instanceCost = rate.pricePerUnit * multiMultiplier * assumptions.monthlyOperatingHours;
            dimensions.push({
              name: `RDS Instance (${instanceClass}${isMultiAz ? ' - Multi-AZ' : ''})`,
              unit: 'Hrs',
              quantity: assumptions.monthlyOperatingHours,
              unitPrice: roundMoney(rate.pricePerUnit * multiMultiplier),
              extendedCost: roundMoney(instanceCost),
            });
            itemMonthly += instanceCost;
          } else {
            isAvailable = false;
            warnings.push(`Pricing unavailable for RDS class ${instanceClass}`);
          }

          const storageGb = Number(meta.allocated_storage || 20);
          const storageRate = getPriceRate('rds:storage_gp3', region);
          if (storageRate) {
            const storageCost = storageGb * storageRate.pricePerUnit * (isMultiAz ? 2.0 : 1.0);
            dimensions.push({
              name: `Allocated Storage (${storageGb} GB gp3${isMultiAz ? ' Multi-AZ' : ''})`,
              unit: 'GB-Mo',
              quantity: storageGb * (isMultiAz ? 2 : 1),
              unitPrice: storageRate.pricePerUnit,
              extendedCost: roundMoney(storageCost),
            });
            itemMonthly += storageCost;
          }
          break;
        }

        case 'aws_s3_bucket': {
          serviceCode = 'AmazonS3';
          const s3Rate = getPriceRate('s3:standard', region);
          const reqRate = getPriceRate('s3:requests_tier1', region);

          if (s3Rate && reqRate) {
            const storageCost = assumptions.monthlyS3StorageGb * s3Rate.pricePerUnit;
            const reqCost = (assumptions.monthlyS3Requests / 1000) * reqRate.pricePerUnit;

            dimensions.push({
              name: `Standard Storage (${assumptions.monthlyS3StorageGb} GB)`,
              unit: 'GB-Mo',
              quantity: assumptions.monthlyS3StorageGb,
              unitPrice: s3Rate.pricePerUnit,
              extendedCost: roundMoney(storageCost),
            });
            dimensions.push({
              name: `Requests (${assumptions.monthlyS3Requests.toLocaleString()} PUT/GET)`,
              unit: '1000-Req',
              quantity: assumptions.monthlyS3Requests / 1000,
              unitPrice: reqRate.pricePerUnit,
              extendedCost: roundMoney(reqCost),
            });
            itemMonthly += storageCost + reqCost;
          }
          break;
        }

        case 'aws_ebs_volume': {
          serviceCode = 'AmazonEC2';
          const volType = (meta.volume_type as string) || 'gp3';
          const sizeGb = Number(meta.size || 50);
          const rateKey = `ebs:${volType}`;
          const rate = getPriceRate(rateKey, region);

          if (rate) {
            const storageCost = sizeGb * rate.pricePerUnit;
            dimensions.push({
              name: `EBS Volume (${sizeGb} GB ${volType})`,
              unit: 'GB-Mo',
              quantity: sizeGb,
              unitPrice: rate.pricePerUnit,
              extendedCost: roundMoney(storageCost),
            });
            itemMonthly += storageCost;
          }
          break;
        }

        case 'aws_nat_gateway': {
          serviceCode = 'AmazonVPC';
          const hrRate = getPriceRate('nat_gateway:hour', region);
          const dataRate = getPriceRate('nat_gateway:data', region);

          if (hrRate && dataRate) {
            const hrCost = hrRate.pricePerUnit * assumptions.monthlyOperatingHours;
            const dataCost = assumptions.monthlyNatTrafficGb * dataRate.pricePerUnit;

            dimensions.push({
              name: `Provisioned Gateway Running Hours`,
              unit: 'Hrs',
              quantity: assumptions.monthlyOperatingHours,
              unitPrice: hrRate.pricePerUnit,
              extendedCost: roundMoney(hrCost),
            });
            dimensions.push({
              name: `Data Processed (${assumptions.monthlyNatTrafficGb} GB)`,
              unit: 'GB',
              quantity: assumptions.monthlyNatTrafficGb,
              unitPrice: dataRate.pricePerUnit,
              extendedCost: roundMoney(dataCost),
            });
            itemMonthly += hrCost + dataCost;
          }
          break;
        }

        case 'aws_lb': {
          serviceCode = 'ElasticLoadBalancing';
          const albRate = getPriceRate('alb:hour', region);
          const lcuRate = getPriceRate('alb:lcu_hour', region);

          if (albRate && lcuRate) {
            const hrCost = albRate.pricePerUnit * assumptions.monthlyOperatingHours;
            const lcuCost = lcuRate.pricePerUnit * 1.0 * assumptions.monthlyOperatingHours; // 1 baseline LCU

            dimensions.push({
              name: `Load Balancer Running Hours`,
              unit: 'Hrs',
              quantity: assumptions.monthlyOperatingHours,
              unitPrice: albRate.pricePerUnit,
              extendedCost: roundMoney(hrCost),
            });
            dimensions.push({
              name: `Capacity Units (1 baseline LCU)`,
              unit: 'LCU-Hrs',
              quantity: assumptions.monthlyOperatingHours,
              unitPrice: lcuRate.pricePerUnit,
              extendedCost: roundMoney(lcuCost),
            });
            itemMonthly += hrCost + lcuCost;
          }
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
            name: 'AWS Managed Core Resource (Included with AWS account)',
            unit: 'N/A',
            quantity: 1,
            unitPrice: 0.0,
            extendedCost: 0.0,
          });
          break;
        }

        default: {
          isAvailable = false;
          warnings.push(`Resource type "${type}" has no billable AWS pricing model or is free.`);
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
        pricingSource: PRICING_METADATA.source,
        pricingRetrievedAt: PRICING_METADATA.retrievalTimestamp,
        warnings,
      });
    }

    // Include Internet Data Transfer Out if data transfer assumption > 0
    if (assumptions.monthlyDataTransferOutGb > 100) {
      const billableDataGb = assumptions.monthlyDataTransferOutGb - 100; // First 100GB free tier
      const dtRate = getPriceRate('data_transfer:out_internet', region);
      if (dtRate) {
        const dtCost = roundMoney(billableDataGb * dtRate.pricePerUnit);
        totalMonthly += dtCost;
        resourceItems.push({
          resourceId: 'data-transfer-egress',
          resourceName: 'Internet Data Transfer Out (Egress)',
          resourceType: 'data_transfer',
          serviceCode: 'AWSDataTransfer',
          region,
          dimensions: [
            {
              name: `Outbound Internet Traffic (over 100 GB free tier)`,
              unit: 'GB',
              quantity: billableDataGb,
              unitPrice: dtRate.pricePerUnit,
              extendedCost: dtCost,
            },
          ],
          monthlyCost: dtCost,
          hourlyCost: roundMoney(dtCost / 730),
          currency: 'USD',
          isPricingAvailable: true,
          pricingSource: PRICING_METADATA.source,
          pricingRetrievedAt: PRICING_METADATA.retrievalTimestamp,
          warnings: [],
        });
      }
    }

    totalMonthly = roundMoney(totalMonthly);
    totalHourly = roundMoney(totalHourly);
    const totalAnnual = roundMoney(totalMonthly * 12);

    // Aggregate Service Breakdown
    const serviceMap = new Map<string, { monthlyCost: number; resourceCount: number; serviceName: string }>();

    for (const item of resourceItems) {
      const current = serviceMap.get(item.serviceCode) || {
        monthlyCost: 0,
        resourceCount: 0,
        serviceName: item.serviceCode,
      };
      current.monthlyCost += item.monthlyCost;
      current.resourceCount += 1;
      serviceMap.set(item.serviceCode, current);
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
      calculatedAt: new Date().toISOString(),
    };
  }
}
