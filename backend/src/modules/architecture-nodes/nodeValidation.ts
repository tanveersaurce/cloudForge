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
  const rType = (data.resourceType || '').toLowerCase().trim();
  const rName = (data.resourceName || '').toLowerCase().trim();
  const slug = (data.serviceSlug || '').toLowerCase().trim();

  // If resourceType is explicitly set to a non-VPC type, honor it
  if (rType === 'aws_instance' || rType === 'ec2' || rType === 'instance') return 'aws_instance';
  if (rType === 'aws_db_instance' || rType === 'rds' || rType === 'database') return 'aws_db_instance';
  if (rType === 'aws_subnet' || rType === 'subnet') return 'aws_subnet';
  if (rType === 'aws_security_group' || rType === 'security_group' || rType === 'security-group') return 'aws_security_group';
  if (rType === 'aws_route_table' || rType === 'route_table' || rType === 'route-table') return 'aws_route_table';
  if (rType === 'aws_internet_gateway' || rType === 'internet_gateway' || rType === 'internet-gateway' || rType === 'igw') return 'aws_internet_gateway';
  if (rType === 'aws_nat_gateway' || rType === 'nat_gateway' || rType === 'nat-gateway' || rType === 'nat') return 'aws_nat_gateway';
  if (rType === 'aws_network_acl' || rType === 'network_acl' || rType === 'network-acl' || rType === 'nacl') return 'aws_network_acl';
  if (rType === 'aws_vpc_endpoint' || rType === 'vpc_endpoint' || rType === 'vpc-endpoint') return 'aws_vpc_endpoint';
  if (rType === 'aws_lambda_function' || rType === 'lambda' || rType === 'lambda_function') return 'aws_lambda_function';
  if (rType === 'aws_ecs_cluster' || rType === 'ecs_cluster' || rType === 'ecs-cluster' || rType === 'cluster') return 'aws_ecs_cluster';
  if (rType === 'aws_ecs_service' || rType === 'ecs_service' || rType === 'ecs-service') return 'aws_ecs_service';
  if (rType === 'aws_ecs_task' || rType === 'ecs_task' || rType === 'ecs-task') return 'aws_ecs_task';
  if (rType === 'aws_lb' || rType === 'aws_alb' || rType === 'alb' || rType === 'load_balancer' || rType === 'load-balancer') return 'aws_lb';
  if (rType === 'aws_nlb' || rType === 'nlb') return 'aws_nlb';
  if (rType === 'aws_elasticache_cluster' || rType === 'elasticache' || rType === 'redis') return 'aws_elasticache_cluster';
  if (rType === 'aws_opensearch_domain' || rType === 'opensearch' || rType === 'elasticsearch') return 'aws_opensearch_domain';
  if (rType === 'aws_redshift_cluster' || rType === 'redshift') return 'aws_redshift_cluster';
  if (rType === 'aws_s3_bucket' || rType === 's3') return 'aws_s3_bucket';
  if (rType === 'aws_dynamodb_table' || rType === 'dynamodb') return 'aws_dynamodb_table';
  if (rType === 'aws_api_gateway_rest_api' || rType === 'apigateway' || rType === 'api-gateway') return 'aws_api_gateway_rest_api';
  if (rType === 'aws_cloudfront_distribution' || rType === 'cloudfront') return 'aws_cloudfront_distribution';
  if (rType === 'aws_route53_zone' || rType === 'route53') return 'aws_route53_zone';
  if (rType === 'aws_sns_topic' || rType === 'sns') return 'aws_sns_topic';
  if (rType === 'aws_sqs_queue' || rType === 'sqs') return 'aws_sqs_queue';
  if (rType === 'aws_iam_role' || rType === 'iam' || rType === 'iam-role') return 'aws_iam_role';
  if (rType === 'aws_kms_key' || rType === 'kms') return 'aws_kms_key';
  if (rType === 'aws_cloudwatch_metric_alarm' || rType === 'cloudwatch') return 'aws_cloudwatch_metric_alarm';
  if (rType === 'aws_autoscaling_group' || rType === 'autoscaling' || rType === 'asg') return 'aws_autoscaling_group';
  if (rType === 'aws_region' || rType === 'region') return 'aws_region';
  if (rType === 'aws_availability_zone' || rType === 'availability_zone' || rType === 'az') return 'aws_availability_zone';
  if (rType === 'aws_cloud' || rType === 'cloud') return 'aws_cloud';
  if (rType === 'aws_resource_group' || rType === 'resource_group' || rType === 'resource-group') return 'aws_resource_group';

  // If resourceType is aws_vpc or empty, check if resourceName or slug clarifies the specific resource
  if (rName === 'subnet' || slug === 'subnet') return 'aws_subnet';
  if (rName.includes('security-group') || rName.includes('security_group')) return 'aws_security_group';
  if (rName.includes('route-table') || rName.includes('route_table')) return 'aws_route_table';
  if (rName.includes('internet-gateway') || rName.includes('igw')) return 'aws_internet_gateway';
  if (rName.includes('nat-gateway') || rName.includes('nat')) return 'aws_nat_gateway';
  if (rName.includes('network-acl') || rName.includes('nacl')) return 'aws_network_acl';
  if (rName.includes('vpc-endpoint')) return 'aws_vpc_endpoint';
  if (rName.includes('ec2') || rName.includes('instance') || slug === 'amazon-ec2') return 'aws_instance';
  if (rName.includes('rds') || rName.includes('database') || slug === 'amazon-rds') return 'aws_db_instance';
  if (rName.includes('lambda') || slug === 'aws-lambda') return 'aws_lambda_function';

  if (rType === 'aws_vpc' || rType === 'vpc' || rName === 'vpc' || slug === 'amazon-vpc' || slug === 'vpc') return 'aws_vpc';

  if (rType) return rType;
  if (rName) return rName;
  return slug;
}

// Explicit parent-child compatibility matrix
export const ALLOWED_CHILDREN_BY_PARENT: Record<string, Set<string>> = {
  aws_vpc: new Set([
    'aws_subnet',
    'aws_security_group',
    'aws_route_table',
    'aws_internet_gateway',
    'aws_nat_gateway',
    'aws_network_acl',
    'aws_vpc_endpoint',
    'aws_availability_zone',
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
  aws_availability_zone: new Set([
    'aws_subnet',
    'aws_instance',
    'aws_db_instance',
  ]),
  aws_cloud: new Set([
    'aws_region',
    'aws_vpc',
    'aws_s3_bucket',
    'aws_cloudfront_distribution',
    'aws_route53_zone',
    'aws_iam_role',
    'aws_resource_group',
  ]),
  aws_region: new Set([
    'aws_vpc',
    'aws_availability_zone',
    'aws_s3_bucket',
    'aws_dynamodb_table',
    'aws_resource_group',
  ]),
  aws_resource_group: new Set([
    // Resource groups can contain all standard resources
    '*',
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
