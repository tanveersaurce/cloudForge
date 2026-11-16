import { z } from 'zod';
import type {
  ArchitectureEdgeDto,
  ArchitectureNodeDto,
} from '../architectures/architecture.types.js';

export const RELATIONSHIP_TYPES = [
  'contains',
  'attached-to',
  'routes-to',
  'connects-to',
  'sends-traffic-to',
  'receives-traffic-from',
  'depends-on',
  'accesses',
  'replicates-to',
  'load-balances-to',
  'stores-data-in',
  'triggers',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const RELATIONSHIP_DIRECTIONS = [
  'source-to-target',
  'target-to-source',
  'bidirectional',
] as const;

export type RelationshipDirection = (typeof RELATIONSHIP_DIRECTIONS)[number];

export const relationshipMetadataSchema = z
  .object({
    protocol: z.string().trim().max(32).nullable().optional(),
    port: z
      .number()
      .int('Port must be an integer')
      .min(1, 'Port must be between 1 and 65535')
      .max(65535, 'Port must be between 1 and 65535')
      .nullable()
      .optional(),
    description: z.string().trim().max(500).optional(),
  })
  .passthrough();

export const relationshipTypeSchema = z
  .string()
  .trim()
  .transform((val) => (val === 'traffic-flow' ? 'sends-traffic-to' : val))
  .pipe(
    z.enum(RELATIONSHIP_TYPES, {
      errorMap: () => ({
        message: `relationshipType must be one of: ${RELATIONSHIP_TYPES.join(', ')}`,
      }),
    }),
  );

export const architectureEdgeDataSchema = z.object({
  relationshipType: relationshipTypeSchema,
  direction: z.enum(RELATIONSHIP_DIRECTIONS).optional().default('source-to-target'),
  label: z.string().trim().max(120).optional(),
  metadata: relationshipMetadataSchema.optional(),
});

export const architectureEdgeSchema: z.ZodType<ArchitectureEdgeDto, z.ZodTypeDef, unknown> = z
  .object({
    id: z.string().trim().min(1, 'Edge id is required'),
    source: z.string().trim().min(1, 'Edge source is required'),
    target: z.string().trim().min(1, 'Edge target is required'),
    sourceHandle: z.string().nullable().optional(),
    targetHandle: z.string().nullable().optional(),
    type: z.enum(['smoothstep', 'relationship']).default('smoothstep'),
    data: architectureEdgeDataSchema.optional(),
  })
  .refine((edge) => edge.source !== edge.target, {
    message: 'Self-loop edges are not allowed (source and target must differ)',
    path: ['target'],
  });

export const architectureEdgesArraySchema = z
  .array(architectureEdgeSchema)
  .superRefine((edges, ctx) => {
    const seenIds = new Set<string>();
    edges.forEach((edge, index) => {
      if (seenIds.has(edge.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate edge id "${edge.id}"`,
          path: [index, 'id'],
        });
      }
      seenIds.add(edge.id);
    });
  });

/**
 * Finds edges whose source or target does not reference an existing node ID.
 */
export function findInvalidEdgeReferences(
  edges: ArchitectureEdgeDto[],
  nodes: ArchitectureNodeDto[],
): Array<{ edgeId: string; missingNodeId: string; endpoint: 'source' | 'target' }> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const invalid: Array<{ edgeId: string; missingNodeId: string; endpoint: 'source' | 'target' }> =
    [];

  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      invalid.push({ edgeId: edge.id, missingNodeId: edge.source, endpoint: 'source' });
    }
    if (!nodeIds.has(edge.target)) {
      invalid.push({ edgeId: edge.id, missingNodeId: edge.target, endpoint: 'target' });
    }
  }

  return invalid;
}

export const CONTAINER_RESOURCE_TYPES = new Set([
  'aws_vpc',
  'vpc',
  'amazon-vpc',
  'aws_subnet',
  'subnet',
  'aws_cloud',
  'aws-cloud',
  'cloud',
  'aws_region',
  'region',
  'aws_availability_zone',
  'aws_az',
  'availability-zone',
  'az',
  'aws_ecs_cluster',
  'ecs_cluster',
  'ecs-cluster',
  'cluster',
  'aws_db_subnet_group',
  'db-subnet-group',
]);

export function normalizeNodeType(node: ArchitectureNodeDto): string {
  const rType = (node.data?.resourceType || '').toLowerCase().trim();
  if (rType === 'aws_instance' || rType === 'ec2' || rType === 'ec2-instance') return 'aws_instance';
  if (rType === 'aws_db_instance' || rType === 'rds' || rType === 'rds-instance') return 'aws_db_instance';
  if (rType === 'aws_subnet' || rType === 'subnet') return 'aws_subnet';
  if (rType === 'aws_vpc' || rType === 'vpc') return 'aws_vpc';
  if (rType === 'aws_lb' || rType === 'alb' || rType === 'elb' || rType === 'application-load-balancer') return 'aws_lb';
  if (rType === 'aws_internet_gateway' || rType === 'igw' || rType === 'internet-gateway') return 'aws_internet_gateway';
  if (rType === 'aws_nat_gateway' || rType === 'nat' || rType === 'nat-gateway') return 'aws_nat_gateway';
  if (rType === 'aws_route_table' || rType === 'route-table') return 'aws_route_table';
  if (rType === 'aws_security_group' || rType === 'security-group') return 'aws_security_group';
  if (rType === 'aws_s3_bucket' || rType === 's3' || rType === 's3-bucket') return 'aws_s3_bucket';
  if (rType === 'aws_lambda_function' || rType === 'lambda' || rType === 'lambda-function') return 'aws_lambda_function';
  if (rType === 'aws_iam_role' || rType === 'iam-role' || rType === 'iam') return 'aws_iam_role';
  if (rType === 'aws_dynamodb_table' || rType === 'dynamodb' || rType === 'dynamodb-table') return 'aws_dynamodb_table';
  if (rType === 'aws_sqs_queue' || rType === 'sqs' || rType === 'sqs-queue') return 'aws_sqs_queue';
  if (rType === 'aws_sns_topic' || rType === 'sns' || rType === 'sns-topic') return 'aws_sns_topic';
  if (rType === 'aws_cloudfront_distribution' || rType === 'cloudfront') return 'aws_cloudfront_distribution';
  if (rType === 'aws_api_gateway_rest_api' || rType === 'api-gateway') return 'aws_api_gateway_rest_api';
  if (rType) return rType;

  const rName = (node.data?.resourceName || '').toLowerCase().trim();
  if (rName === 'subnet') return 'aws_subnet';
  if (rName === 'vpc') return 'aws_vpc';
  if (rName.includes('ec2') || rName.includes('instance')) return 'aws_instance';
  if (rName.includes('rds') || rName.includes('database')) return 'aws_db_instance';

  const slug = (node.data?.serviceSlug || '').toLowerCase().trim();
  if (slug === 'amazon-vpc' || slug === 'vpc') return 'aws_vpc';
  if (slug === 'subnet') return 'aws_subnet';
  if (slug === 'amazon-ec2' || slug === 'ec2') return 'aws_instance';
  if (slug === 'amazon-rds' || slug === 'rds') return 'aws_db_instance';
  return slug;
}

export interface PairCompatibilityRule {
  sourceTypes: string[];
  targetTypes: string[];
  allowedRelationships: RelationshipType[];
  allowedDirections?: RelationshipDirection[];
  disallowed?: Partial<Record<RelationshipType, string>>;
}

export const AWS_PAIR_RULES: PairCompatibilityRule[] = [
  // 1. VPC contains Subnet
  {
    sourceTypes: ['aws_vpc'],
    targetTypes: ['aws_subnet'],
    allowedRelationships: ['contains', 'attached-to'],
    allowedDirections: ['source-to-target', 'bidirectional'],
  },
  // 2. Subnet attached-to or depends-on VPC
  {
    sourceTypes: ['aws_subnet'],
    targetTypes: ['aws_vpc'],
    allowedRelationships: ['attached-to', 'depends-on'],
    allowedDirections: ['source-to-target'],
    disallowed: {
      contains: 'A Subnet cannot contain a VPC; a VPC contains Subnets.',
    },
  },
  // 3. Internet Gateway attached-to VPC
  {
    sourceTypes: ['aws_internet_gateway'],
    targetTypes: ['aws_vpc'],
    allowedRelationships: ['attached-to', 'depends-on'],
    allowedDirections: ['source-to-target'],
    disallowed: {
      contains: 'An Internet Gateway cannot contain a VPC.',
      'routes-to': 'An Internet Gateway attaches to a VPC; route tables define packet routes.',
    },
  },
  // 4. VPC has Internet Gateway attached
  {
    sourceTypes: ['aws_vpc'],
    targetTypes: ['aws_internet_gateway'],
    allowedRelationships: ['attached-to', 'contains'],
    allowedDirections: ['source-to-target', 'bidirectional'],
  },
  // 5. Route Table attached-to or depends-on VPC
  {
    sourceTypes: ['aws_route_table'],
    targetTypes: ['aws_vpc'],
    allowedRelationships: ['attached-to', 'depends-on'],
  },
  // 6. Route Table to Subnet association / routing
  {
    sourceTypes: ['aws_route_table'],
    targetTypes: ['aws_subnet'],
    allowedRelationships: ['attached-to', 'routes-to'],
  },
  // 7. Subnet to Route Table association / routing
  {
    sourceTypes: ['aws_subnet'],
    targetTypes: ['aws_route_table'],
    allowedRelationships: ['attached-to', 'routes-to'],
  },
  // 8. Route Table routes-to Gateways
  {
    sourceTypes: ['aws_route_table'],
    targetTypes: ['aws_internet_gateway', 'aws_nat_gateway'],
    allowedRelationships: ['routes-to', 'depends-on'],
    allowedDirections: ['source-to-target'],
  },
  // 9. Subnet contains Compute & DB resources
  {
    sourceTypes: ['aws_subnet'],
    targetTypes: ['aws_instance', 'aws_lb', 'aws_nat_gateway', 'aws_ecs_service', 'aws_db_instance'],
    allowedRelationships: ['contains'],
    allowedDirections: ['source-to-target'],
  },
  // 10. Compute deployed in Subnet
  {
    sourceTypes: ['aws_instance', 'aws_lb', 'aws_nat_gateway', 'aws_ecs_service', 'aws_db_instance'],
    targetTypes: ['aws_subnet'],
    allowedRelationships: ['attached-to', 'depends-on'],
    allowedDirections: ['source-to-target'],
    disallowed: {
      contains: 'Compute, load balancer, or database resources cannot contain a Subnet.',
    },
  },
  // 11. Load Balancer / Edge distribution to Compute targets
  {
    sourceTypes: ['aws_lb', 'aws_cloudfront_distribution', 'aws_api_gateway_rest_api'],
    targetTypes: ['aws_instance', 'aws_ecs_service', 'aws_lambda_function', 'aws_s3_bucket'],
    allowedRelationships: ['load-balances-to', 'sends-traffic-to', 'connects-to'],
    allowedDirections: ['source-to-target'],
  },
  // 12. Security Group association
  {
    sourceTypes: ['aws_instance', 'aws_ecs_service', 'aws_lambda_function', 'aws_db_instance', 'aws_lb'],
    targetTypes: ['aws_security_group'],
    allowedRelationships: ['attached-to', 'depends-on'],
  },
  // 13. RDS Subnet Group associations
  {
    sourceTypes: ['aws_db_instance'],
    targetTypes: ['aws_db_subnet_group'],
    allowedRelationships: ['depends-on', 'attached-to'],
  },
  {
    sourceTypes: ['aws_db_subnet_group'],
    targetTypes: ['aws_subnet'],
    allowedRelationships: ['depends-on', 'contains'],
  },
  // 14. Compute connections to Databases
  {
    sourceTypes: ['aws_instance', 'aws_ecs_service', 'aws_lambda_function'],
    targetTypes: ['aws_db_instance', 'aws_dynamodb_table'],
    allowedRelationships: ['connects-to', 'sends-traffic-to', 'accesses', 'depends-on'],
  },
  // 15. Storage access
  {
    sourceTypes: ['aws_instance', 'aws_ecs_service', 'aws_lambda_function', 'aws_cloudfront_distribution'],
    targetTypes: ['aws_s3_bucket'],
    allowedRelationships: ['stores-data-in', 'accesses', 'connects-to', 'depends-on'],
  },
  // 16. IAM Role assumption
  {
    sourceTypes: ['aws_instance', 'aws_ecs_service', 'aws_lambda_function'],
    targetTypes: ['aws_iam_role'],
    allowedRelationships: ['accesses', 'attached-to', 'depends-on'],
  },
  // 17. Event triggers
  {
    sourceTypes: ['aws_s3_bucket', 'aws_sqs_queue', 'aws_sns_topic', 'aws_api_gateway_rest_api', 'aws_dynamodb_table'],
    targetTypes: ['aws_lambda_function', 'aws_sqs_queue', 'aws_sns_topic'],
    allowedRelationships: ['triggers', 'sends-traffic-to', 'connects-to'],
    allowedDirections: ['source-to-target'],
  },
  // 18. Data replication
  {
    sourceTypes: ['aws_db_instance', 'aws_s3_bucket', 'aws_dynamodb_table'],
    targetTypes: ['aws_db_instance', 'aws_s3_bucket', 'aws_dynamodb_table'],
    allowedRelationships: ['replicates-to'],
  },
  // 19. Inter-service traffic between compute and messaging tiers
  {
    sourceTypes: ['aws_instance', 'aws_ecs_service', 'aws_lambda_function'],
    targetTypes: ['aws_instance', 'aws_ecs_service', 'aws_lambda_function', 'aws_sqs_queue', 'aws_sns_topic'],
    allowedRelationships: ['sends-traffic-to', 'receives-traffic-from', 'connects-to', 'depends-on'],
  },
];

/**
 * Finds edges whose relationshipType or direction violates structural compatibility between connected nodes.
 */
export function findIncompatibleEdges(
  edges: ArchitectureEdgeDto[],
  nodes: ArchitectureNodeDto[],
): Array<{ edgeId: string; reason: string }> {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incompatible: Array<{ edgeId: string; reason: string }> = [];

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    // Reject self-loops
    if (edge.source === edge.target) {
      incompatible.push({
        edgeId: edge.id,
        reason: 'Self-referential connections are not allowed',
      });
      continue;
    }

    const relType = edge.data?.relationshipType;
    if (!relType) {
      incompatible.push({
        edgeId: edge.id,
        reason: 'Edge is missing required relationship metadata. A valid relationshipType must be specified.',
      });
      continue;
    }

    const direction = edge.data?.direction ?? 'source-to-target';
    const sourceType = normalizeNodeType(sourceNode);
    const targetType = normalizeNodeType(targetNode);

    // 1. General containment rules:
    // Only container resource types can act as a container boundary
    if (relType === 'contains') {
      if (!CONTAINER_RESOURCE_TYPES.has(sourceType)) {
        incompatible.push({
          edgeId: edge.id,
          reason: `Resource "${sourceNode.data?.resourceName || sourceType}" cannot contain "${targetNode.data?.resourceName || targetType}" because it is not a container boundary`,
        });
        continue;
      }

      if (direction === 'target-to-source') {
        incompatible.push({
          edgeId: edge.id,
          reason: 'A "contains" relationship must direct from parent container to child (source-to-target)',
        });
        continue;
      }
    }

    // 2. Disallow specific invalid containment hierarchies
    if (relType === 'contains' && (sourceType === 'aws_subnet' || sourceType === 'subnet')) {
      if (targetType === 'aws_vpc' || targetType === 'vpc') {
        incompatible.push({
          edgeId: edge.id,
          reason: 'A Subnet cannot contain a VPC; a VPC contains Subnets',
        });
        continue;
      }
      if (targetType === 'aws_subnet' || targetType === 'subnet') {
        incompatible.push({
          edgeId: edge.id,
          reason: 'A Subnet cannot contain another Subnet',
        });
        continue;
      }
    }

    // 3. Directional constraints on load-balances-to and triggers
    if (relType === 'load-balances-to' && direction === 'target-to-source') {
      incompatible.push({
        edgeId: edge.id,
        reason: 'A "load-balances-to" relationship must direct from load balancer to target (source-to-target)',
      });
      continue;
    }

    if (relType === 'triggers' && direction === 'target-to-source') {
      incompatible.push({
        edgeId: edge.id,
        reason: 'A "triggers" relationship must direct from event source to consumer (source-to-target)',
      });
      continue;
    }

    // 4. Validate pairwise compatibility rule if defined
    const matchedRule = AWS_PAIR_RULES.find(
      (rule) => rule.sourceTypes.includes(sourceType) && rule.targetTypes.includes(targetType),
    );

    if (matchedRule) {
      const typedRel = relType as RelationshipType;
      const typedDir = direction as RelationshipDirection;

      if (matchedRule.disallowed?.[typedRel]) {
        incompatible.push({
          edgeId: edge.id,
          reason: matchedRule.disallowed[typedRel] as string,
        });
        continue;
      }

      if (!matchedRule.allowedRelationships.includes(typedRel)) {
        incompatible.push({
          edgeId: edge.id,
          reason: `Relationship "${relType}" is not supported from "${sourceNode.data?.resourceName || sourceType}" to "${targetNode.data?.resourceName || targetType}"`,
        });
        continue;
      }

      if (matchedRule.allowedDirections && !matchedRule.allowedDirections.includes(typedDir)) {
        incompatible.push({
          edgeId: edge.id,
          reason: `Direction "${direction}" is not supported for relationship "${relType}" between "${sourceType}" and "${targetType}"`,
        });
        continue;
      }
    }
  }

  return incompatible;
}
