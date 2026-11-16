import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, AlertCircle, Plus } from 'lucide-react';
import { apiFetch } from '@/services/apiClient';
import type { ApiSuccessResponse } from '@/types/api';
import type { ArchitectureSummaryDto } from '@/features/architecture-builder/types/architecture.types';

interface ArchitectureListItemResponse {
  architectures: ArchitectureSummaryDto[];
}

export function TerraformArchitectureSelector(): React.ReactElement {
  const navigate = useNavigate();
  const [architectures, setArchitectures] = useState<ArchitectureSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadArchitectures = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ApiSuccessResponse<ArchitectureListItemResponse>>(
        '/architectures',
      );
      setArchitectures(data.data.architectures);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load architectures');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchitectures();
  }, [loadArchitectures]);

  const handleSelect = (id: string) => {
    navigate(`/terraform/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md w-full p-6 rounded-xl border border-rose-500/30 bg-rose-950/20 text-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-rose-300">Unable to load architectures</h2>
          <p className="text-xs text-slate-400 mt-2 mb-4">{error}</p>
          <button
            type="button"
            onClick={loadArchitectures}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-500 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="h-14 border-b border-slate-800 bg-slate-950/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/architecture-builder"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Architecture</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-slate-100 mb-1">Select Architecture for Terraform</h1>
            <p className="text-xs text-slate-400">
              Choose an architecture to generate Terraform HCL configuration.
            </p>
          </div>

          {architectures.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-slate-800/50 border border-slate-700/30 flex items-center justify-center text-slate-400">
                <Plus className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-100">No architectures found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Create an architecture first in the builder, then export it to Terraform.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/30">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Architecture Name</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Region</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Resources</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Updated</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {architectures.map((arch) => (
                    <tr
                      key={arch.id}
                      className="hover:bg-slate-800/30 transition group cursor-pointer"
                      onClick={() => handleSelect(arch.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-100">{arch.name}</div>
                        <div className="text-xs text-slate-500">{arch.id}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{arch.region}</td>
                      <td className="px-4 py-3 text-slate-300">{arch.resourceCount}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(arch.updatedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
