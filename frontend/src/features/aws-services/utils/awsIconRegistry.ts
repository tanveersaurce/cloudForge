import type { ComponentType } from 'react';
import type { AwsIconProps } from './officialAwsIcons';
import {
  AcmIcon,
  AlbIcon,
  ApiGatewayIcon,
  AuroraIcon,
  AwsLogoIcon,
  CloudFrontIcon,
  CloudWatchIcon,
  DynamoDbIcon,
  EbsIcon,
  Ec2Icon,
  EcrIcon,
  EcsIcon,
  EksIcon,
  IamIcon,
  InternetGatewayIcon,
  KmsIcon,
  LambdaIcon,
  NatGatewayIcon,
  RdsIcon,
  Route53Icon,
  S3Icon,
  SecretsManagerIcon,
  SecurityGroupIcon,
  SubnetIcon,
  VpcIcon,
} from './officialAwsIcons';

export interface AwsVisualDefinition {
  name: string;
  category: string;
  categoryColor: string;
  borderColor: string;
  icon: ComponentType<AwsIconProps>;
  shortTag: string;
}

const DEFAULT_AWS_VISUAL: AwsVisualDefinition = {
  name: 'AWS Resource',
  category: 'General',
  categoryColor: '#232F3E',
  borderColor: '#475569',
  icon: AwsLogoIcon,
  shortTag: 'AWS',
};

export const AWS_SERVICE_REGISTRY: Record<string, AwsVisualDefinition> = {
  // Compute
  'amazon-ec2': {
    name: 'Amazon EC2',
    category: 'Compute',
    categoryColor: '#ED7100',
    borderColor: '#ED7100',
    icon: Ec2Icon,
    shortTag: 'EC2',
  },
  'ec2-instance': {
    name: 'EC2 Instance',
    category: 'Compute',
    categoryColor: '#ED7100',
    borderColor: '#ED7100',
    icon: Ec2Icon,
    shortTag: 'EC2',
  },
  'aws-lambda': {
    name: 'AWS Lambda',
    category: 'Serverless',
    categoryColor: '#ED7100',
    borderColor: '#ED7100',
    icon: LambdaIcon,
    shortTag: 'LAMBDA',
  },
  'lambda-function': {
    name: 'Lambda Function',
    category: 'Serverless',
    categoryColor: '#ED7100',
    borderColor: '#ED7100',
    icon: LambdaIcon,
    shortTag: 'LAMBDA',
  },
  'amazon-ecs': {
    name: 'Amazon ECS',
    category: 'Containers',
    categoryColor: '#ED7100',
    borderColor: '#ED7100',
    icon: EcsIcon,
    shortTag: 'ECS',
  },
  'amazon-eks': {
    name: 'Amazon EKS',
    category: 'Containers',
    categoryColor: '#ED7100',
    borderColor: '#ED7100',
    icon: EksIcon,
    shortTag: 'EKS',
  },
  'amazon-ecr': {
    name: 'Amazon ECR',
    category: 'Containers',
    categoryColor: '#ED7100',
    borderColor: '#ED7100',
    icon: EcrIcon,
    shortTag: 'ECR',
  },

  // Storage
  'amazon-s3': {
    name: 'Amazon S3',
    category: 'Storage',
    categoryColor: '#3F8624',
    borderColor: '#3F8624',
    icon: S3Icon,
    shortTag: 'S3',
  },
  's3-bucket': {
    name: 'S3 Bucket',
    category: 'Storage',
    categoryColor: '#3F8624',
    borderColor: '#3F8624',
    icon: S3Icon,
    shortTag: 'S3',
  },
  'amazon-ebs': {
    name: 'Amazon EBS',
    category: 'Storage',
    categoryColor: '#3F8624',
    borderColor: '#3F8624',
    icon: EbsIcon,
    shortTag: 'EBS',
  },

  // Database
  'amazon-rds': {
    name: 'Amazon RDS',
    category: 'Database',
    categoryColor: '#2E73B8',
    borderColor: '#2E73B8',
    icon: RdsIcon,
    shortTag: 'RDS',
  },
  'rds-instance': {
    name: 'RDS DB Instance',
    category: 'Database',
    categoryColor: '#2E73B8',
    borderColor: '#2E73B8',
    icon: RdsIcon,
    shortTag: 'RDS',
  },
  'amazon-aurora': {
    name: 'Amazon Aurora',
    category: 'Database',
    categoryColor: '#2E73B8',
    borderColor: '#2E73B8',
    icon: AuroraIcon,
    shortTag: 'AURORA',
  },
  'amazon-dynamodb': {
    name: 'Amazon DynamoDB',
    category: 'Database',
    categoryColor: '#2E73B8',
    borderColor: '#2E73B8',
    icon: DynamoDbIcon,
    shortTag: 'DDB',
  },
  'dynamodb-table': {
    name: 'DynamoDB Table',
    category: 'Database',
    categoryColor: '#2E73B8',
    borderColor: '#2E73B8',
    icon: DynamoDbIcon,
    shortTag: 'DDB',
  },

  // Networking & Content Delivery
  'elastic-load-balancing': {
    name: 'Elastic Load Balancing',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: AlbIcon,
    shortTag: 'ALB',
  },
  'application-load-balancer': {
    name: 'Application Load Balancer',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: AlbIcon,
    shortTag: 'ALB',
  },
  'alb': {
    name: 'ALB',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: AlbIcon,
    shortTag: 'ALB',
  },
  'amazon-vpc': {
    name: 'Amazon VPC',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: VpcIcon,
    shortTag: 'VPC',
  },
  'vpc': {
    name: 'Virtual Private Cloud',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: VpcIcon,
    shortTag: 'VPC',
  },
  'subnet': {
    name: 'VPC Subnet',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: SubnetIcon,
    shortTag: 'SUBNET',
  },
  'aws_subnet': {
    name: 'VPC Subnet',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: SubnetIcon,
    shortTag: 'SUBNET',
  },
  'internet-gateway': {
    name: 'Internet Gateway',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: InternetGatewayIcon,
    shortTag: 'IGW',
  },
  'aws-nat-gateway': {
    name: 'NAT Gateway',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: NatGatewayIcon,
    shortTag: 'NAT',
  },
  'nat-gateway': {
    name: 'NAT Gateway',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: NatGatewayIcon,
    shortTag: 'NAT',
  },
  'amazon-cloudfront': {
    name: 'Amazon CloudFront',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: CloudFrontIcon,
    shortTag: 'CF',
  },
  'cloudfront': {
    name: 'CloudFront Distribution',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: CloudFrontIcon,
    shortTag: 'CF',
  },
  'amazon-route-53': {
    name: 'Amazon Route 53',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: Route53Icon,
    shortTag: 'R53',
  },
  'route53': {
    name: 'Route 53 DNS',
    category: 'Networking',
    categoryColor: '#8C4FFF',
    borderColor: '#8C4FFF',
    icon: Route53Icon,
    shortTag: 'R53',
  },

  // Security, Identity & Compliance
  'aws-iam': {
    name: 'AWS IAM',
    category: 'Security',
    categoryColor: '#DD344C',
    borderColor: '#DD344C',
    icon: IamIcon,
    shortTag: 'IAM',
  },
  'iam-role': {
    name: 'IAM Role',
    category: 'Security',
    categoryColor: '#DD344C',
    borderColor: '#DD344C',
    icon: IamIcon,
    shortTag: 'IAM',
  },
  'aws-kms': {
    name: 'AWS KMS',
    category: 'Security',
    categoryColor: '#DD344C',
    borderColor: '#DD344C',
    icon: KmsIcon,
    shortTag: 'KMS',
  },
  'kms-key': {
    name: 'KMS Key',
    category: 'Security',
    categoryColor: '#DD344C',
    borderColor: '#DD344C',
    icon: KmsIcon,
    shortTag: 'KMS',
  },
  'aws-secrets-manager': {
    name: 'AWS Secrets Manager',
    category: 'Security',
    categoryColor: '#DD344C',
    borderColor: '#DD344C',
    icon: SecretsManagerIcon,
    shortTag: 'SECRETS',
  },
  'aws-certificate-manager': {
    name: 'AWS Certificate Manager',
    category: 'Security',
    categoryColor: '#DD344C',
    borderColor: '#DD344C',
    icon: AcmIcon,
    shortTag: 'ACM',
  },
  'security-group': {
    name: 'Security Group',
    category: 'Security',
    categoryColor: '#DD344C',
    borderColor: '#DD344C',
    icon: SecurityGroupIcon,
    shortTag: 'SG',
  },

  // Management & Governance
  'amazon-cloudwatch': {
    name: 'Amazon CloudWatch',
    category: 'Management',
    categoryColor: '#E05243',
    borderColor: '#E05243',
    icon: CloudWatchIcon,
    shortTag: 'CW',
  },

  // Application Integration
  'amazon-api-gateway': {
    name: 'Amazon API Gateway',
    category: 'Integration',
    categoryColor: '#E7157B',
    borderColor: '#E7157B',
    icon: ApiGatewayIcon,
    shortTag: 'APIGW',
  },
  'api-gateway': {
    name: 'API Gateway',
    category: 'Integration',
    categoryColor: '#E7157B',
    borderColor: '#E7157B',
    icon: ApiGatewayIcon,
    shortTag: 'APIGW',
  },
};

export function getOfficialAwsVisual(
  serviceSlugOrResourceType?: string | null,
  iconKey?: string | null,
): AwsVisualDefinition {
  const normalizedKey = (serviceSlugOrResourceType || '').trim().toLowerCase();
  if (normalizedKey && AWS_SERVICE_REGISTRY[normalizedKey]) {
    return AWS_SERVICE_REGISTRY[normalizedKey];
  }

  const normalizedIcon = (iconKey || '').trim().toLowerCase();
  if (normalizedIcon && AWS_SERVICE_REGISTRY[normalizedIcon]) {
    return AWS_SERVICE_REGISTRY[normalizedIcon];
  }

  // Fallback checks
  if (normalizedKey.includes('ec2') || normalizedIcon.includes('ec2')) return AWS_SERVICE_REGISTRY['amazon-ec2'];
  if (normalizedKey.includes('s3') || normalizedIcon.includes('s3')) return AWS_SERVICE_REGISTRY['amazon-s3'];
  if (normalizedKey.includes('rds') || normalizedIcon.includes('rds')) return AWS_SERVICE_REGISTRY['amazon-rds'];
  if (normalizedKey.includes('aurora')) return AWS_SERVICE_REGISTRY['amazon-aurora'];
  if (normalizedKey.includes('lambda')) return AWS_SERVICE_REGISTRY['aws-lambda'];
  if (normalizedKey.includes('dynamodb')) return AWS_SERVICE_REGISTRY['amazon-dynamodb'];
  if (normalizedKey.includes('load-balancer') || normalizedKey.includes('alb')) return AWS_SERVICE_REGISTRY['elastic-load-balancing'];
  if (normalizedKey.includes('vpc')) return AWS_SERVICE_REGISTRY['amazon-vpc'];
  if (normalizedKey.includes('subnet')) return AWS_SERVICE_REGISTRY['subnet'];
  if (normalizedKey.includes('nat')) return AWS_SERVICE_REGISTRY['nat-gateway'];
  if (normalizedKey.includes('gateway') || normalizedKey.includes('igw')) return AWS_SERVICE_REGISTRY['internet-gateway'];
  if (normalizedKey.includes('cloudfront')) return AWS_SERVICE_REGISTRY['amazon-cloudfront'];
  if (normalizedKey.includes('route-53') || normalizedKey.includes('route53')) return AWS_SERVICE_REGISTRY['amazon-route-53'];
  if (normalizedKey.includes('iam')) return AWS_SERVICE_REGISTRY['aws-iam'];
  if (normalizedKey.includes('kms')) return AWS_SERVICE_REGISTRY['aws-kms'];
  if (normalizedKey.includes('secrets')) return AWS_SERVICE_REGISTRY['aws-secrets-manager'];
  if (normalizedKey.includes('cloudwatch')) return AWS_SERVICE_REGISTRY['amazon-cloudwatch'];
  if (normalizedKey.includes('ecs')) return AWS_SERVICE_REGISTRY['amazon-ecs'];
  if (normalizedKey.includes('eks')) return AWS_SERVICE_REGISTRY['amazon-eks'];
  if (normalizedKey.includes('ecr')) return AWS_SERVICE_REGISTRY['amazon-ecr'];
  if (normalizedKey.includes('certificate') || normalizedKey.includes('acm')) return AWS_SERVICE_REGISTRY['aws-certificate-manager'];
  if (normalizedKey.includes('security-group')) return AWS_SERVICE_REGISTRY['security-group'];

  return DEFAULT_AWS_VISUAL;
}
