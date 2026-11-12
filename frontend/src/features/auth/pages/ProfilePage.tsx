import { ArrowLeft, Calendar, LogOut, Mail, ShieldCheck, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { useAuth } from '../hooks/useAuth';

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border-subtle pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
            Account Profile
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your authenticated CloudForge identity and active browser session.
          </p>
        </div>

        <Link to="/">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Identity Details" description="Persisted in PostgreSQL users table" />
          <div className="p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-16 w-16 rounded-xl border border-border-strong object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-lg font-semibold text-sky-300">
                  {getInitials(user.name) || <User className="h-6 w-6" />}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-100">{user.name}</h2>
                  <Badge variant="success">Authenticated</Badge>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-slate-400">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  <span>{user.email}</span>
                </p>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Member since {memberSince}</span>
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Session Security" description="Cookie & token rotation status" />
          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-border-subtle bg-canvas p-3.5 text-xs">
              <div className="flex items-center gap-2 font-medium text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                <span>HttpOnly Session Active</span>
              </div>
              <p className="mt-1.5 leading-relaxed text-slate-400">
                Access and refresh tokens are stored strictly in HttpOnly cookies with server-side
                refresh rotation and revocation.
              </p>
            </div>

            <Button variant="secondary" onClick={handleLogout} className="w-full text-rose-300 hover:text-rose-200">
              <LogOut className="h-4 w-4" />
              <span>Sign out of CloudForge</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
