import { z } from 'zod';
import type {
  ArchitectureEdgeDto,
  ArchitectureNodeDto,
} from '../architectures/architecture.types.js';

export const architectureEdgeDataSchema = z.object({
  relationshipType: z.string().trim().min(1, 'relationshipType is required'),
  label: z.string().optional(),
});

export const architectureEdgeSchema: z.ZodType<ArchitectureEdgeDto> = z
  .object({
    id: z.string().trim().min(1, 'Edge id is required'),
    source: z.string().trim().min(1, 'Edge source is required'),
    target: z.string().trim().min(1, 'Edge target is required'),
    sourceHandle: z.string().nullable().optional(),
    targetHandle: z.string().nullable().optional(),
    type: z.literal('smoothstep'),
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
