export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  path: string;
}

export type HealthStatus = 'ok' | 'degraded';

export interface HealthCheckResult {
  status: HealthStatus;
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  database: {
    status: 'connected' | 'disconnected';
    latencyMs: number;
    error?: string;
  };
}
