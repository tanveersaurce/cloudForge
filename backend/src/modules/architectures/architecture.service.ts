import type { Architecture, Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { findInvalidEdgeReferences } from '../architecture-edges/edgeValidation.js';
import type {
  ArchitectureDetailDto,
  ArchitectureEdgeDto,
  ArchitectureNodeDto,
  ArchitectureSummaryDto,
  CanvasViewportDto,
} from './architecture.types.js';
import type {
  CreateArchitectureInput,
  SaveCanvasInput,
  UpdateArchitectureInput,
} from './architecture.validation.js';

const DEFAULT_VIEWPORT: CanvasViewportDto = { x: 0, y: 0, zoom: 1 };

function parseNodesJson(value: Prisma.JsonValue): ArchitectureNodeDto[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as unknown as ArchitectureNodeDto[];
}

function parseEdgesJson(value: Prisma.JsonValue): ArchitectureEdgeDto[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as unknown as ArchitectureEdgeDto[];
}

function parseViewportJson(value: Prisma.JsonValue | null): CanvasViewportDto {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).x === 'number' &&
    typeof (value as Record<string, unknown>).y === 'number' &&
    typeof (value as Record<string, unknown>).zoom === 'number'
  ) {
    const record = value as Record<string, number>;
    return { x: record.x, y: record.y, zoom: record.zoom };
  }
  return { ...DEFAULT_VIEWPORT };
}

function toSummaryDto(arch: Architecture): ArchitectureSummaryDto {
  const edges = parseEdgesJson(arch.edges);
  return {
    id: arch.id,
    userId: arch.userId,
    name: arch.name,
    description: arch.description,
    region: arch.region,
    status: arch.status,
    resourceCount: arch.resourceCount,
    edgeCount: edges.length,
    createdAt: arch.createdAt.toISOString(),
    updatedAt: arch.updatedAt.toISOString(),
  };
}

function toDetailDto(arch: Architecture): ArchitectureDetailDto {
  const nodes = parseNodesJson(arch.nodes);
  const edges = parseEdgesJson(arch.edges);
  const viewport = parseViewportJson(arch.viewport);

  return {
    ...toSummaryDto(arch),
    nodes,
    edges,
    viewport,
  };
}

function assertArchitectureOwnership(arch: Architecture | null, userId: string): Architecture {
  if (!arch) {
    throw ApiError.notFound('Architecture not found');
  }
  if (arch.userId !== userId) {
    throw new ApiError(403, 'You do not have access to this architecture', 'FORBIDDEN');
  }
  return arch;
}

export async function listUserArchitectures(userId: string): Promise<ArchitectureSummaryDto[]> {
  const architectures = await prisma.architecture.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });

  return architectures.map(toSummaryDto);
}

export async function createArchitecture(
  userId: string,
  input: CreateArchitectureInput,
): Promise<ArchitectureDetailDto> {
  const created = await prisma.architecture.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      region: input.region,
      status: input.status,
      resourceCount: 0,
      nodes: [],
      edges: [],
      viewport: DEFAULT_VIEWPORT as unknown as Prisma.InputJsonValue,
    },
  });

  return toDetailDto(created);
}

export async function getArchitectureById(
  userId: string,
  id: string,
): Promise<ArchitectureDetailDto> {
  const arch = await prisma.architecture.findUnique({ where: { id } });
  const owned = assertArchitectureOwnership(arch, userId);
  return toDetailDto(owned);
}

export async function updateArchitectureMetadata(
  userId: string,
  id: string,
  input: UpdateArchitectureInput,
): Promise<ArchitectureDetailDto> {
  const existing = await prisma.architecture.findUnique({ where: { id } });
  assertArchitectureOwnership(existing, userId);

  const updated = await prisma.architecture.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.region !== undefined ? { region: input.region } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });

  return toDetailDto(updated);
}

export async function saveArchitectureCanvas(
  userId: string,
  id: string,
  input: SaveCanvasInput,
): Promise<ArchitectureDetailDto> {
  const invalidRefs = findInvalidEdgeReferences(input.edges, input.nodes);
  if (invalidRefs.length > 0) {
    const first = invalidRefs[0];
    throw ApiError.badRequest(
      `Edge "${first.edgeId}" references unknown ${first.endpoint} node "${first.missingNodeId}"`,
      invalidRefs,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.architecture.findUnique({ where: { id } });
    assertArchitectureOwnership(existing, userId);

    return tx.architecture.update({
      where: { id },
      data: {
        nodes: input.nodes as unknown as Prisma.InputJsonValue,
        edges: input.edges as unknown as Prisma.InputJsonValue,
        viewport: input.viewport as unknown as Prisma.InputJsonValue,
        resourceCount: input.nodes.length,
      },
    });
  });

  return toDetailDto(updated);
}

export async function duplicateArchitecture(
  userId: string,
  id: string,
): Promise<ArchitectureDetailDto> {
  const existing = await prisma.architecture.findUnique({ where: { id } });
  const owned = assertArchitectureOwnership(existing, userId);

  const duplicated = await prisma.architecture.create({
    data: {
      userId,
      name: `${owned.name} (Copy)`,
      description: owned.description,
      region: owned.region,
      status: 'draft',
      resourceCount: owned.resourceCount,
      nodes: (owned.nodes ?? []) as Prisma.InputJsonValue,
      edges: (owned.edges ?? []) as Prisma.InputJsonValue,
      viewport: (owned.viewport ?? DEFAULT_VIEWPORT) as Prisma.InputJsonValue,
    },
  });

  return toDetailDto(duplicated);
}

export async function deleteArchitecture(
  userId: string,
  id: string,
): Promise<{ deleted: true }> {
  const existing = await prisma.architecture.findUnique({ where: { id } });
  assertArchitectureOwnership(existing, userId);

  await prisma.architecture.delete({ where: { id } });
  return { deleted: true };
}
