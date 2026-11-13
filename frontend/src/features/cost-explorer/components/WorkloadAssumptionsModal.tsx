import React, { useState } from 'react';
import { Sliders, Check, X } from 'lucide-react';
import type { WorkloadAssumptions, WorkloadPreset } from '../types/pricing.types';

interface WorkloadAssumptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAssumptions: WorkloadAssumptions;
  onSave: (assumptions: WorkloadAssumptions) => void;
}

const PRESET_DESCRIPTIONS: Record<WorkloadPreset, string> = {
  Development: '240 hrs/mo (10h/day for 24 weekdays), low storage and data transfer.',
  'Small Production': '730 hrs/mo (24x7 steady), 100 GB transfer, 50 GB storage (Standard).',
  'Medium Production': '730 hrs/mo (24x7 steady), 500 GB transfer, 500 GB storage, 10M Lambda.',
  'High Traffic': '730 hrs/mo (24x7 steady), 5,000 GB transfer, 5,000 GB storage, 100M Lambda.',
  Custom: 'Custom user-specified operating hours, data volumes, and request counts.',
};

export const WorkloadAssumptionsModal: React.FC<WorkloadAssumptionsModalProps> = ({
  isOpen,
  onClose,
  currentAssumptions,
  onSave,
}) => {
  const [draft, setDraft] = useState<WorkloadAssumptions>({ ...currentAssumptions });

  if (!isOpen) return null;

  const handlePresetSelect = (preset: WorkloadPreset) => {
    if (preset === 'Development') {
      setDraft({
        preset: 'Development',
        monthlyOperatingHours: 240,
        averageCpuUtilization: 20,
        monthlyDataTransferOutGb: 20,
        monthlyS3StorageGb: 10,
        monthlyS3Requests: 5000,
        monthlyNatTrafficGb: 10,
        monthlyLambdaInvocations: 50000,
        averageLambdaDurationMs: 100,
      });
    } else if (preset === 'Small Production') {
      setDraft({
        preset: 'Small Production',
        monthlyOperatingHours: 730,
        averageCpuUtilization: 50,
        monthlyDataTransferOutGb: 100,
        monthlyS3StorageGb: 50,
        monthlyS3Requests: 50000,
        monthlyNatTrafficGb: 50,
        monthlyLambdaInvocations: 1000000,
        averageLambdaDurationMs: 200,
      });
    } else if (preset === 'Medium Production') {
      setDraft({
        preset: 'Medium Production',
        monthlyOperatingHours: 730,
        averageCpuUtilization: 65,
        monthlyDataTransferOutGb: 500,
        monthlyS3StorageGb: 500,
        monthlyS3Requests: 500000,
        monthlyNatTrafficGb: 250,
        monthlyLambdaInvocations: 10000000,
        averageLambdaDurationMs: 250,
      });
    } else if (preset === 'High Traffic') {
      setDraft({
        preset: 'High Traffic',
        monthlyOperatingHours: 730,
        averageCpuUtilization: 80,
        monthlyDataTransferOutGb: 5000,
        monthlyS3StorageGb: 5000,
        monthlyS3Requests: 10000000,
        monthlyNatTrafficGb: 2500,
        monthlyLambdaInvocations: 100000000,
        averageLambdaDurationMs: 350,
      });
    } else {
      setDraft((prev) => ({ ...prev, preset: 'Custom' }));
    }
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-label="Workload Assumptions"
    >
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Workload Assumptions</h2>
              <p className="text-xs text-slate-400">
                Configure usage profiles to calculate realistic infrastructure estimates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assumptions modal"
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Preset Buttons */}
          <div>
            <label className="font-semibold text-slate-200 block mb-2">Preset Profile</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Development', 'Small Production', 'Medium Production', 'High Traffic'] as const).map(
                (p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      draft.preset === p
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/40'
                        : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold">{p}</div>
                  </button>
                ),
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {PRESET_DESCRIPTIONS[draft.preset]}
            </p>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Monthly Operating Hours
              </label>
              <input
                type="number"
                value={draft.monthlyOperatingHours}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    preset: 'Custom',
                    monthlyOperatingHours: Number(e.target.value),
                  })
                }
                min={1}
                max={744}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500">Full month = 730 hours</span>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Average CPU Utilization (%)
              </label>
              <input
                type="number"
                value={draft.averageCpuUtilization}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    preset: 'Custom',
                    averageCpuUtilization: Number(e.target.value),
                  })
                }
                min={5}
                max={100}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Monthly S3 Storage (GB)
              </label>
              <input
                type="number"
                value={draft.monthlyS3StorageGb}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    preset: 'Custom',
                    monthlyS3StorageGb: Number(e.target.value),
                  })
                }
                min={0}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Outbound Data Transfer (GB)
              </label>
              <input
                type="number"
                value={draft.monthlyDataTransferOutGb}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    preset: 'Custom',
                    monthlyDataTransferOutGb: Number(e.target.value),
                  })
                }
                min={0}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500">First 100 GB/mo is free</span>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                NAT Gateway Traffic (GB)
              </label>
              <input
                type="number"
                value={draft.monthlyNatTrafficGb}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    preset: 'Custom',
                    monthlyNatTrafficGb: Number(e.target.value),
                  })
                }
                min={0}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500">Processed at $0.045/GB</span>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Lambda Invocations / mo
              </label>
              <input
                type="number"
                value={draft.monthlyLambdaInvocations}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    preset: 'Custom',
                    monthlyLambdaInvocations: Number(e.target.value),
                  })
                }
                min={0}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition"
          >
            <Check className="w-3.5 h-3.5" />
            Apply Assumptions
          </button>
        </div>
      </div>
    </div>
  );
};
