import { Plus, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { useUiStore } from '@/store/useUiStore';

interface WelcomeHeaderProps {
  userName: string;
}

export function WelcomeHeader({ userName }: WelcomeHeaderProps) {
  const setCreateModalOpen = useUiStore((state) => state.setCreateModalOpen);

  return (
    <section className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-center">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
            Welcome back, {userName}
          </h1>
          <Badge variant="info">Phase 02 Workspace</Badge>
        </div>
        <p className="max-w-2xl text-sm text-slate-400">
          Your authenticated CloudForge workspace. Architecture counts and activity below reflect
          your persisted PostgreSQL records.
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <Button
          variant="primary"
          size="md"
          onClick={() => setCreateModalOpen(true)}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Architecture</span>
        </Button>
      </div>
    </section>
  );
}

export function PhaseNoticeStrip() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-2.5 text-xs text-slate-300">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" />
        <span>
          <strong className="font-medium text-slate-100">Authenticated Session:</strong> Protected
          by HttpOnly cookies. AWS service catalog, React Flow canvas, cost estimation, and
          Terraform generation arrive in Phases 03–06.
        </span>
      </div>
    </div>
  );
}
