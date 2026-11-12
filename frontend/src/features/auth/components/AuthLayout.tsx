import { FolderGit2, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/Badge';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-canvas px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/15 text-sky-400">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-slate-100">CloudForge</span>
            <Badge variant="info">Phase 02</Badge>
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-100">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface p-6 shadow-2xl sm:p-7">
          {children}
        </div>

        <div className="space-y-3 text-center">
          <div className="text-sm text-slate-400">{footer}</div>
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Protected by HttpOnly cookie sessions &amp; rotating refresh tokens</span>
          </div>
        </div>
      </div>
    </div>
  );
}
