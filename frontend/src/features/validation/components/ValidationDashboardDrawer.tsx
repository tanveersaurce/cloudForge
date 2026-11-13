import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Filter,
  HelpCircle,
  Info,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  ValidationCategory,
  ValidationSeverity,
} from '../types/validation.types';
import { useArchitectureBuilderStore } from '@/store/useArchitectureBuilderStore';

interface ValidationDashboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ValidationDashboardDrawer: React.FC<ValidationDashboardDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    validationResult,
    isValidating,
    runValidation,
    highlightFinding,
    clearValidationHighlights,
    highlightedValidationNodeIds,
  } = useArchitectureBuilderStore();

  const [selectedSeverity, setSelectedSeverity] = useState<ValidationSeverity | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<ValidationCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const summary = validationResult?.summary;
  const allFindings = validationResult?.findings || [];

  const filteredFindings = allFindings.filter((finding) => {
    if (selectedSeverity !== 'all' && finding.severity !== selectedSeverity) return false;
    if (selectedCategory !== 'all' && finding.category !== selectedCategory) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTitle = finding.ruleTitle.toLowerCase().includes(q);
      const matchMsg = finding.message.toLowerCase().includes(q);
      const matchId = finding.ruleId.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg && !matchId) return false;
    }
    return true;
  });

  const getStatusBadge = () => {
    if (!summary) return null;
    if (summary.status === 'valid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <ShieldCheck className="w-3.5 h-3.5" />
          VALID ARCHITECTURE
        </span>
      );
    }
    if (summary.status === 'invalid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <ShieldAlert className="w-3.5 h-3.5" />
          ISSUES DETECTED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <HelpCircle className="w-3.5 h-3.5" />
        CONFIG UNKNOWN
      </span>
    );
  };

  const getSeverityBadge = (sev: ValidationSeverity) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <AlertCircle className="w-3 h-3" />
            Critical
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/40">
            <AlertTriangle className="w-3 h-3" />
            High
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <AlertTriangle className="w-3 h-3" />
            Medium
          </span>
        );
      case 'low':
      case 'info':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40">
            <Info className="w-3 h-3" />
            {sev}
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-[540px] max-w-[90vw] bg-slate-900/98 backdrop-blur-md border-l border-slate-800 shadow-2xl flex flex-col text-slate-200 transition-all duration-300 ease-in-out"
      role="dialog"
      aria-label="Validation Dashboard"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/70">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-100 text-base">AWS Architecture Validation</h2>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-slate-400">
              Structural, Security, Network & Reliability Compliance Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runValidation()}
            disabled={isValidating}
            aria-label="Re-run validation"
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50"
            title="Re-run validation"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close validation drawer"
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-5 gap-2 p-4 border-b border-slate-800/80 bg-slate-950/30">
        <div
          onClick={() => setSelectedSeverity(selectedSeverity === 'critical' ? 'all' : 'critical')}
          className={`cursor-pointer p-2.5 rounded-lg border text-center transition-all ${
            selectedSeverity === 'critical'
              ? 'bg-rose-500/20 border-rose-500/60 ring-1 ring-rose-500/40'
              : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-lg font-bold text-rose-400">{summary?.criticalCount ?? 0}</div>
          <div className="text-[10px] uppercase font-semibold text-rose-300/80">Critical</div>
        </div>

        <div
          onClick={() => setSelectedSeverity(selectedSeverity === 'high' ? 'all' : 'high')}
          className={`cursor-pointer p-2.5 rounded-lg border text-center transition-all ${
            selectedSeverity === 'high'
              ? 'bg-orange-500/20 border-orange-500/60 ring-1 ring-orange-500/40'
              : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-lg font-bold text-orange-400">{summary?.highCount ?? 0}</div>
          <div className="text-[10px] uppercase font-semibold text-orange-300/80">High</div>
        </div>

        <div
          onClick={() => setSelectedSeverity(selectedSeverity === 'medium' ? 'all' : 'medium')}
          className={`cursor-pointer p-2.5 rounded-lg border text-center transition-all ${
            selectedSeverity === 'medium'
              ? 'bg-amber-500/20 border-amber-500/60 ring-1 ring-amber-500/40'
              : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-lg font-bold text-amber-400">{summary?.mediumCount ?? 0}</div>
          <div className="text-[10px] uppercase font-semibold text-amber-300/80">Medium</div>
        </div>

        <div
          onClick={() => setSelectedSeverity(selectedSeverity === 'low' ? 'all' : 'low')}
          className={`cursor-pointer p-2.5 rounded-lg border text-center transition-all ${
            selectedSeverity === 'low'
              ? 'bg-sky-500/20 border-sky-500/60 ring-1 ring-sky-500/40'
              : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-lg font-bold text-sky-400">
            {(summary?.lowCount ?? 0) + (summary?.infoCount ?? 0)}
          </div>
          <div className="text-[10px] uppercase font-semibold text-sky-300/80">Low/Info</div>
        </div>

        <div
          onClick={() => setSelectedSeverity('all')}
          className="p-2.5 rounded-lg border bg-slate-800/40 border-slate-800 text-center"
        >
          <div className="text-lg font-bold text-emerald-400">{summary?.passedRulesCount ?? 0}</div>
          <div className="text-[10px] uppercase font-semibold text-emerald-300/80">Passed</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search findings by rule or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-800/60 border border-slate-700/60 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-1 scrollbar-none">
          <span className="text-slate-400 flex items-center gap-1 font-medium pr-1">
            <Filter className="w-3 h-3" /> Category:
          </span>
          {(['all', 'structural', 'network', 'security', 'reliability'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full font-medium capitalize whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Active Highlights Bar */}
      {highlightedValidationNodeIds.length > 0 && (
        <div className="px-4 py-2 bg-indigo-950/40 border-b border-indigo-900/40 flex items-center justify-between text-xs text-indigo-300">
          <span>Highlighting {highlightedValidationNodeIds.length} node(s) on canvas</span>
          <button
            type="button"
            onClick={clearValidationHighlights}
            className="text-xs text-indigo-400 hover:underline hover:text-indigo-200"
          >
            Clear highlights
          </button>
        </div>
      )}

      {/* Findings List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {filteredFindings.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              No Validation Issues Found
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Your architecture satisfies all active structural, network, security, and reliability rules.
            </p>
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const isHighlighted = finding.affectedNodeIds.some((id) =>
              highlightedValidationNodeIds.includes(id),
            );

            return (
              <div
                key={finding.id}
                className={`p-3.5 rounded-lg border transition-all ${
                  isHighlighted
                    ? 'bg-slate-800/90 border-indigo-500 ring-1 ring-indigo-500/40'
                    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(finding.severity)}
                    <span className="text-[11px] font-mono text-slate-400 uppercase">
                      {finding.ruleId}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 capitalize">
                      {finding.category}
                    </span>
                  </div>
                </div>

                <h4 className="text-xs font-semibold text-slate-100 mb-1">
                  {finding.ruleTitle}
                </h4>

                <p className="text-xs text-slate-300 leading-relaxed mb-2">
                  {finding.message}
                </p>

                {finding.remediation && (
                  <div className="p-2.5 mb-2.5 rounded bg-slate-900/70 border border-slate-700/50 text-[11px] text-slate-300">
                    <span className="font-semibold text-emerald-400 block mb-0.5">
                      Recommended Remediation:
                    </span>
                    {finding.remediation}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-xs">
                  {finding.affectedNodeIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => highlightFinding(finding)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                    >
                      <span>Highlight on canvas</span> ({finding.affectedNodeIds.length})
                    </button>
                  )}

                  {finding.documentationUrl && (
                    <a
                      href={finding.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 ml-auto"
                    >
                      <span>AWS Docs</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
