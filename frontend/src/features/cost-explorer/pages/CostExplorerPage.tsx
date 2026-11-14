import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  DollarSign,
  Sliders,
  RefreshCw,
  Globe,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { CostSummaryCards } from '../components/CostSummaryCards';
import { ServiceBreakdownChart } from '../components/ServiceBreakdownChart';
import { ResourceCostTable } from '../components/ResourceCostTable';
import { WorkloadAssumptionsModal } from '../components/WorkloadAssumptionsModal';
import { CostOptimizationSection } from '../components/CostOptimizationSection';
import { calculateClientCost } from '../engine/clientCostCalculator';
import { getArchitectureById } from '@/features/architecture-builder/services/architectureService';
import {
  applyCostOptimizationApi,
  getCostEstimateApi,
  postCostEstimateApi,
  saveCostAssumptionsApi,
} from '../services/costService';
import type { CostEstimationResult, WorkloadAssumptions } from '../types/pricing.types';

export const CostExplorerPage: React.FC = () => {
  const { architectureId } = useParams<{ architectureId: string }>();

  const [estimate, setEstimate] = useState<CostEstimationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAssumptionsModalOpen, setIsAssumptionsModalOpen] = useState(false);

  const loadCostData = useCallback(async () => {
    if (!architectureId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCostEstimateApi(architectureId);
      setEstimate(data);
    } catch {
      // Fallback: load architecture and compute client-side estimate
      try {
        const detail = await getArchitectureById(architectureId);
        const clientEstimate = calculateClientCost(
          architectureId,
          detail.region || 'us-east-1',
          (detail.nodes || []) as any,
          (detail.edges || []) as any,
        );
        setEstimate(clientEstimate);
      } catch (fallbackErr) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : 'Failed to load cost estimation');
      }
    } finally {
      setIsLoading(false);
    }
  }, [architectureId]);

  useEffect(() => {
    void loadCostData();
  }, [loadCostData]);

  const handleSaveAssumptions = async (newAssumptions: WorkloadAssumptions) => {
    if (!architectureId) return;
    setIsLoading(true);
    try {
      try {
        await saveCostAssumptionsApi(architectureId, newAssumptions);
      } catch {
        // Table or network non-blocking fallback
      }
      try {
        const updatedEstimate = await postCostEstimateApi(architectureId, newAssumptions);
        setEstimate(updatedEstimate);
      } catch {
        // Fallback: recompute client-side with new assumptions
        const detail = await getArchitectureById(architectureId);
        const recalculated = calculateClientCost(
          architectureId,
          detail.region || 'us-east-1',
          (detail.nodes || []) as any,
          (detail.edges || []) as any,
          newAssumptions,
        );
        setEstimate(recalculated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workload assumptions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyOptimization = async (recId: string) => {
    if (!architectureId) return;
    try {
      const recalculated = await applyCostOptimizationApi(architectureId, recId);
      setEstimate(recalculated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply optimization');
    }
  };

  if (isLoading && !estimate) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span>Calculating realistic AWS infrastructure costs...</span>
        </div>
      </div>
    );
  }

  if (error && !estimate) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md w-full p-6 rounded-xl border border-rose-500/30 bg-rose-950/20 text-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-rose-300">Cost Calculation Error</h2>
          <p className="text-xs text-slate-400 mt-2 mb-4">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to={`/architecture-builder/${architectureId}`}
              className="px-3 py-1.5 text-xs rounded bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
            >
              Back to Canvas
            </Link>
            <button
              type="button"
              onClick={loadCostData}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-500 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            to={`/architecture-builder/${architectureId}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Builder Canvas</span>
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-indigo-500/10 text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <h1 className="text-sm font-semibold text-slate-100">AWS Cost Explorer & Optimization</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>Region: {estimate?.region || 'us-east-1'}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsAssumptionsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-xs font-medium text-slate-200 hover:bg-slate-800 transition"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Workload Assumptions</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
              {estimate?.assumptions.preset}
            </span>
          </button>

          <button
            type="button"
            onClick={loadCostData}
            title="Refresh pricing estimate"
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {estimate && (
          <>
            {/* KPI Summary Cards */}
            <CostSummaryCards estimate={estimate} />

            {/* Middle Section: Service Distribution Chart & Intelligent Optimizations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <ServiceBreakdownChart
                  breakdown={estimate.serviceBreakdown}
                  totalMonthly={estimate.totalEstimatedMonthly}
                />
              </div>

              <div className="lg:col-span-2">
                <CostOptimizationSection
                  recommendations={estimate.recommendations}
                  onApply={handleApplyOptimization}
                />
              </div>
            </div>

            {/* Bottom Section: Itemized Resource Breakdown Table */}
            <ResourceCostTable items={estimate.resourceItems} />
          </>
        )}
      </main>

      {/* Assumptions Configuration Modal */}
      {estimate && (
        <WorkloadAssumptionsModal
          isOpen={isAssumptionsModalOpen}
          onClose={() => setIsAssumptionsModalOpen(false)}
          currentAssumptions={estimate.assumptions}
          onSave={handleSaveAssumptions}
        />
      )}
    </div>
  );
};
