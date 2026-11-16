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

const CONTAINER_RESOURCE_TYPES = new Set([
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

/**
 * Finds edges whose relationshipType violates structural compatibility between connected nodes.
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

    const relType = edge.data?.relationshipType;
    if (!relType) continue;

    const sourceType = (sourceNode.data?.resourceType || sourceNode.data?.serviceSlug || '')
      .toLowerCase()
      .trim();
    const targetType = (targetNode.data?.resourceType || targetNode.data?.serviceSlug || '')
      .toLowerCase()
      .trim();

    // 1. Non-container resource attempting a "contains" relationship
    if (relType === 'contains' && !CONTAINER_RESOURCE_TYPES.has(sourceType)) {
      incompatible.push({
        edgeId: edge.id,
        reason: `Resource "${sourceNode.data?.resourceName || sourceType}" cannot contain "${targetNode.data?.resourceName || targetType}" because it is not a container boundary`,
      });
      continue;
    }

    // 2. Subnet cannot contain a VPC
    if (
      relType === 'contains' &&
      (sourceType === 'aws_subnet' || sourceType === 'subnet') &&
      (targetType === 'aws_vpc' || targetType === 'vpc')
    ) {
      incompatible.push({
        edgeId: edge.id,
        reason: 'A Subnet cannot contain a VPC; a VPC contains Subnets',
      });
      continue;
    }
  }

  return incompatible;
}
