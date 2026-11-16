import { apiFetch } from '@/services/apiClient';
import type { ApiSuccessResponse } from '@/types/api';

export interface TerraformFile {
  filename: string;
  content: string;
}

export interface TerraformGenerateResponse {
  files: TerraformFile[];
  hcl: string;
  totalFiles: number;
}

export async function generateTerraformApi(
  architectureId: string,
): Promise<TerraformGenerateResponse> {
  const res = await apiFetch<ApiSuccessResponse<TerraformGenerateResponse>>(
    `/architectures/${encodeURIComponent(architectureId)}/terraform`,
    {
      method: 'POST',
    },
  );
  return res.data;
}
