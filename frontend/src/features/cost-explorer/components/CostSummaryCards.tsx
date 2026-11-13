import React from 'react';
import { DollarSign, Clock, Calendar, Sparkles, TrendingDown } from 'lucide-react';
import type { CostEstimationResult } from '../types/pricing.types';

interface CostSummaryCardsProps {
  estimate: CostEstimationResult;
}

export const CostSummaryCards: React.FC<CostSummaryCardsProps> = ({ estimate }) => {
  const optimizedMonthly = Math.max(
    0,
    Math.round((estimate.totalEstimatedMonthly - estimate.potentialMonthlySavings) * 100) / 100,
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Monthly Cost */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Estimated Monthly</span>
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-100">
          ${estimate.totalEstimatedMonthly.toFixed(2)}
        </div>
        <div className="text-xs text-slate-400 mt-1">
          Based on {estimate.assumptions.monthlyOperatingHours} operating hrs/mo
        </div>
      </div>

      {/* Hourly Cost */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Estimated Hourly</span>
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-100">
          ${estimate.totalEstimatedHourly.toFixed(3)}
        </div>
        <div className="text-xs text-slate-400 mt-1">
          Approx ${(estimate.totalEstimatedHourly * 24).toFixed(2)}/day
        </div>
      </div>

      {/* Potential Monthly Savings */}
      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur">
        <div className="flex items-center justify-between text-emerald-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Potential Savings</span>
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-emerald-400">
          ${estimate.potentialMonthlySavings.toFixed(2)}
          <span className="text-xs font-medium text-emerald-300 ml-1.5">/ mo</span>
        </div>
        <div className="text-xs text-emerald-300/80 mt-1">
          {estimate.recommendations.length} optimization opportunities detected
        </div>
      </div>

      {/* Optimized Projected Cost */}
      <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 backdrop-blur">
        <div className="flex items-center justify-between text-indigo-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Optimized Target</span>
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-indigo-300">
          ${optimizedMonthly.toFixed(2)}
          <span className="text-xs font-medium text-indigo-400 ml-1.5">/ mo</span>
        </div>
        <div className="text-xs text-indigo-400/80 mt-1 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Annualized: ${(optimizedMonthly * 12).toFixed(2)}/yr
        </div>
      </div>
    </div>
  );
};
