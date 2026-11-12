import type { ApiSuccessResponse, BackendHealthData } from '@/types/api';
import { apiFetch } from './apiClient';

export async function fetchBackendHealth(): Promise<BackendHealthData> {
  const response = await apiFetch<ApiSuccessResponse<BackendHealthData>>('/health');
  return response.data;
}
