import { useCallback, useEffect, useState } from 'react';
import { fetchBackendHealth } from '@/services/healthService';
import type { BackendHealthData } from '@/types/api';

interface BackendHealthState {
  status: 'checking' | 'connected' | 'degraded' | 'offline';
  data: BackendHealthData | null;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBackendHealth(): BackendHealthState {
  const [status, setStatus] = useState<BackendHealthState['status']>('checking');
  const [data, setData] = useState<BackendHealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('checking');
    try {
      const health = await fetchBackendHealth();
      setData(health);
      setError(null);
      setStatus(health.database.status === 'connected' ? 'connected' : 'degraded');
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Unable to reach API');
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, data, error, refresh };
}
