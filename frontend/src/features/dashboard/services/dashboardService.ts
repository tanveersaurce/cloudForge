import { apiFetch } from '@/services/apiClient';
import type { ApiSuccessResponse } from '@/types/api';
import type { DashboardOverviewData } from '../types/dashboard.types';

export async function fetchDashboardOverview(): Promise<DashboardOverviewData> {
  const res = await apiFetch<ApiSuccessResponse<DashboardOverviewData>>('/dashboard/overview');
  return res.data;
}
