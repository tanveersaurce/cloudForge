import {
  Bell,
  ChevronDown,
  Database,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  User,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { StatusIndicator } from '@/components/StatusIndicator';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { useUiStore } from '@/store/useUiStore';

type OpenMenu = 'health' | 'notifications' | 'profile' | null;

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function TopNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { status, data, error, refresh } = useBackendHealth();

  const searchQuery = useUiStore((state) => state.searchQuery);
  const setSearchQuery = useUiStore((state) => state.setSearchQuery);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);
  const notifications = useUiStore((state) => state.notifications);
  const markAllNotificationsRead = useUiStore((state) => state.markAllNotificationsRead);

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const navActionsRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navActionsRef.current && !navActionsRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (location.pathname !== '/' && value.trim().length > 0) {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    setOpenMenu(null);
    await logout();
    navigate('/login', { replace: true });
  };

  const healthLabel =
    status === 'connected'
      ? 'API + DB Online'
      : status === 'degraded'
        ? 'API Degraded'
        : status === 'checking'
          ? 'Checking API'
          : 'API Offline';

  const displayName = user?.name ?? 'Architect';
  const displayEmail = user?.email ?? '';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border-subtle bg-surface/95 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex flex-1 items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="rounded-lg border border-border-subtle bg-canvas p-2 text-slate-300 hover:bg-surface-elevated lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search architectures, templates, AWS services..."
            aria-label="Search workspace"
            className="h-9 w-full rounded-lg border border-border-subtle bg-canvas pl-9 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none sm:text-sm"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-100"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div ref={navActionsRef} className="relative flex items-center gap-2 sm:gap-3">
        {/* Live Backend Health Status Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((prev) => (prev === 'health' ? null : 'health'))}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-border-strong hover:text-slate-100 sm:px-3"
          >
            <StatusIndicator status={status} />
            <span className="hidden sm:inline">{healthLabel}</span>
          </button>

          {openMenu === 'health' ? (
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border-strong bg-surface p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-sky-400" />
                  <span className="text-xs font-semibold text-slate-100">Backend Diagnostics</span>
                </div>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-sky-400 hover:bg-surface-elevated"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>

              <div className="mt-3 space-y-2 rounded-lg border border-border-subtle bg-canvas p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">API Service</span>
                  <span className="font-mono text-slate-200">{data?.service ?? 'unreachable'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PostgreSQL</span>
                  <span
                    className={
                      data?.database.status === 'connected' ? 'text-emerald-400' : 'text-amber-400'
                    }
                  >
                    {data?.database.status ?? 'disconnected'}
                  </span>
                </div>
                {data ? (
                  <div className="flex justify-between">
                    <span className="text-slate-400">DB Latency</span>
                    <span className="font-mono text-slate-200">{data.database.latencyMs} ms</span>
                  </div>
                ) : null}
                {error ? <p className="pt-1 text-[11px] text-rose-400">{error}</p> : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setOpenMenu((prev) => (prev === 'notifications' ? null : 'notifications'))
            }
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-canvas text-slate-300 transition-colors hover:border-border-strong hover:text-slate-100"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-sky-400" />
            ) : null}
          </button>

          {openMenu === 'notifications' ? (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border-strong bg-surface shadow-2xl">
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                <span className="text-xs font-semibold text-slate-100">
                  Notifications ({unreadCount} unread)
                </span>
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
                >
                  Mark all read
                </button>
              </div>
              <div className="divide-y divide-border-subtle">
                {notifications.map((notif) => (
                  <div key={notif.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-200">{notif.title}</span>
                      {!notif.read ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      {notif.message}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-slate-500">{notif.timestamp}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((prev) => (prev === 'profile' ? null : 'profile'))}
            aria-label="User profile menu"
            aria-expanded={openMenu === 'profile'}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs text-slate-200 transition-colors hover:border-border-strong"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={displayName}
                className="h-6 w-6 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/15 text-[11px] font-semibold text-sky-300">
                {getInitials(displayName) || <User className="h-3.5 w-3.5" />}
              </div>
            )}
            <span className="hidden max-w-[140px] truncate font-medium md:inline">
              {displayName}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {openMenu === 'profile' ? (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border-strong bg-surface p-2 shadow-2xl">
              <div className="border-b border-border-subtle px-3 py-2.5">
                <p className="truncate text-xs font-semibold text-slate-100">{displayName}</p>
                {displayEmail ? (
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{displayEmail}</p>
                ) : null}
              </div>

              <div className="space-y-0.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    navigate('/profile');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-surface-elevated hover:text-slate-100"
                >
                  <User className="h-3.5 w-3.5" />
                  Profile
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    navigate('/settings');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-surface-elevated hover:text-slate-100"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </button>

                <div className="my-1 border-t border-border-subtle" />

                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
