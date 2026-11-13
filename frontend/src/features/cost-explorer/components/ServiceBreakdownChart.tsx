import React from 'react';
import type { ServiceCostSummary } from '../types/pricing.types';

interface ServiceBreakdownChartProps {
  breakdown: ServiceCostSummary[];
  totalMonthly: number;
}

const SERVICE_COLORS = [
  'bg-indigo-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-cyan-500',
];

export const ServiceBreakdownChart: React.FC<ServiceBreakdownChartProps> = ({
  breakdown,
  totalMonthly,
}) => {
  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Service-Wise Cost Distribution</h3>
          <p className="text-xs text-slate-400">Monthly estimated spend by AWS service category</p>
        </div>
        <span className="text-xs font-mono text-slate-400">Total: ${totalMonthly.toFixed(2)}/mo</span>
      </div>

      {/* Multi-segmented progress bar */}
      <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden flex mb-5">
        {breakdown.map((item, index) => (
          <div
            key={item.serviceCode}
            style={{ width: `${Math.max(item.percentage, 1)}%` }}
            className={`h-full ${SERVICE_COLORS[index % SERVICE_COLORS.length]}`}
            title={`${item.serviceName}: $${item.monthlyCost.toFixed(2)} (${item.percentage}%)`}
          />
        ))}
      </div>

      {/* Service list items */}
      <div className="space-y-3">
        {breakdown.map((item, index) => (
          <div key={item.serviceCode} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  SERVICE_COLORS[index % SERVICE_COLORS.length]
                }`}
              />
              <span className="font-medium text-slate-200 truncate">{item.serviceName}</span>
              <span className="text-slate-500 text-[11px]">({item.resourceCount} resource{item.resourceCount !== 1 ? 's' : ''})</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-slate-100">${item.monthlyCost.toFixed(2)}/mo</span>
              <span className="w-12 text-right font-mono text-slate-400 text-[11px]">
                {item.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
