import { apiFetch } from '@/services/apiClient';
import type { ApiSuccessResponse } from '@/types/api';

export type TerraformExportMode = 'standard' | 'modular';

export interface TerraformFile {
  filename: string;
  content: string;
}

export interface TerraformIssue {
  nodeId: string;
  resourceType: string;
  missing: string;
  severity: 'error' | 'warning';
}

export interface TerraformGenerateResponse {
  files: TerraformFile[];
  hcl: string;
  totalFiles: number;
  mode: TerraformExportMode;
  issues: TerraformIssue[];
}

export async function generateTerraformApi(
  architectureId: string,
  mode: TerraformExportMode = 'standard',
): Promise<TerraformGenerateResponse> {
  const res = await apiFetch<ApiSuccessResponse<TerraformGenerateResponse>>(
    `/architectures/${encodeURIComponent(architectureId)}/terraform`,
    {
      method: 'POST',
      body: JSON.stringify({ mode }),
    },
  );
  return res.data;
}
