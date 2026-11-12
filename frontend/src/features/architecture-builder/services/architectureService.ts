import { apiFetch } from '@/services/apiClient';
import type { ApiSuccessResponse } from '@/types/api';
import type {
  ArchitectureDetailDto,
  ArchitectureSummaryDto,
  CreateArchitectureInput,
  SaveArchitectureCanvasInput,
  UpdateArchitectureMetadataInput,
} from '../types/architecture.types';

export async function listArchitectures(): Promise<ArchitectureSummaryDto[]> {
  const res = await apiFetch<ApiSuccessResponse<ArchitectureSummaryDto[]>>('/architectures');
  return res.data;
}

export async function createArchitecture(
  input: CreateArchitectureInput,
): Promise<ArchitectureDetailDto> {
  const res = await apiFetch<ApiSuccessResponse<ArchitectureDetailDto>>('/architectures', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function getArchitectureById(id: string): Promise<ArchitectureDetailDto> {
  const res = await apiFetch<ApiSuccessResponse<ArchitectureDetailDto>>(
    `/architectures/${encodeURIComponent(id)}`,
  );
  return res.data;
}

export async function updateArchitectureMetadata(
  id: string,
  input: UpdateArchitectureMetadataInput,
): Promise<ArchitectureDetailDto> {
  const res = await apiFetch<ApiSuccessResponse<ArchitectureDetailDto>>(
    `/architectures/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

export async function saveArchitectureCanvas(
  id: string,
  input: SaveArchitectureCanvasInput,
): Promise<ArchitectureDetailDto> {
  const res = await apiFetch<ApiSuccessResponse<ArchitectureDetailDto>>(
    `/architectures/${encodeURIComponent(id)}/canvas`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

export async function duplicateArchitecture(id: string): Promise<ArchitectureDetailDto> {
  const res = await apiFetch<ApiSuccessResponse<ArchitectureDetailDto>>(
    `/architectures/${encodeURIComponent(id)}/duplicate`,
    {
      method: 'POST',
    },
  );
  return res.data;
}

export async function deleteArchitecture(id: string): Promise<void> {
  await apiFetch<ApiSuccessResponse<{ deleted: boolean }>>(
    `/architectures/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
}
