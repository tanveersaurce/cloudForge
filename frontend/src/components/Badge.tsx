import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'muted';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-slate-800/80 text-slate-300 border-slate-700/80',
  info: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  muted: 'bg-slate-900/80 text-slate-400 border-slate-800',
};

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-tight',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
