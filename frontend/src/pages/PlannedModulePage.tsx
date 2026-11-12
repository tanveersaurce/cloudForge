import { ArrowLeft, CheckCircle2, Clock, Database, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { StatusIndicator } from '@/components/StatusIndicator';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { SIDEBAR_NAV_ITEMS } from '@/layouts/navConfig';
import type { NavItemId } from '@/types/navigation';

interface PlannedModulePageProps {
  moduleId: Exclude<NavItemId, 'dashboard'>;
}

export function PlannedModulePage({ moduleId }: PlannedModulePageProps) {
  const moduleConfig = SIDEBAR_NAV_ITEMS.find((item) => item.id === moduleId);
  const { status, data, error, refresh } = useBackendHealth();

  if (!moduleConfig) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-center">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
              {moduleConfig.label}
            </h1>
            {moduleConfig.phaseLabel ? (
              <Badge variant="warning">
                <Clock className="h-3 w-3" />
                <span>Scheduled for {moduleConfig.phaseLabel}</span>
              </Badge>
            ) : null}
          </div>
          <p className="max-w-2xl text-sm text-slate-400">{moduleConfig.description}</p>
        </div>

        <Link to="/">
          <Button variant="secondary" size="md">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Planned Module Capabilities"
            description="Outlined in docs/IMPLEMENTATION_PLAN.md — intentionally disabled during Phase 01"
          />
          <div className="divide-y divide-border-subtle">
            {(moduleConfig.plannedCapabilities ?? []).map((capability) => (
              <div key={capability} className="flex items-start gap-3 px-5 py-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                <span className="text-sm text-slate-300">{capability}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="System Connectivity"
            description="Live Phase 01 API & PostgreSQL health"
            action={
              <Button variant="ghost" size="sm" onClick={() => void refresh()}>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Check</span>
              </Button>
            }
          />
          <div className="space-y-3 p-5 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-canvas px-3 py-2.5">
              <span className="flex items-center gap-2 text-slate-400">
                <StatusIndicator status={status} />
                API Server
              </span>
              <span className="font-mono text-slate-200">{data ? data.status : status}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-canvas px-3 py-2.5">
              <span className="flex items-center gap-2 text-slate-400">
                <Database className="h-3.5 w-3.5 text-sky-400" />
                PostgreSQL
              </span>
              <span
                className={
                  data?.database.status === 'connected'
                    ? 'font-mono text-emerald-400'
                    : 'font-mono text-amber-400'
                }
              >
                {data?.database.status ?? 'unavailable'}
              </span>
            </div>
            {data ? (
              <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-canvas px-3 py-2.5">
                <span className="text-slate-400">Query Latency</span>
                <span className="font-mono text-slate-200">{data.database.latencyMs} ms</span>
              </div>
            ) : null}
            {error ? (
              <p className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-rose-300">
                {error}
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
