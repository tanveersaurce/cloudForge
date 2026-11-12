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

export const RELATIONSHIP_DIRECTIONS = [
  'source-to-target',
  'target-to-source',
  'bidirectional',
] as const;

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

export const architectureEdgeDataSchema = z.object({
  relationshipType: z.string().trim().min(1, 'relationshipType is required'),
  direction: z.enum(RELATIONSHIP_DIRECTIONS).optional(),
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
