import { AlertCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ApiClientError } from '@/services/apiClient';
import { ArchitecturePreviewModal } from '../components/ArchitecturePreviewModal';
import { CreateArchitectureModal } from '../components/CreateArchitectureModal';
import { QuickStartTemplatesSection } from '../components/QuickStartTemplatesSection';
import { RecentActivitySection } from '../components/RecentActivitySection';
import { RecentArchitecturesSection } from '../components/RecentArchitecturesSection';
import { StatCardsRow } from '../components/StatCardsRow';
import { TemplatePreviewModal } from '../components/TemplatePreviewModal';
import { PhaseNoticeStrip, WelcomeHeader } from '../components/WelcomeHeader';
import { fetchDashboardOverview } from '../services/dashboardService';
import type { DashboardOverviewData } from '../types/dashboard.types';

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard">
      <div className="h-16 animate-pulse rounded-xl border border-border-subtle bg-surface/60" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-xl border border-border-subtle bg-surface/60"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="h-72 animate-pulse rounded-xl border border-border-subtle bg-surface/60 xl:col-span-2" />
        <div className="h-72 animate-pulse rounded-xl border border-border-subtle bg-surface/60" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardOverview();
      setOverview(data);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Failed to load dashboard overview from backend';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !overview) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400">
          <AlertCircle className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-100">
          Unable to load dashboard overview
        </h2>
        <p className="mt-1 text-xs text-slate-400">{error || 'Unexpected empty response'}</p>
        <div className="mt-5 flex justify-center">
          <Button variant="primary" onClick={() => void loadDashboard()}>
            <RefreshCw className="h-4 w-4" />
            <span>Retry</span>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <WelcomeHeader userName={overview.user.name || user?.name || 'Architect'} />
      <PhaseNoticeStrip />
      <StatCardsRow metrics={overview.metrics} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <RecentArchitecturesSection architectures={overview.recentArchitectures} />
          <QuickStartTemplatesSection templates={overview.quickStartTemplates} />
        </div>

        <div className="xl:col-span-1">
          <RecentActivitySection activities={overview.recentActivity} />
        </div>
      </div>

      <CreateArchitectureModal />
      <ArchitecturePreviewModal />
      <TemplatePreviewModal />
    </div>
  );
}
