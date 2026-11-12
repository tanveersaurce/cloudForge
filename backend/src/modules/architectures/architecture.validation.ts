import { z } from 'zod';
import {
  architectureEdgesArraySchema,
  findInvalidEdgeReferences,
} from '../architecture-edges/edgeValidation.js';
import { architectureNodesArraySchema } from '../architecture-nodes/nodeValidation.js';

export const ARCHITECTURE_STATUSES = ['draft', 'active', 'archived'] as const;

export const canvasViewportSchema = z.object({
  x: z.number().finite('viewport.x must be a finite number'),
  y: z.number().finite('viewport.y must be a finite number'),
  zoom: z.number().finite('viewport.zoom must be a finite number').positive('viewport.zoom must be positive'),
});

export const architectureIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Architecture id is required'),
});

export const createArchitectureSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Architecture name is required')
    .max(120, 'Architecture name must be 120 characters or fewer'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be 1000 characters or fewer')
    .nullable()
    .optional(),
  region: z
    .string()
    .trim()
    .min(1, 'Region cannot be empty')
    .max(64, 'Region must be 64 characters or fewer')
    .default('us-east-1'),
  status: z.enum(ARCHITECTURE_STATUSES).default('draft'),
});

export const updateArchitectureSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Architecture name cannot be empty')
      .max(120, 'Architecture name must be 120 characters or fewer')
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, 'Description must be 1000 characters or fewer')
      .nullable()
      .optional(),
    region: z
      .string()
      .trim()
      .min(1, 'Region cannot be empty')
      .max(64, 'Region must be 64 characters or fewer')
      .optional(),
    status: z.enum(ARCHITECTURE_STATUSES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const saveCanvasSchema = z
  .object({
    nodes: architectureNodesArraySchema,
    edges: architectureEdgesArraySchema,
    viewport: canvasViewportSchema.optional().default({ x: 0, y: 0, zoom: 1 }),
  })
  .superRefine((data, ctx) => {
    const invalidRefs = findInvalidEdgeReferences(data.edges, data.nodes);
    for (const ref of invalidRefs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Edge "${ref.edgeId}" references unknown ${ref.endpoint} node "${ref.missingNodeId}"`,
        path: ['edges'],
      });
    }
  });

export type CreateArchitectureInput = z.infer<typeof createArchitectureSchema>;
export type UpdateArchitectureInput = z.infer<typeof updateArchitectureSchema>;
export type SaveCanvasInput = z.infer<typeof saveCanvasSchema>;
