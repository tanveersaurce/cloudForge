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

function normalizeResourceType(data: {
  resourceType?: string;
  resourceName?: string;
  serviceSlug?: string;
}): string {
  const rType = (data.resourceType || '').toLowerCase().trim();
  if (rType === 'aws_instance' || rType === 'ec2') return 'aws_instance';
  if (rType === 'aws_db_instance' || rType === 'rds') return 'aws_db_instance';
  if (rType === 'aws_subnet' || rType === 'subnet') return 'aws_subnet';
  if (rType === 'aws_vpc' || rType === 'vpc') return 'aws_vpc';
  if (rType) return rType;

  const rName = (data.resourceName || '').toLowerCase().trim();
  if (rName === 'subnet') return 'aws_subnet';
  if (rName === 'vpc') return 'aws_vpc';
  if (rName.includes('ec2')) return 'aws_instance';
  if (rName.includes('rds')) return 'aws_db_instance';

  const slug = (data.serviceSlug || '').toLowerCase().trim();
  if (slug === 'subnet') return 'aws_subnet';
  if (slug === 'amazon-vpc' || slug === 'vpc') return 'aws_vpc';
  if (slug === 'amazon-ec2' || slug === 'ec2') return 'aws_instance';
  if (slug === 'amazon-rds' || slug === 'rds') return 'aws_db_instance';
  return slug;
}

export const architectureNodesArraySchema = z
  .array(architectureNodeSchema)
  .superRefine((nodes, ctx) => {
    const seenIds = new Set<string>();
    const nodeMap = new Map<string, (typeof nodes)[0]>();

    // 1. Check for duplicate node IDs and populate lookup map
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

    // 2. Validate parent-child references, hierarchy, and cycles
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

      // 2c. Circular reference detection (direct and indirect of any depth)
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
            message: `Node "${node.id}" has invalid parent "${parentNode.id}": Resource type "${parentNode.data?.resourceType || parentType}" cannot act as a parent container`,
            path: [index, 'parentId'],
          });
          return;
        }

        // 2e. Validate invalid parent-child combinations
        const childType = normalizeResourceType(node.data || {});

        // Subnet cannot contain a VPC
        if (parentType === 'aws_subnet' && childType === 'aws_vpc') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid hierarchy: Subnet "${parentNode.id}" cannot act as a parent container for VPC "${node.id}"`,
            path: [index, 'parentId'],
          });
          return;
        }

        // Subnet cannot contain another Subnet
        if (parentType === 'aws_subnet' && childType === 'aws_subnet') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid hierarchy: Subnet "${parentNode.id}" cannot act as a parent container for another Subnet "${node.id}"`,
            path: [index, 'parentId'],
          });
          return;
        }

        // VPC cannot contain an AWS Cloud or Region
        if (
          parentType === 'aws_vpc' &&
          (childType === 'aws_cloud' || childType === 'aws_region' || childType === 'region')
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid hierarchy: VPC "${parentNode.id}" cannot act as a parent container for "${childType}" node "${node.id}"`,
            path: [index, 'parentId'],
          });
          return;
        }
      }
    });
  });
