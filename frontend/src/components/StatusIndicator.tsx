import { cn } from '@/utils/cn';

interface StatusIndicatorProps {
  status: 'checking' | 'connected' | 'degraded' | 'offline';
}

const DOT_STYLES: Record<StatusIndicatorProps['status'], string> = {
  checking: 'bg-slate-400 animate-pulse',
  connected: 'bg-emerald-400',
  degraded: 'bg-amber-400',
  offline: 'bg-rose-400',
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  return <span className={cn('inline-block h-2 w-2 rounded-full', DOT_STYLES[status])} />;
}
