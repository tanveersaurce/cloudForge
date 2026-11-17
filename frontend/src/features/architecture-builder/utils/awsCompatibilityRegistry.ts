import type {
  ArchitectureFlowNode,
  DependencyKind,
  RelationshipType,
} from '../types/architecture.types';
import {
  ALL_RELATIONSHIP_TYPES,
  RELATIONSHIP_DEFINITIONS,
} from './relationshipModel';

export interface CompatibleRelationshipOption {
  relationshipType: RelationshipType;
  dependencyKind: DependencyKind;
  recommended: boolean;
  reason: string;
}

export interface ConnectionCompatibilityResult {
  valid: boolean;
  relationshipType: RelationshipType;
  dependencyKind: DependencyKind;
  reason: string;
  warning?: string;
}

export interface ResourceDependencyRequirement {
  requiredTargetTypes: string[];
  acceptedRelationships: RelationshipType[];
  dependencyKind: 'hard-dependency' | 'optional';
  description: string;
}

interface PairRule {
  sourceTypes: string[];
  targetTypes: string[];
  compatible: Array<{
    relationshipType: RelationshipType;
    dependencyKind: DependencyKind;
    recommended?: boolean;
    reason: string;
  }>;
  disallowed?: Partial<Record<RelationshipType, string>>;
}

function normalizeResourceType(node: ArchitectureFlowNode): string {
  const raw = (node.data.resourceType || node.data.serviceSlug || '').toLowerCase().trim();
  const normalized = raw
    .replace(/^aws[_-]/, '')
    .replace(/^amazon[_-]/, '')
    .replace(/[- ]/g, '_');

  if (normalized === 'cloud' || normalized === 'aws_cloud') return 'aws_cloud';
  if (normalized === 'region' || normalized === 'aws_region') return 'aws_region';
  if (normalized === 'availability_zone' || normalized === 'az') return 'aws_availability_zone';
  if (normalized === 'vpc') return 'aws_vpc';
  if (
    normalized === 'subnet' ||
    normalized === 'public_subnet' ||
    normalized === 'private_subnet' ||
    normalized === 'isolated_subnet'
  )
    return 'aws_subnet';
  if (normalized === 'ec2' || normalized === 'instance' || normalized === 'ec2_instance') return 'aws_instance';
  if (
    normalized === 'rds' ||
    normalized === 'db_instance' ||
    normalized === 'rds_instance' ||
    normalized === 'database'
  )
    return 'aws_db_instance';
  if (normalized === 's3' || normalized === 's3_bucket' || normalized === 'bucket') return 'aws_s3_bucket';
  if (normalized === 'lambda' || normalized === 'lambda_function' || normalized === 'function') return 'aws_lambda_function';
  if (normalized === 'iam' || normalized === 'iam_role' || normalized === 'role') return 'aws_iam_role';
  if (normalized === 'kms' || normalized === 'kms_key' || normalized === 'key') return 'aws_kms_key';
  if (normalized === 'sqs' || normalized === 'sqs_queue' || normalized === 'queue') return 'aws_sqs_queue';
  if (normalized === 'sns' || normalized === 'sns_topic' || normalized === 'topic') return 'aws_sns_topic';
  if (normalized === 'dynamodb' || normalized === 'dynamodb_table' || normalized === 'dynamo_table' || normalized === 'table') return 'aws_dynamodb_table';
  if (
    normalized === 'alb' ||
    normalized === 'elb' ||
    normalized === 'load_balancer' ||
    normalized === 'application_load_balancer'
  )
    return 'aws_lb';
  if (normalized === 'nlb' || normalized === 'network_load_balancer') return 'aws_nlb';
  if (normalized === 'nat' || normalized === 'nat_gateway') return 'aws_nat_gateway';
  if (normalized === 'igw' || normalized === 'internet_gateway') return 'aws_internet_gateway';
  if (normalized === 'route_table') return 'aws_route_table';
  if (normalized === 'security_group') return 'aws_security_group';
  if (normalized === 'cloudfront' || normalized === 'cloudfront_distribution' || normalized === 'cdn') return 'aws_cloudfront_distribution';
  if (
    normalized === 'api_gateway' ||
    normalized === 'apigateway' ||
    normalized === 'api_gateway_rest_api' ||
    normalized === 'rest_api' ||
    normalized === 'api'
  )
    return 'aws_api_gateway_rest_api';
  if (normalized === 'ecs_cluster' || normalized === 'cluster') return 'aws_ecs_cluster';
  if (normalized === 'ecs_service' || normalized === 'service') return 'aws_ecs_service';
  if (normalized === 'ecs_task' || normalized === 'task') return 'aws_ecs_task';
  if (normalized === 'elasticache' || normalized === 'elasticache_cluster' || normalized === 'redis' || normalized === 'memcached')
    return 'aws_elasticache_cluster';
  if (normalized === 'cloudwatch' || normalized === 'cloudwatch_metric_alarm' || normalized === 'alarm') return 'aws_cloudwatch_metric_alarm';
  if (normalized === 'route53' || normalized === 'route53_zone' || normalized === 'dns') return 'aws_route53_zone';
  if (normalized === 'secrets_manager' || normalized === 'secretsmanager_secret' || normalized === 'secretsmanager') return 'aws_secretsmanager_secret';
  if (normalized === 'waf' || normalized === 'wafv2_web_acl' || normalized === 'web_acl') return 'aws_wafv2_web_acl';
  if (normalized === 'bedrock' || normalized === 'bedrock_agent') return 'aws_bedrock_agent';
  if (normalized === 'mediaconvert' || normalized === 'media_convert') return 'aws_media_convert';
  if (normalized === 'acm' || normalized === 'acm_certificate' || normalized === 'certificate') return 'aws_acm_certificate';
  if (raw === 'amazon-vpc' || raw === 'vpc') return 'aws_vpc';
  return raw;
}

const CONTAINER_RESOURCE_TYPES = new Set([
  'aws_cloud',
  'aws_region',
  'aws_vpc',
  'aws_availability_zone',
  'aws_subnet',
  'aws_ecs_cluster',
  'aws_resource_group',
]);

/**
 * Verified AWS resource-pair compatibility rules.
 * Note: These represent application-level architectural relationships, not automated IAM/network provisioning.
 */
const AWS_PAIR_RULES: PairRule[] = [
  {
    sourceTypes: ['aws_cloud'],
    targetTypes: [
      'aws_region',
      'aws_vpc',
      'aws_s3_bucket',
      'aws_cloudfront_distribution',
      'aws_route53_zone',
      'aws_iam_role',
    ],
    compatible: [
      {
        relationshipType: 'contains',
        dependencyKind: 'logical',
        recommended: true,
        reason: 'AWS Cloud envelope encloses regional infrastructure and global services.',
      },
    ],
  },
  {
    sourceTypes: ['aws_region'],
    targetTypes: [
      'aws_vpc',
      'aws_availability_zone',
      'aws_s3_bucket',
      'aws_dynamodb_table',
      'aws_lambda_function',
      'aws_api_gateway_rest_api',
      'aws_cloudwatch_metric_alarm',
      'aws_internet_gateway',
    ],
    compatible: [
      {
        relationshipType: 'contains',
        dependencyKind: 'logical',
        recommended: true,
        reason: 'AWS Region encloses regional VPC networks and managed services.',
      },
    ],
  },
  {
    sourceTypes: ['aws_vpc'],
    targetTypes: ['aws_availability_zone', 'aws_nat_gateway', 'aws_internet_gateway', 'aws_lb'],
    compatible: [
      {
        relationshipType: 'contains',
        dependencyKind: 'logical',
        recommended: true,
        reason: 'A VPC contains Availability Zones, Subnets, and regional VPC gateways.',
      },
    ],
  },
  {
    sourceTypes: ['aws_availability_zone'],
    targetTypes: ['aws_subnet', 'aws_instance', 'aws_db_instance', 'aws_nat_gateway', 'aws_lb'],
    compatible: [
      {
        relationshipType: 'contains',
        dependencyKind: 'logical',
        recommended: true,
        reason: 'An Availability Zone encloses subnets and zone-isolated compute/database resources.',
      },
    ],
  },
  {
    sourceTypes: ['aws_vpc'],
    targetTypes: ['aws_subnet'],
    compatible: [
      {
        relationshipType: 'contains',
        dependencyKind: 'hard-dependency',
        recommended: true,
        reason: 'A VPC contains one or more CIDR-scoped Subnets.',
      },
    ],
  },
  {
    sourceTypes: ['aws_subnet'],
    targetTypes: ['aws_vpc'],
    compatible: [
      {
        relationshipType: 'depends-on',
        dependencyKind: 'hard-dependency',
        recommended: true,
        reason: 'A Subnet requires a parent VPC.',
      },
      {
        relationshipType: 'attached-to',
        dependencyKind: 'hard-dependency',
        reason: 'Subnet is scoped within the target VPC.',
      },
    ],
    disallowed: {
      contains: 'A Subnet cannot contain a VPC; a VPC contains Subnets.',
    },
  },
  {
    sourceTypes: ['aws_internet_gateway'],
    targetTypes: ['aws_vpc'],
    compatible: [
      {
        relationshipType: 'attached-to',
        dependencyKind: 'hard-dependency',
        recommended: true,
        reason: 'An Internet Gateway attaches to a VPC to enable internet routing when configured in route tables.',
      },
      {
        relationshipType: 'depends-on',
        dependencyKind: 'hard-dependency',
        reason: 'Internet Gateway attachment depends on the target VPC.',
      },
    ],
    disallowed: {
      contains: 'An Internet Gateway cannot contain a VPC.',
    },
  },
  {
    sourceTypes: ['aws_vpc'],
    targetTypes: ['aws_internet_gateway'],
    compatible: [
      {
        relationshipType: 'attached-to',
        dependencyKind: 'optional',
        recommended: true,
        reason: 'VPC has an Internet Gateway attached.',
      },
    ],
  },
  {
    sourceTypes: ['aws_route_table'],
    targetTypes: ['aws_vpc'],
    compatible: [
      {
        relationshipType: 'depends-on',
        dependencyKind: 'hard-dependency',
        recommended: true,
        reason: 'A Route Table belongs to a VPC.',
      },
      {
        relationshipType: 'attached-to',
        dependencyKind: 'hard-dependency',
        reason: 'Route Table is associated with the VPC.',
      },
    ],
  },
  {
    sourceTypes: ['aws_route_table'],
    targetTypes: ['aws_subnet'],
    compatible: [
      {
        relationshipType: 'attached-to',
        dependencyKind: 'logical',
        recommended: true,
        reason: 'A Route Table can be associated with one or more Subnets.',
      },
      {
        relationshipType: 'routes-to',
        dependencyKind: 'network-traffic',
        reason: 'Route Table controls outbound routing for the associated Subnet.',
      },
    ],
  },
  {
    sourceTypes: ['aws_subnet'],
    targetTypes: ['aws_route_table'],
    compatible: [
      {
        relationshipType: 'attached-to',
        dependencyKind: 'logical',
        recommended: true,
        reason: 'Subnet is associated with a Route Table.',
      },
      {
        relationshipType: 'routes-to',
        dependencyKind: 'network-traffic',
        reason: 'Subnet traffic is routed according to the associated Route Table.',
      },
    ],
  },
  {
    sourceTypes: ['aws_route_table'],
    targetTypes: ['aws_internet_gateway', 'aws_nat_gateway'],
    compatible: [
      {
        relationshipType: 'routes-to',
        dependencyKind: 'network-traffic',
        recommended: true,
        reason: 'Route Table defines a route target pointing to an Internet Gateway or NAT Gateway.',
      },
      {
        relationshipType: 'depends-on',
        dependencyKind: 'logical',
        reason: 'Route entry references the gateway target.',
      },
    ],
  },
  {
    sourceTypes: ['aws_subnet'],
    targetTypes: ['aws_instance', 'aws_lb', 'aws_nat_gateway', 'aws_ecs_service'],
    compatible: [
      {
        relationshipType: 'contains',
        dependencyKind: 'logical',
        recommended: true,
        reason: 'Subnet hosts network interfaces for EC2 instances, Load Balancers, NAT Gateways, or ECS tasks.',
      },
    ],
  },
  {
    sourceTypes: ['aws_instance', 'aws_lb', 'aws_nat_gateway', 'aws_ecs_service'],
    targetTypes: ['aws_subnet'],
    compatible: [
      {
        relationshipType: 'depends-on',
        dependencyKind: 'hard-dependency',
        recommended: true,
        reason: 'Resource is deployed inside the target Subnet.',
      },
      {
        relationshipType: 'attached-to',
        dependencyKind: 'logical',
        reason: 'Resource network interface is attached to the Subnet.',
      },
    ],
    disallowed: {
      contains: 'Compute or gateway resources cannot contain a Subnet.',
    },
  },
  {
    sourceTypes: ['aws_lb', 'aws_cloudfront_distribution', 'aws_api_gateway_rest_api'],
    targetTypes: ['aws_instance', 'aws_ecs_service', 'aws_lambda_function', 'aws_s3_bucket'],
    compatible: [
      {
        relationshipType: 'load-balances-to',
        dependencyKind: 'network-traffic',
        recommended: true,
        reason: 'Load balancer or edge/API gateway forwards requests to configured compute targets.',
      },
      {
        relationshipType: 'sends-traffic-to',
        dependencyKind: 'network-traffic',
        reason: 'Forwards inbound traffic to target compute.',
      },
      {
        relationshipType: 'routes-to',
        dependencyKind: 'network-traffic',
        reason: 'Routes inbound API/web requests to target backend compute or service.',
      },
      {
        relationshipType: 'connects-to',
        dependencyKind: 'logical',
        reason: 'Connects distribution or API gateway to downstream backend service or origin bucket.',
      },
    ],
  },
  {
    sourceTypes: ['aws_instance', 'aws_ecs_service', 'aws_lambda_function'],
    targetTypes: ['aws_security_group'],
    compatible: [
      {
        relationshipType: 'attached-to',
        dependencyKind: 'security-permission',
        recommended: true,
        reason: 'Compute resource ENI is associated with a Security Group.',
      },
      {
        relationshipType: 'depends-on',
        dependencyKind: 'logical',
        reason: 'Compute resource references the Security Group.',
      },
    ],
  },
  {
    sourceTypes: ['aws_db_instance'],
    targetTypes: ['aws_db_subnet_group', 'aws_security_group'],
    compatible: [
      {
        relationshipType: 'depends-on',
        dependencyKind: 'hard-dependency',
        recommended: true,
        reason: 'RDS instance uses a DB Subnet Group and Security Groups.',
      },
      {
        relationshipType: 'attached-to',
        dependencyKind: 'security-permission',
        reason: 'RDS instance is associated with the target Security Group or Subnet Group.',
      },
    ],
  },
  {
    sourceTypes: ['aws_db_subnet_group'],
    targetTypes: ['aws_subnet'],
    compatible: [
      {
        relationshipType: 'depends-on',
        dependencyKind: 'hard-dependency',
        recommended: true,
        reason: 'DB Subnet Group spans two or more Subnets across Availability Zones.',
      },
      {
        relationshipType: 'contains',
        dependencyKind: 'logical',
        reason: 'DB Subnet Group groups target Subnets.',
      },
    ],
  },
  {
    sourceTypes: ['aws_instance', 'aws_ecs_service', 'aws_lambda_function'],
    targetTypes: ['aws_db_instance', 'aws_dynamodb_table'],
    compatible: [
      {
        relationshipType: 'connects-to',
        dependencyKind: 'network-traffic',
        recommended: true,
        reason: 'Application compute connects to database (subject to routing, security groups, and credentials).',
      },
      {
        relationshipType: 'sends-traffic-to',
        dependencyKind: 'network-traffic',
        reason: 'Compute tier sends queries to database.',
      },
      {
        relationshipType: 'stores-data-in',
        dependencyKind: 'logical',
        reason: 'Application persists structured data in the database.',
      },
      {
        relationshipType: 'depends-on',
        dependencyKind: 'optional',
        reason: 'Application workload depends on database availability.',
      },
    ],
  },
  {
    sourceTypes: ['aws_instance', 'aws_ecs_service', 'aws_lambda_function', 'aws_cloudfront_distribution'],
    targetTypes: ['aws_s3_bucket'],
    compatible: [
      {
        relationshipType: 'stores-data-in',
        dependencyKind: 'logical',
        recommended: true,
        reason: 'Resource stores or reads objects in the S3 bucket (requires IAM/bucket policy authorization).',
      },
      {
        relationshipType: 'accesses',
        dependencyKind: 'security-permission',
        reason: 'Resource accesses S3 bucket objects subject to IAM permissions.',
      },
      {
        relationshipType: 'connects-to',
        dependencyKind: 'logical',
        reason: 'Connects distribution or compute workload to target S3 bucket.',
      },
    ],
    disallowed: {
      contains: 'Compute resources do not contain S3 buckets.',
    },
  },
  {
    sourceTypes: ['aws_instance', 'aws_ecs_service', 'aws_lambda_function'],
    targetTypes: ['aws_iam_role'],
    compatible: [
      {
        relationshipType: 'accesses',
        dependencyKind: 'security-permission',
        recommended: true,
        reason: 'Compute resource assumes or uses an IAM Role (via instance profile or execution role).',
      },
      {
        relationshipType: 'attached-to',
        dependencyKind: 'security-permission',
        reason: 'IAM Role is attached to the compute resource.',
      },
    ],
    disallowed: {
      'sends-traffic-to': 'IAM Roles are identity resources and do not receive network traffic.',
      'load-balances-to': 'Cannot load-balance network traffic to an IAM Role.',
    },
  },
  {
    sourceTypes: ['aws_s3_bucket', 'aws_sqs_queue', 'aws_sns_topic', 'aws_api_gateway_rest_api', 'aws_dynamodb_table'],
    targetTypes: ['aws_lambda_function', 'aws_sqs_queue', 'aws_sns_topic'],
    compatible: [
      {
        relationshipType: 'triggers',
        dependencyKind: 'logical',
        recommended: true,
        reason: 'Event source triggers downstream serverless or messaging target.',
      },
      {
        relationshipType: 'sends-traffic-to',
        dependencyKind: 'logical',
        reason: 'Publishes messages or events to target.',
      },
    ],
  },
  {
    sourceTypes: ['aws_db_instance', 'aws_s3_bucket', 'aws_dynamodb_table'],
    targetTypes: ['aws_db_instance', 'aws_s3_bucket', 'aws_dynamodb_table'],
    compatible: [
      {
        relationshipType: 'replicates-to',
        dependencyKind: 'optional',
        recommended: true,
        reason: 'Data store replicates data to a replica or target bucket/table.',
      },
    ],
  },
];

/**
 * Verified hard & optional dependency rules per AWS resource type.
 */
export const AWS_DEPENDENCY_RULES: Record<string, ResourceDependencyRequirement[]> = {
  aws_subnet: [
    {
      requiredTargetTypes: ['aws_vpc'],
      acceptedRelationships: ['contains', 'depends-on', 'attached-to'],
      dependencyKind: 'hard-dependency',
      description: 'Subnet must belong to a parent Amazon VPC.',
    },
  ],
  aws_internet_gateway: [
    {
      requiredTargetTypes: ['aws_vpc'],
      acceptedRelationships: ['attached-to', 'depends-on'],
      dependencyKind: 'hard-dependency',
      description: 'Internet Gateway should be attached to a target Amazon VPC.',
    },
  ],
  aws_route_table: [
    {
      requiredTargetTypes: ['aws_vpc'],
      acceptedRelationships: ['depends-on', 'attached-to', 'contains'],
      dependencyKind: 'hard-dependency',
      description: 'Route Table must be scoped to an Amazon VPC.',
    },
  ],
  aws_db_subnet_group: [
    {
      requiredTargetTypes: ['aws_subnet'],
      acceptedRelationships: ['depends-on', 'contains'],
      dependencyKind: 'hard-dependency',
      description: 'DB Subnet Group requires associated Subnets.',
    },
  ],
};

function findMatchingPairRules(sourceType: string, targetType: string): PairRule[] {
  return AWS_PAIR_RULES.filter(
    (rule) => rule.sourceTypes.includes(sourceType) && rule.targetTypes.includes(targetType),
  );
}

/**
 * Returns compatible relationship options for a source -> target node pair.
 */
export function getCompatibleRelationships(
  sourceNode: ArchitectureFlowNode,
  targetNode: ArchitectureFlowNode,
): CompatibleRelationshipOption[] {
  const sourceType = normalizeResourceType(sourceNode);
  const targetType = normalizeResourceType(targetNode);
  const matchingRules = findMatchingPairRules(sourceType, targetType);

  if (matchingRules.length > 0) {
    const seen = new Set<RelationshipType>();
    const options: CompatibleRelationshipOption[] = [];

    for (const rule of matchingRules) {
      for (const item of rule.compatible) {
        if (!seen.has(item.relationshipType)) {
          seen.add(item.relationshipType);
          options.push({
            relationshipType: item.relationshipType,
            dependencyKind: item.dependencyKind,
            recommended: Boolean(item.recommended),
            reason: item.reason,
          });
        }
      }
    }
    return options;
  }

  // General fallback for AWS services without explicit pair overrides:
  // allow logical/network/dependency relationships, but disallow 'contains' unless source is a container.
  return ALL_RELATIONSHIP_TYPES.filter((relType) => {
    if (relType === 'contains' && !CONTAINER_RESOURCE_TYPES.has(sourceType)) {
      return false;
    }
    return true;
  }).map((relType) => {
    const def = RELATIONSHIP_DEFINITIONS[relType];
    return {
      relationshipType: relType,
      dependencyKind: def.dependencyKind,
      recommended: relType === 'connects-to',
      reason: def.description,
    };
  });
}

/**
 * Validates whether a specific relationshipType is valid between sourceNode and targetNode.
 */
export function validateConnectionCompatibility(
  sourceNode: ArchitectureFlowNode,
  targetNode: ArchitectureFlowNode,
  relationshipType: RelationshipType,
): ConnectionCompatibilityResult {
  const sourceType = normalizeResourceType(sourceNode);
  const targetType = normalizeResourceType(targetNode);
  const def = RELATIONSHIP_DEFINITIONS[relationshipType];

  if (sourceNode.id === targetNode.id) {
    return {
      valid: false,
      relationshipType,
      dependencyKind: def.dependencyKind,
      reason: 'A resource cannot have a self-referential relationship to itself.',
    };
  }

  const matchingRules = findMatchingPairRules(sourceType, targetType);
  for (const rule of matchingRules) {
    if (rule.disallowed?.[relationshipType]) {
      return {
        valid: false,
        relationshipType,
        dependencyKind: def.dependencyKind,
        reason: rule.disallowed[relationshipType] as string,
      };
    }
  }

  if (relationshipType === 'contains' && !CONTAINER_RESOURCE_TYPES.has(sourceType)) {
    const hasExplicitContains = matchingRules.some((r) =>
      r.compatible.some((c) => c.relationshipType === 'contains'),
    );
    if (!hasExplicitContains) {
      return {
        valid: false,
        relationshipType,
        dependencyKind: def.dependencyKind,
        reason: `${sourceNode.data.resourceName} (${sourceType}) is not a containment boundary for ${targetNode.data.resourceName}.`,
      };
    }
  }

  const compatibleOptions = getCompatibleRelationships(sourceNode, targetNode);
  const matchedOption = compatibleOptions.find((o) => o.relationshipType === relationshipType);

  if (matchedOption) {
    const warning =
      def.category === 'network' || def.category === 'security'
        ? 'Visual connections do not automatically provision routing, security group rules, or IAM permissions.'
        : undefined;

    return {
      valid: true,
      relationshipType,
      dependencyKind: matchedOption.dependencyKind,
      reason: matchedOption.reason,
      warning,
    };
  }

  return {
    valid: false,
    relationshipType,
    dependencyKind: def.dependencyKind,
    reason: `"${def.label}" is not a compatible relationship from ${sourceNode.data.resourceName} to ${targetNode.data.resourceName}.`,
  };
}

export function getResourceDependencyRules(
  node: ArchitectureFlowNode,
): ResourceDependencyRequirement[] {
  const resourceType = normalizeResourceType(node);
  return AWS_DEPENDENCY_RULES[resourceType] ?? [];
}

export function getNormalizedAwsResourceType(node: ArchitectureFlowNode): string {
  return normalizeResourceType(node);
}
