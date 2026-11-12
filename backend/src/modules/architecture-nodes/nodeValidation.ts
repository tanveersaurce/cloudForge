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
  position: z.object({
    x: z.number().finite('position.x must be a finite number'),
    y: z.number().finite('position.y must be a finite number'),
  }),
  data: architectureNodeDataSchema,
});

export const architectureNodesArraySchema = z
  .array(architectureNodeSchema)
  .superRefine((nodes, ctx) => {
    const seenIds = new Set<string>();
    nodes.forEach((node, index) => {
      if (seenIds.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate node id "${node.id}"`,
          path: [index, 'id'],
        });
      }
      seenIds.add(node.id);
    });
  });
