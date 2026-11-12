import { Activity, Boxes, Clock, CloudCog, Terminal } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Card, CardHeader } from '@/components/Card';
import type { DashboardActivityEntry } from '../types/dashboard.types';

interface RecentActivitySectionProps {
  activities: DashboardActivityEntry[];
}

export function RecentActivitySection({ activities }: RecentActivitySectionProps) {
  return (
    <Card className="h-full">
      <CardHeader
        title="Recent Activity"
        description="Real workspace events from your account"
        action={
          <Badge variant="muted">
            <Activity className="h-3 w-3" />
            <span>Live Feed</span>
          </Badge>
        }
      />

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="rounded-lg border border-border-subtle bg-canvas p-2.5 text-slate-400">
            <Clock className="h-5 w-5" />
          </div>
          <p className="mt-3 text-xs font-medium text-slate-200">No workspace activity yet</p>
          <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-slate-400">
            Activity entries will appear automatically as you create and update architectures in
            upcoming phases.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle">
          {activities.map((item) => {
            const Icon =
              item.type === 'architecture'
                ? Boxes
                : item.type === 'service'
                  ? CloudCog
                  : Terminal;
            const formattedTime = new Date(item.timestamp).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="mt-0.5 rounded-md border border-sky-500/20 bg-sky-500/10 p-1.5 text-sky-400">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-xs font-medium text-slate-200">{item.title}</p>
                  <p className="text-[11px] leading-relaxed text-slate-400">{item.detail}</p>
                  <p className="pt-0.5 font-mono text-[10px] text-slate-500">{formattedTime}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
