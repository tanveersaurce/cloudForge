import { AwsSupportLevel, TerraformSupportStatus } from '@prisma/client';
import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

export const listServicesQuerySchema = paginationQuerySchema.extend({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  category: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v.length > 0 && v !== 'all' ? v : undefined)),
  terraformSupport: z
    .nativeEnum(TerraformSupportStatus)
    .optional(),
  supportLevel: z
    .nativeEnum(AwsSupportLevel)
    .optional(),
  sort: z.enum(['name_asc', 'name_desc', 'category']).default('name_asc'),
  favoritesOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const searchServicesQuerySchema = listServicesQuerySchema.extend({
  q: z.string().trim().min(1, 'Search query "q" is required').max(100),
});

export const serviceSlugParamSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

export const serviceIdParamSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
