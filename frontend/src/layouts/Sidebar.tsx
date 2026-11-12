import {
  Boxes,
  Cloud,
  Code2,
  Coins,
  FolderGit2,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Settings,
  Workflow,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useUiStore } from '@/store/useUiStore';
import type { NavItemId } from '@/types/navigation';
import { cn } from '@/utils/cn';
import { SIDEBAR_NAV_ITEMS } from './navConfig';

const NAV_ICONS: Record<NavItemId, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  builder: Workflow,
  'aws-services': Cloud,
  architectures: Boxes,
  'cost-explorer': Coins,
  terraform: Code2,
  deployments: Rocket,
  settings: Settings,
};

function CloudForgeLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/15 text-sky-400">
        <FolderGit2 className="h-4 w-4" />
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold tracking-tight text-slate-100">CloudForge</span>
            <span className="rounded border border-border-subtle bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
              v0.1
            </span>
          </div>
          <p className="truncate text-[11px] text-slate-500">AWS IaC Platform</p>
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen);
  const toggleSidebarCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

  return (
    <>
      {mobileNavOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border-subtle bg-surface transition-all duration-200 lg:static',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64',
          mobileNavOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border-subtle px-4">
          <NavLink
            to="/"
            onClick={() => setMobileNavOpen(false)}
            className="focus:outline-none"
          >
            <CloudForgeLogo collapsed={collapsed} />
          </NavLink>

          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-surface-elevated hover:text-slate-100 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className="hidden rounded-md p-1.5 text-slate-400 transition-colors hover:bg-surface-elevated hover:text-slate-100 lg:inline-flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Primary navigation">
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const Icon = NAV_ICONS[item.id];

            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileNavOpen(false)}
                title={collapsed ? `${item.label}${item.phaseLabel ? ` (${item.phaseLabel})` : ''}` : undefined}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                      : 'text-slate-400 border border-transparent hover:bg-surface-elevated hover:text-slate-100',
                    collapsed && 'lg:justify-center lg:px-2',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200',
                        )}
                      />
                      {!collapsed ? <span className="truncate font-medium">{item.label}</span> : null}
                    </div>

                    {!collapsed && item.phaseLabel ? (
                      <span className="shrink-0 rounded border border-border-subtle bg-canvas/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                        {item.phaseLabel}
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-border-subtle p-3">
          {!collapsed ? (
            <div className="rounded-lg border border-border-subtle bg-canvas/70 p-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-200">
                <span>Phase 03 Active</span>
                <span className="font-mono text-[10px] text-emerald-400">AWS</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                AWS Services Explorer active. Architecture Builder launches in Phase 04.
              </p>
            </div>
          ) : (
            <div
              className="flex justify-center py-1 font-mono text-[10px] text-slate-500"
              title="Phase 03 AWS Services Explorer"
            >
              P03
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
