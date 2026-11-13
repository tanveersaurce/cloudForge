import { apiFetch } from '@/services/apiClient';
import type { ApiSuccessResponse } from '@/types/api';
import type {
  CostEstimationResult,
  WorkloadAssumptions,
} from '../types/pricing.types';

export async function getCostEstimateApi(
  architectureId: string,
): Promise<CostEstimationResult> {
  const res = await apiFetch<ApiSuccessResponse<CostEstimationResult>>(
    `/architectures/${encodeURIComponent(architectureId)}/cost-estimate`,
  );
  return res.data;
}

export async function postCostEstimateApi(
  architectureId: string,
  assumptions?: Partial<WorkloadAssumptions>,
): Promise<CostEstimationResult> {
  const res = await apiFetch<ApiSuccessResponse<CostEstimationResult>>(
    `/architectures/${encodeURIComponent(architectureId)}/cost-estimate`,
    {
      method: 'POST',
      body: JSON.stringify({ assumptions }),
    },
  );
  return res.data;
}

export async function getCostAssumptionsApi(
  architectureId: string,
): Promise<WorkloadAssumptions> {
  const res = await apiFetch<ApiSuccessResponse<WorkloadAssumptions>>(
    `/architectures/${encodeURIComponent(architectureId)}/cost-assumptions`,
  );
  return res.data;
}

export async function saveCostAssumptionsApi(
  architectureId: string,
  patch: Partial<WorkloadAssumptions>,
): Promise<WorkloadAssumptions> {
  const res = await apiFetch<ApiSuccessResponse<WorkloadAssumptions>>(
    `/architectures/${encodeURIComponent(architectureId)}/cost-assumptions`,
    {
      method: 'POST',
      body: JSON.stringify(patch),
    },
  );
  return res.data;
}

export async function applyCostOptimizationApi(
  architectureId: string,
  recommendationId: string,
): Promise<CostEstimationResult> {
  const res = await apiFetch<ApiSuccessResponse<CostEstimationResult>>(
    `/architectures/${encodeURIComponent(architectureId)}/cost-optimizations/${encodeURIComponent(recommendationId)}/apply`,
    {
      method: 'POST',
    },
  );
  return res.data;
}
