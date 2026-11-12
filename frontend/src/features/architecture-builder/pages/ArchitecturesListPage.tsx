import {
  AlertCircle,
  Boxes,
  Copy,
  Globe,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Waypoints,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CreateArchitectureModal } from '@/features/dashboard/components/CreateArchitectureModal';
import { ApiClientError } from '@/services/apiClient';
import { useUiStore } from '@/store/useUiStore';
import {
  deleteArchitecture,
  duplicateArchitecture,
  listArchitectures,
} from '../services/architectureService';
import type { ArchitectureSummaryDto } from '../types/architecture.types';

export function ArchitecturesListPage() {
  const navigate = useNavigate();
  const setCreateModalOpen = useUiStore((s) => s.setCreateModalOpen);

  const [architectures, setArchitectures] = useState<ArchitectureSummaryDto[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await listArchitectures();
      setArchitectures(items);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Unable to load architectures.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return architectures;
    return architectures.filter(
      (arch) =>
        arch.name.toLowerCase().includes(q) ||
        arch.region.toLowerCase().includes(q) ||
        (arch.description ?? '').toLowerCase().includes(q),
    );
  }, [architectures, search]);

  const handleDuplicate = async (id: string) => {
    setActionError(null);
    setBusyId(id);
    try {
      const copy = await duplicateArchitecture(id);
      setArchitectures((prev) => [copy, ...prev]);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : 'Failed to duplicate.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    setBusyId(id);
    try {
      await deleteArchitecture(id);
      setArchitectures((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : 'Failed to delete.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">
              My Architectures
            </h1>
            <Badge variant="info">Phase 04 Builder</Badge>
            <Badge variant="muted">{architectures.length} Projects</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Create, open, duplicate, and manage persistent AWS cloud architecture canvases.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void loadList()}>
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span>New Architecture</span>
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search architectures by name, region, or description..."
          aria-label="Search architectures"
          className="h-9 w-full rounded-lg border border-border-subtle bg-surface pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
        />
      </div>

      {actionError ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
          {actionError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl border border-border-subtle bg-surface/70"
            />
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto h-7 w-7 text-rose-400" />
          <p className="mt-3 text-sm font-semibold text-slate-100">Unable to load architectures</p>
          <p className="mt-1 text-xs text-slate-400">{error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => void loadList()}>
            Retry
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="rounded-xl border border-border-subtle bg-canvas p-3 text-sky-400">
            <Boxes className="h-6 w-6" />
          </div>
          <h2 className="mt-3 text-sm font-semibold text-slate-100">
            {architectures.length === 0
              ? 'No architecture projects created yet'
              : 'No matching architectures'}
          </h2>
          <p className="mt-1 max-w-md text-xs text-slate-400">
            {architectures.length === 0
              ? 'Create your first AWS architecture project to launch the interactive React Flow canvas.'
              : 'Try adjusting your search query.'}
          </p>
          {architectures.length === 0 ? (
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create First Architecture</span>
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((arch) => (
            <Card key={arch.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={`/architecture-builder/${arch.id}`}
                      className="block truncate font-mono text-sm font-semibold text-slate-100 hover:text-sky-300"
                    >
                      {arch.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-3 w-3 text-slate-500" />
                        {arch.region}
                      </span>
                      <Badge variant="neutral">{arch.status}</Badge>
                    </div>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-xs text-slate-400">
                  {arch.description || 'No description provided'}
                </p>

                <div className="mt-4 flex items-center gap-4 text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-sky-400" />
                    <strong className="text-slate-200">{arch.resourceCount}</strong> nodes
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Waypoints className="h-3.5 w-3.5 text-emerald-400" />
                    <strong className="text-slate-200">{arch.edgeCount}</strong> connections
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/architecture-builder/${arch.id}`)}
                >
                  Open Canvas
                </Button>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === arch.id}
                    aria-label={`Duplicate ${arch.name}`}
                    onClick={() => void handleDuplicate(arch.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === arch.id}
                    aria-label={`Delete ${arch.name}`}
                    className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                    onClick={() => void handleDelete(arch.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateArchitectureModal />
    </div>
  );
}
