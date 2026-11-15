import type { PricingDimensionRate } from '../types/pricing.types.js';

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

export const PRICING_METADATA = {
  source: 'AWS Price List Reference Snapshot (Illustrative)',
  retrievalTimestamp: '2026-11-01T00:00:00.000Z',
  currency: 'USD',
  version: '2026.11-v1',
  isLiveApi: false,
  disclaimer:
    'Illustrative benchmark rates based on AWS public Price List snapshots. Not actual AWS billing data. Excludes taxes, enterprise discounts, and dynamic spot fluctuations.',
};

// Base on-demand rates in us-east-1 (USD)
export const BASE_PRICING_RATES: Record<string, { unit: string; price: number; serviceCode: string; resourceType: string }> = {
  // EC2 Instances (Hourly)
  'ec2:t3.micro': { unit: 'Hrs', price: 0.0104, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:t3.small': { unit: 'Hrs', price: 0.0208, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:t3.medium': { unit: 'Hrs', price: 0.0416, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:t3.large': { unit: 'Hrs', price: 0.0832, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:t3.xlarge': { unit: 'Hrs', price: 0.1664, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:t4g.micro': { unit: 'Hrs', price: 0.0084, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:t4g.small': { unit: 'Hrs', price: 0.0168, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:t4g.medium': { unit: 'Hrs', price: 0.0336, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:t4g.large': { unit: 'Hrs', price: 0.0672, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:m5.large': { unit: 'Hrs', price: 0.096, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:m5.xlarge': { unit: 'Hrs', price: 0.192, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:m5.2xlarge': { unit: 'Hrs', price: 0.384, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:m6g.large': { unit: 'Hrs', price: 0.077, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:m6g.xlarge': { unit: 'Hrs', price: 0.154, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:c5.large': { unit: 'Hrs', price: 0.085, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },
  'ec2:c5.xlarge': { unit: 'Hrs', price: 0.170, serviceCode: 'AmazonEC2', resourceType: 'aws_instance' },

  // RDS Instances (Hourly)
  'rds:db.t3.micro': { unit: 'Hrs', price: 0.017, serviceCode: 'AmazonRDS', resourceType: 'aws_db_instance' },
  'rds:db.t3.small': { unit: 'Hrs', price: 0.034, serviceCode: 'AmazonRDS', resourceType: 'aws_db_instance' },
  'rds:db.t3.medium': { unit: 'Hrs', price: 0.068, serviceCode: 'AmazonRDS', resourceType: 'aws_db_instance' },
  'rds:db.t4g.micro': { unit: 'Hrs', price: 0.014, serviceCode: 'AmazonRDS', resourceType: 'aws_db_instance' },
  'rds:db.t4g.small': { unit: 'Hrs', price: 0.028, serviceCode: 'AmazonRDS', resourceType: 'aws_db_instance' },
  'rds:db.t4g.medium': { unit: 'Hrs', price: 0.056, serviceCode: 'AmazonRDS', resourceType: 'aws_db_instance' },
  'rds:db.m5.large': { unit: 'Hrs', price: 0.171, serviceCode: 'AmazonRDS', resourceType: 'aws_db_instance' },
  'rds:db.m5.xlarge': { unit: 'Hrs', price: 0.342, serviceCode: 'AmazonRDS', resourceType: 'aws_db_instance' },
  'rds:storage_gp3': { unit: 'GB-Mo', price: 0.115, serviceCode: 'AmazonRDS', resourceType: 'aws_db_instance' },
  'rds:backup_storage': { unit: 'GB-Mo', price: 0.095, serviceCode: 'AmazonRDS', resourceType: 'aws_db_instance' },

  // EBS Storage (GB-Month)
  'ebs:gp3': { unit: 'GB-Mo', price: 0.08, serviceCode: 'AmazonEC2', resourceType: 'aws_ebs_volume' },
  'ebs:gp2': { unit: 'GB-Mo', price: 0.10, serviceCode: 'AmazonEC2', resourceType: 'aws_ebs_volume' },
  'ebs:io2': { unit: 'GB-Mo', price: 0.125, serviceCode: 'AmazonEC2', resourceType: 'aws_ebs_volume' },
  'ebs:io2_iops': { unit: 'IOPS-Mo', price: 0.065, serviceCode: 'AmazonEC2', resourceType: 'aws_ebs_volume' },

  // S3 Storage (GB-Month)
  's3:standard': { unit: 'GB-Mo', price: 0.023, serviceCode: 'AmazonS3', resourceType: 'aws_s3_bucket' },
  's3:intelligent_frequent': { unit: 'GB-Mo', price: 0.023, serviceCode: 'AmazonS3', resourceType: 'aws_s3_bucket' },
  's3:intelligent_infrequent': { unit: 'GB-Mo', price: 0.0125, serviceCode: 'AmazonS3', resourceType: 'aws_s3_bucket' },
  's3:standard_ia': { unit: 'GB-Mo', price: 0.0125, serviceCode: 'AmazonS3', resourceType: 'aws_s3_bucket' },
  's3:requests_tier1': { unit: '1000-Req', price: 0.005, serviceCode: 'AmazonS3', resourceType: 'aws_s3_bucket' },
  's3:requests_tier2': { unit: '1000-Req', price: 0.0004, serviceCode: 'AmazonS3', resourceType: 'aws_s3_bucket' },

  // Networking
  'nat_gateway:hour': { unit: 'Hrs', price: 0.045, serviceCode: 'AmazonVPC', resourceType: 'aws_nat_gateway' },
  'nat_gateway:data': { unit: 'GB', price: 0.045, serviceCode: 'AmazonVPC', resourceType: 'aws_nat_gateway' },
  'alb:hour': { unit: 'Hrs', price: 0.0225, serviceCode: 'ElasticLoadBalancing', resourceType: 'aws_lb' },
  'alb:lcu_hour': { unit: 'LCU-Hrs', price: 0.008, serviceCode: 'ElasticLoadBalancing', resourceType: 'aws_lb' },
  'nlb:hour': { unit: 'Hrs', price: 0.0225, serviceCode: 'ElasticLoadBalancing', resourceType: 'aws_lb' },
  'cloudfront:data': { unit: 'GB', price: 0.085, serviceCode: 'AmazonCloudFront', resourceType: 'aws_cloudfront' },
  'data_transfer:out_internet': { unit: 'GB', price: 0.09, serviceCode: 'AWSDataTransfer', resourceType: 'data_transfer' },

  // Lambda
  'lambda:requests': { unit: '1M-Req', price: 0.20, serviceCode: 'AWSLambda', resourceType: 'aws_lambda_function' },
  'lambda:gb_seconds_x86': { unit: 'GB-Sec', price: 0.0000166667, serviceCode: 'AWSLambda', resourceType: 'aws_lambda_function' },
  'lambda:gb_seconds_arm': { unit: 'GB-Sec', price: 0.0000133334, serviceCode: 'AWSLambda', resourceType: 'aws_lambda_function' },
};

export function getPriceRate(
  dimensionKey: string,
  region: string = 'us-east-1',
  priceType: 'OnDemand' | 'Reserved1Yr' | 'Spot' = 'OnDemand',
): PricingDimensionRate | null {
  const base = BASE_PRICING_RATES[dimensionKey];
  if (!base) return null;

  const { multiplier, isSupported } = getServiceRegionMultiplier(base.serviceCode, region);
  let price = base.price * multiplier;

  // Apply commitment discounts if applicable
  let sourceNote = PRICING_METADATA.source;
  if (!isSupported) {
    sourceNote = `${PRICING_METADATA.source} (Unsupported region "${region}": using us-east-1 illustrative rates)`;
  }

  if (priceType === 'Reserved1Yr') {
    price = price * 0.65; // ~35% benchmark discount for 1-yr standard reservation
    sourceNote = `${sourceNote} [1-Yr Standard Reserved benchmark: ~35% discount, requires 1-year financial commitment]`;
  } else if (priceType === 'Spot') {
    price = price * 0.30; // ~70% benchmark discount for spot instances
    sourceNote = `${sourceNote} [Spot benchmark: ~70% discount; rates fluctuate dynamically and are subject to 2-minute interruption notice]`;
  }

  // Decimal precision rounding to 6 decimal places to prevent floating point inaccuracies
  price = Math.round(price * 1000000) / 1000000;

  return {
    serviceCode: base.serviceCode,
    resourceType: base.resourceType,
    region,
    dimension: dimensionKey,
    unit: base.unit,
    pricePerUnit: price,
    currency: 'USD',
    priceType,
    source: sourceNote,
    retrievedAt: PRICING_METADATA.retrievalTimestamp,
  };
}
