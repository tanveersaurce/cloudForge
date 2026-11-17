import { z } from 'zod';
import type { ArchitectureNodeDto } from '../architectures/architecture.types.js';

export const architectureNodeDataSchema = z.object({
  serviceId: z.string().trim().min(1, 'serviceId is required'),
  serviceSlug: z.string().trim().min(1, 'serviceSlug is required'),
  serviceName: z.string().trim().min(1, 'serviceName is required'),
  categorySlug: z.string().trim().min(1, 'categorySlug is required'),
  categoryName: z.string().trim().min(1, 'categoryName is required'),
  iconKey: z.string().trim().min(1, 'iconKey is required'),
  resourceName: z.string().trim().min(1, 'resourceName is required'),
  resourceType: z.string().trim().min(1, 'resourceType is required'),
  label: z.string().trim().min(1, 'label is required'),
  description: z.string().default(''),
  metadata: z.record(z.unknown()).default({}),
});

export const architectureNodeSchema: z.ZodType<ArchitectureNodeDto, z.ZodTypeDef, unknown> =
  z.object({
    id: z.string().trim().min(1, 'Node id is required'),
    type: z.literal('awsResource'),
    parentId: z.string().trim().nullable().optional(),
    extent: z.literal('parent').nullable().optional(),
    position: z.object({
      x: z.number().finite('position.x must be a finite number'),
      y: z.number().finite('position.y must be a finite number'),
    }),
    data: architectureNodeDataSchema,
  });

// Allowed resource types that can act as parent containers for other nodes
export const ALLOWED_PARENT_CONTAINER_TYPES = new Set([
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
  'aws_resource_group',
  'resource-group',
]);

export function normalizeResourceType(data: {
  resourceType?: string;
  resourceName?: string;
  serviceSlug?: string;
}): string {
  const normalizeStr = (val?: string) =>
    (val || '')
      .toLowerCase()
      .trim()
      .replace(/^aws[_-]/, '')
      .replace(/^amazon[_-]/, '')
      .replace(/[- ]/g, '_');

  const rType = normalizeStr(data.resourceType);
  const rName = normalizeStr(data.resourceName);
  const slug = normalizeStr(data.serviceSlug);

  // Containers
  if (rType === 'cloud' || rName === 'cloud' || rType === 'aws_cloud') return 'aws_cloud';
  if (rType === 'region' || rName === 'region' || rType === 'aws_region') return 'aws_region';
  if (rType === 'availability_zone' || rType === 'az' || rName.includes('availability_zone')) return 'aws_availability_zone';
  if (rType === 'cluster' || rType === 'ecs_cluster' || rName.includes('ecs_cluster')) return 'aws_ecs_cluster';
  if (rType === 'subnet' || rName.includes('subnet') || slug === 'subnet') return 'aws_subnet';

  // Compute & Database
  if (rType === 'instance' || rType === 'ec2' || rName.includes('instance') || rName.includes('ec2') || slug === 'ec2') return 'aws_instance';
  if (rType === 'db_instance' || rType === 'rds' || rType === 'database' || rName.includes('rds') || rName.includes('database') || slug === 'rds') return 'aws_db_instance';
  if (rType === 'lambda_function' || rType === 'lambda' || rName.includes('lambda') || slug === 'lambda') return 'aws_lambda_function';
  if (rType === 'ecs_service' || rName.includes('ecs_service')) return 'aws_ecs_service';
  if (rType === 'ecs_task' || rName.includes('ecs_task')) return 'aws_ecs_task';

  // Networking
  if (rType === 'security_group' || rName.includes('security_group')) return 'aws_security_group';
  if (rType === 'route_table' || rName.includes('route_table')) return 'aws_route_table';
  if (rType === 'internet_gateway' || rType === 'igw' || rName.includes('internet_gateway') || rName.includes('igw')) return 'aws_internet_gateway';
  if (rType === 'nat_gateway' || rType === 'nat' || rName.includes('nat_gateway') || rName.includes('nat')) return 'aws_nat_gateway';
  if (rType === 'network_acl' || rType === 'nacl' || rName.includes('network_acl') || rName.includes('nacl')) return 'aws_network_acl';
  if (rType === 'vpc_endpoint' || rName.includes('vpc_endpoint')) return 'aws_vpc_endpoint';
  if (rType === 'lb' || rType === 'alb' || rType === 'application_load_balancer' || rType === 'load_balancer' || rName.includes('load_balancer') || rName.includes('alb')) return 'aws_lb';
  if (rType === 'nlb' || rType === 'network_load_balancer' || rName.includes('nlb')) return 'aws_nlb';

  // Storage & Serverless & Others
  if (rType === 's3_bucket' || rType === 's3' || rName.includes('s3') || slug === 's3') return 'aws_s3_bucket';
  if (rType === 'dynamodb_table' || rType === 'dynamodb' || rName.includes('dynamodb') || slug === 'dynamodb') return 'aws_dynamodb_table';
  if (rType === 'api_gateway_rest_api' || rType === 'api_gateway' || rType === 'apigateway' || rName.includes('api_gateway') || slug === 'api_gateway') return 'aws_api_gateway_rest_api';
  if (rType === 'cloudfront_distribution' || rType === 'cloudfront' || rName.includes('cloudfront') || slug === 'cloudfront') return 'aws_cloudfront_distribution';
  if (rType === 'route53_zone' || rType === 'route53' || rName.includes('route53') || slug === 'route53') return 'aws_route53_zone';
  if (rType === 'cloudwatch_metric_alarm' || rType === 'cloudwatch' || rName.includes('cloudwatch') || slug === 'cloudwatch') return 'aws_cloudwatch_metric_alarm';
  if (rType === 'sns_topic' || rType === 'sns' || rName.includes('sns') || slug === 'sns') return 'aws_sns_topic';
  if (rType === 'sqs_queue' || rType === 'sqs' || rName.includes('sqs') || slug === 'sqs') return 'aws_sqs_queue';
  if (rType === 'iam_role' || rType === 'iam' || rName.includes('iam') || slug === 'iam') return 'aws_iam_role';
  if (rType === 'kms_key' || rType === 'kms' || rName.includes('kms') || slug === 'kms') return 'aws_kms_key';
  if (rType === 'autoscaling_group' || rType === 'asg' || rName.includes('autoscaling') || slug === 'autoscaling') return 'aws_autoscaling_group';
  if (rType === 'elasticache_cluster' || rType === 'elasticache' || rType === 'redis' || rName.includes('elasticache')) return 'aws_elasticache_cluster';
  if (rType === 'opensearch_domain' || rType === 'opensearch' || rType === 'elasticsearch' || rName.includes('opensearch')) return 'aws_opensearch_domain';
  if (rType === 'redshift_cluster' || rType === 'redshift' || rName.includes('redshift')) return 'aws_redshift_cluster';

  // VPC fallback
  if (rType === 'vpc' || rName === 'vpc' || slug === 'vpc') return 'aws_vpc';

  if (data.resourceType) return data.resourceType;
  return 'aws_unknown';
}

// Explicit parent-child compatibility matrix
export const ALLOWED_CHILDREN_BY_PARENT: Record<string, Set<string>> = {
  aws_cloud: new Set([
    '*',
  ]),
  aws_region: new Set([
    '*',
  ]),
  aws_resource_group: new Set([
    '*',
  ]),
  aws_vpc: new Set([
    'aws_subnet',
    'aws_availability_zone',
    'aws_security_group',
    'aws_route_table',
    'aws_internet_gateway',
    'aws_nat_gateway',
    'aws_network_acl',
    'aws_vpc_endpoint',
    'aws_lb',
    'aws_alb',
    'aws_nlb',
    'aws_instance',
    'aws_db_instance',
    'aws_ecs_cluster',
  ]),
  aws_availability_zone: new Set([
    'aws_subnet',
    'aws_instance',
    'aws_db_instance',
    'aws_lb',
    'aws_alb',
    'aws_nlb',
    'aws_nat_gateway',
  ]),
  aws_subnet: new Set([
    'aws_instance',
    'aws_db_instance',
    'aws_lambda_function',
    'aws_ecs_service',
    'aws_ecs_task',
    'aws_lb',
    'aws_alb',
    'aws_nlb',
    'aws_elasticache_cluster',
    'aws_opensearch_domain',
    'aws_redshift_cluster',
    'aws_nat_gateway',
    'aws_vpc_endpoint',
    'aws_security_group',
  ]),
  aws_ecs_cluster: new Set([
    'aws_ecs_service',
    'aws_ecs_task',
    'aws_instance',
  ]),
};

// Inverted lookup map: child resource type -> allowed parent types
export const ALLOWED_PARENT_TYPES_BY_CHILD: Record<string, Set<string>> = {};
for (const [parent, children] of Object.entries(ALLOWED_CHILDREN_BY_PARENT)) {
  for (const child of children) {
    if (!ALLOWED_PARENT_TYPES_BY_CHILD[child]) {
      ALLOWED_PARENT_TYPES_BY_CHILD[child] = new Set();
    }
    ALLOWED_PARENT_TYPES_BY_CHILD[child].add(parent);
  }
}

export const architectureNodesArraySchema = z
  .array(architectureNodeSchema)
  .superRefine((nodes, ctx) => {
    const seenIds = new Set<string>();
    const nodeMap = new Map<string, (typeof nodes)[0]>();

    // 1. Populate lookup map and detect duplicate IDs
    nodes.forEach((node, index) => {
      if (seenIds.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate node id "${node.id}"`,
          path: [index, 'id'],
        });
      }
      seenIds.add(node.id);
      nodeMap.set(node.id, node);
    });

    // 2. Validate parent-child references, hierarchy, and cycles (order-independent)
    nodes.forEach((node, index) => {
      if (!node.parentId) {
        return;
      }

      // 2a. Self-parent check
      if (node.parentId === node.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Self-parenting is not allowed: Node "${node.id}" cannot reference itself as parentId`,
          path: [index, 'parentId'],
        });
        return;
      }

      // 2b. Missing parent check
      if (!seenIds.has(node.parentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Node "${node.id}" references missing parentId "${node.parentId}"`,
          path: [index, 'parentId'],
        });
        return;
      }

      // 2c. Circular reference detection (direct and indirect cycles of any depth)
      const visited = new Set<string>([node.id]);
      let currentParentId: string | null | undefined = node.parentId;
      let hasCycle = false;

      while (currentParentId) {
        if (visited.has(currentParentId)) {
          hasCycle = true;
          break;
        }
        visited.add(currentParentId);
        const parentNode = nodeMap.get(currentParentId);
        if (!parentNode) break;
        currentParentId = parentNode.parentId;
      }

      if (hasCycle) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Circular parent-child relationship detected involving node "${node.id}"`,
          path: [index, 'parentId'],
        });
        return;
      }

      // 2d. Validate parent container type
      const parentNode = nodeMap.get(node.parentId);
      if (parentNode) {
        const parentType = normalizeResourceType(parentNode.data || {});

        if (!ALLOWED_PARENT_CONTAINER_TYPES.has(parentType)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Node "${node.id}" has invalid parent "${parentNode.id}": Resource type "${parentNode.data?.resourceType || parentType}" cannot act as a parent container. Leaf resources cannot contain other resources.`,
            path: [index, 'parentId'],
          });
          return;
        }

        // 2e. Explicit parent-child compatibility validation
        const childType = normalizeResourceType(node.data || {});
        const allowedChildren = ALLOWED_CHILDREN_BY_PARENT[parentType];

        if (allowedChildren && !allowedChildren.has('*') && !allowedChildren.has(childType)) {
          const childLabel = childType.replace(/^aws_/, '').toUpperCase();
          const parentLabel = parentType.replace(/^aws_/, '').toUpperCase();
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid hierarchy: ${parentLabel} "${parentNode.id}" cannot act as a parent container for ${childLabel} "${node.id}". Allowed children for ${parentLabel} are: ${Array.from(allowedChildren).join(', ')}`,
            path: [index, 'parentId'],
          });
          return;
        }
      }
    });
  });
