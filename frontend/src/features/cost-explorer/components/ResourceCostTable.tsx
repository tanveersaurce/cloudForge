import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import type { CostItemEstimate } from '../types/pricing.types';

interface ResourceCostTableProps {
  items: CostItemEstimate[];
}

export const ResourceCostTable: React.FC<ResourceCostTableProps> = ({ items }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-100">Itemized Resource Cost Breakdown</h3>
        </div>
        <span className="text-xs text-slate-400">{items.length} total resources</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Resource</th>
              <th className="py-3 px-4">Service</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4 text-right">Hourly Rate</th>
              <th className="py-3 px-4 text-right">Estimated Monthly</th>
              <th className="py-3 px-4 text-center">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {items.map((item) => {
              const isExpanded = expandedId === item.resourceId;

              return (
                <React.Fragment key={item.resourceId}>
                  <tr
                    onClick={() => toggleExpand(item.resourceId)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-slate-100">
                      {item.resourceName}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{item.serviceCode}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                        {item.resourceType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      ${item.hourlyCost.toFixed(3)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-100">
                      ${item.monthlyCost.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        aria-label="Toggle details"
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-slate-950/40">
                      <td colSpan={6} className="py-3 px-6">
                        <div className="space-y-2">
                          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Billing Dimensions & Formulas
                          </h4>
                          <div className="space-y-1.5">
                            {item.dimensions.map((dim, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs py-1 px-2.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                              >
                                <span>{dim.name}</span>
                                <div className="flex items-center gap-4 font-mono text-[11px]">
                                  <span>
                                    {dim.quantity} {dim.unit} × ${dim.unitPrice}
                                  </span>
                                  <span className="font-semibold text-slate-100">
                                    ${dim.extendedCost.toFixed(2)}/mo
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          {item.warnings.length > 0 && (
                            <div className="text-[11px] text-amber-400 mt-1">
                              {item.warnings.join(', ')}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
