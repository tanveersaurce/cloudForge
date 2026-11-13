import { apiFetch } from '@/services/apiClient';
import type { ApiSuccessResponse } from '@/types/api';
import type {
  ValidationEngineResult,
  ValidationRuleMetadata,
} from '../types/validation.types';

export async function validateArchitectureApi(
  architectureId: string,
): Promise<ValidationEngineResult> {
  const res = await apiFetch<ApiSuccessResponse<ValidationEngineResult>>(
    `/architectures/${encodeURIComponent(architectureId)}/validate`,
    {
      method: 'POST',
    },
  );
  return res.data;
}

export async function getValidationResultsApi(
  architectureId: string,
): Promise<ValidationEngineResult> {
  const res = await apiFetch<ApiSuccessResponse<ValidationEngineResult>>(
    `/architectures/${encodeURIComponent(architectureId)}/validation-results`,
  );
  return res.data;
}

export async function listValidationRulesApi(): Promise<ValidationRuleMetadata[]> {
  const res = await apiFetch<ApiSuccessResponse<ValidationRuleMetadata[]>>('/validation/rules');
  return res.data;
}
