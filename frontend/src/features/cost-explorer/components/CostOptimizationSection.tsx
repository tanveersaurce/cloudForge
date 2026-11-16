import React, { useState } from 'react';
import {
  ArrowRight,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Minus,
  Shield,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { CostOptimizationRecommendation } from '../types/pricing.types';

interface CostOptimizationSectionProps {
  recommendations: CostOptimizationRecommendation[];
  onApply: (recommendationId: string) => Promise<void>;
  onApplyAll?: () => Promise<{
    applied: string[];
    skipped: string[];
    partialTargets: string[];
    conflicting: Array<{
      recommendationId: string;
      title: string;
      reason: string;
      conflictingWith: string[];
    }>;
    failed: string[];
    recalculationFailed: boolean;
  }>;
}

export const CostOptimizationSection: React.FC<CostOptimizationSectionProps> = ({
  recommendations,
  onApply,
  onApplyAll,
}) => {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [applyAllResult, setApplyAllResult] = useState<{
    applied: string[];
    skipped: string[];
    partialTargets: string[];
    conflicting: Array<{
      recommendationId: string;
      title: string;
      reason: string;
      conflictingWith: string[];
    }>;
    failed: string[];
    recalculationFailed: boolean;
  } | null>(null);

  const handleApplyClick = async (recId: string) => {
    setApplyingId(recId);
    try {
      await onApply(recId);
      setAppliedIds((prev) => [...prev, recId]);
    } finally {
      setApplyingId(null);
    }
  };

  const handleApplyAllClick = async () => {
    setApplyingAll(true);
    setApplyAllResult(null);
    try {
      const result = await onApplyAll?.();
      if (result) {
        // Deduplicate and only mark recommendations the backend actually applied.
        // Partial targets are NOT applied — they are shown separately.
        const next = [...new Set([...appliedIds, ...result.applied])];
        setAppliedIds(next);
        setApplyAllResult(result);
      }
    } finally {
      setApplyingAll(false);
    }
  };

  if (recommendations.length === 0) {
    return (
      <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <CheckCircle className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-semibold text-slate-100">Architecture is Fully Cost-Optimized</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          No immediate rightsizing, Graviton, or networking optimizations were identified.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Intelligent Cost Optimization Recommendations
            </h3>
            <p className="text-xs text-slate-400">
              Actionable architecture modifications to reduce monthly AWS expenditure
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onApplyAll && (
            <button
              type="button"
              disabled={applyingAll}
              onClick={handleApplyAllClick}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applyingAll ? (
                <>
                  <ArrowRight className="w-3 h-3 animate-spin" />
                  <span>Applying All...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" />
                  <span>Apply All ({recommendations.length})</span>
                </>
              )}
            </button>
          )}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            {recommendations.length} Available
          </span>
        </div>
      </div>

      {applyAllResult && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-[10px] uppercase font-bold text-emerald-300 mb-1">Applied</div>
            <div className="text-sm font-semibold text-slate-100">{applyAllResult.applied.length}</div>
          </div>
          <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
            <div className="text-[10px] uppercase font-bold text-amber-300 mb-1">Skipped</div>
            <div className="text-sm font-semibold text-slate-100">{applyAllResult.skipped.length}</div>
          </div>
          <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20">
            <div className="text-[10px] uppercase font-bold text-rose-300 mb-1">Conflicting</div>
            <div className="text-sm font-semibold text-slate-100">{applyAllResult.conflicting.length}</div>
          </div>
          <div className="p-3 rounded-md bg-slate-500/10 border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Failed</div>
            <div className="text-sm font-semibold text-slate-100">{applyAllResult.failed.length}</div>
          </div>
          <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
            <div className="text-[10px] uppercase font-bold text-yellow-300 mb-1">Partial Targets</div>
            <div className="text-sm font-semibold text-slate-100">{applyAllResult.partialTargets.length}</div>
          </div>
        </div>
      )}

      {applyAllResult && (
        <div className="mt-4">
          {applyAllResult.conflicting.length > 0 && (
            <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h4 className="text-sm font-semibold text-rose-300">Conflicting Recommendations</h4>
              </div>
              <ul className="text-xs text-slate-300 space-y-1">
                {applyAllResult.conflicting.map((c) => (
                  <li key={c.recommendationId} className="flex items-center gap-2">
                    <span className="text-rose-400">{c.title}</span>
                    <span className="text-slate-500">— {c.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {applyAllResult.skipped.length > 0 && (
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Minus className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-semibold text-amber-300">Skipped Recommendations</h4>
              </div>
              <ul className="text-xs text-slate-300 space-y-1">
                {applyAllResult.skipped.map((id) => {
                  const rec = recommendations.find((r) => r.recommendationId === id);
                  return (
                    <li key={id} className="text-amber-300">
                      {rec?.title || id}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {applyAllResult.failed.length > 0 && (
            <div className="p-3 rounded-md bg-slate-500/10 border border-slate-700/60">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-slate-400" />
                <h4 className="text-sm font-semibold text-slate-300">Failed Recommendations</h4>
              </div>
              <ul className="text-xs text-slate-300 space-y-1">
                {applyAllResult.failed.map((id) => {
                  const rec = recommendations.find((r) => r.recommendationId === id);
                  return (
                    <li key={id} className="text-slate-400">
                      {rec?.title || id}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {applyAllResult.partialTargets.length > 0 && (
            <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Minus className="w-4 h-4 text-yellow-400" />
                <h4 className="text-sm font-semibold text-yellow-300">Partial Target Recommendations</h4>
              </div>
              <p className="text-xs text-slate-300 mb-2">
                These recommendations target resources that partially exist. No changes were applied to any resource for these.
              </p>
              <ul className="text-xs text-slate-300 space-y-1">
                {applyAllResult.partialTargets.map((id) => {
                  const rec = recommendations.find((r) => r.recommendationId === id);
                  return (
                    <li key={id} className="text-yellow-300 flex items-center gap-2">
                      <Minus className="w-3 h-3 text-yellow-400" />
                      <span>{rec?.title || id}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {applyAllResult.recalculationFailed && (
            <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <h4 className="text-sm font-semibold text-rose-300">Cost Recalculation Failed</h4>
              </div>
              <p className="text-xs text-rose-300">
                Database updates were applied, but the optimized cost could not be recalculated. Please retry.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5">
        {recommendations.map((rec) => {
          const isApplied = appliedIds.includes(rec.recommendationId);
          const isExpanded = expandedId === rec.recommendationId;
          const isApplying = applyingId === rec.recommendationId;

          // Per-recommendation apply-all status
          const applyAllStatus =
            applyAllResult?.conflicting.find((c) => c.recommendationId === rec.recommendationId)
              ? 'conflicting'
              : applyAllResult?.partialTargets.includes(rec.recommendationId)
                ? 'partial'
                : applyAllResult?.skipped.includes(rec.recommendationId)
                  ? 'skipped'
                  : applyAllResult?.failed.includes(rec.recommendationId)
                    ? 'failed'
                    : null;

          // A recommendation previously marked Applied (via individual apply or
          // a prior Apply All) must not show as Applied if the latest Apply All
          // classified it as partial/conflicting/skipped/failed.
          const isEffectivelyApplied = isApplied && applyAllStatus === null;

          const statusConfig = {
            applied: { label: 'Applied', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: <CheckCircle className="w-3.5 h-3.5" /> },
            partial: { label: 'Partial Targets', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: <Minus className="w-3.5 h-3.5" /> },
            conflicting: { label: 'Conflicting', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
            skipped: { label: 'Skipped', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: <Minus className="w-3.5 h-3.5" /> },
            failed: { label: 'Failed', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-700/60', icon: <AlertCircle className="w-3.5 h-3.5" /> },
          } as const;

          const status = applyAllStatus ?? (isApplied ? 'applied' : null);

          return (
            <div
              key={rec.recommendationId}
              className={`p-4 rounded-xl border transition-all ${
                isEffectivelyApplied
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Save ${rec.estimatedMonthlySavings.toFixed(2)}/mo
                    </span>
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                      {rec.category}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">
                      {rec.savingsPercentage}% Reduction
                    </span>
                    {status && (
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${statusConfig[status].border} ${statusConfig[status].bg} ${statusConfig[status].color}`}
                      >
                        {statusConfig[status].icon} {statusConfig[status].label}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100">{rec.title}</h4>
                </div>

                <div className="flex items-center gap-2">
                  {isEffectivelyApplied ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Applied
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApplyClick(rec.recommendationId)}
                      disabled={isApplying}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition disabled:opacity-50"
                    >
                      {isApplying ? 'Applying...' : 'Apply Optimization'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : rec.recommendationId)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                    title="Toggle details"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Summary Description */}
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">{rec.explanation}</p>

              {/* Before & After Diff Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800 text-xs">
                <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1">
                    Current Configuration
                  </div>
                  <div className="font-mono text-slate-200">
                    {Object.entries(rec.currentConfiguration).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-slate-400">{k}:</span> {String(v)}
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1.5">
                    Est. Cost: <span className="font-semibold text-slate-200">${rec.estimatedCurrentCost.toFixed(2)}/mo</span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-500/30">
                  <div className="text-[10px] uppercase font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" /> Proposed Configuration
                  </div>
                  <div className="font-mono text-emerald-200">
                    {Object.entries(rec.proposedConfiguration).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-emerald-400">{k}:</span> {String(v)}
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-emerald-300/80 mt-1.5">
                    Est. Cost: <span className="font-semibold text-emerald-200">${rec.estimatedOptimizedCost.toFixed(2)}/mo</span>
                  </div>
                </div>
              </div>

              {/* Expandable Details: Impact Indicators & Documentation */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-800 text-xs space-y-2">
                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Performance:{' '}
                      <strong className="capitalize text-slate-100">{rec.performanceImpact}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Shield className="w-3.5 h-3.5 text-indigo-400" />
                      Security:{' '}
                      <strong className="capitalize text-slate-100">{rec.securityImpact}</strong>
                    </span>
                    <span className="text-slate-400">
                      Confidence:{' '}
                      <strong className="capitalize text-slate-200">{rec.confidenceLevel}</strong>
                    </span>
                  </div>

                  {rec.requiredAssumptions.length > 0 && (
                    <div className="text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">Assumptions: </span>
                      {rec.requiredAssumptions.join(' ')}
                    </div>
                  )}

                  {rec.documentationReferences.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 text-[11px]">
                      {rec.documentationReferences.map((ref, idx) => (
                        <a
                          key={idx}
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                          <span>{ref.title}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
