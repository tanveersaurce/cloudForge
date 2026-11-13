import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { CostOptimizationRecommendation } from '../types/pricing.types';

interface CostOptimizationSectionProps {
  recommendations: CostOptimizationRecommendation[];
  onApply: (recommendationId: string) => Promise<void>;
}

export const CostOptimizationSection: React.FC<CostOptimizationSectionProps> = ({
  recommendations,
  onApply,
}) => {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);

  const handleApplyClick = async (recId: string) => {
    setApplyingId(recId);
    try {
      await onApply(recId);
      setAppliedIds((prev) => [...prev, recId]);
    } finally {
      setApplyingId(null);
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
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
          {recommendations.length} Available
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3.5">
        {recommendations.map((rec) => {
          const isApplied = appliedIds.includes(rec.recommendationId);
          const isExpanded = expandedId === rec.recommendationId;
          const isApplying = applyingId === rec.recommendationId;

          return (
            <div
              key={rec.recommendationId}
              className={`p-4 rounded-xl border transition-all ${
                isApplied
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
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100">{rec.title}</h4>
                </div>

                <div className="flex items-center gap-2">
                  {isApplied ? (
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
