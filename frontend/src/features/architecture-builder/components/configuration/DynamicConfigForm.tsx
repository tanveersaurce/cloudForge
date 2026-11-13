import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Save,
} from 'lucide-react';
import type {
  ArchitectureFlowEdge,
  ArchitectureFlowNode,
} from '../../types/architecture.types';
import type {
  ResourceConfigurationSchema,
} from '../../types/configuration.types';
import {
  initializeDefaultConfiguration,
  isFieldVisible,
} from '../../utils/configurationSchemaRegistry';
import { validateNodeConfiguration } from '../../utils/configurationValidation';
import { ConfigFieldRenderer } from './ConfigFieldRenderer';
import { cn } from '@/utils/cn';

export interface DynamicConfigFormProps {
  node: ArchitectureFlowNode;
  schema: ResourceConfigurationSchema;
  canvasNodes: ArchitectureFlowNode[];
  canvasEdges: ArchitectureFlowEdge[];
  onSave: (metadata: Record<string, unknown>) => void;
  onReset?: () => void;
  className?: string;
}

export function DynamicConfigForm({
  node,
  schema,
  canvasNodes,
  canvasEdges,
  onSave,
  onReset,
  className,
}: DynamicConfigFormProps) {
  // Initialize local draft values with existing node metadata merged with schema defaults
  const initialValues = useMemo(() => {
    return initializeDefaultConfiguration(schema, node.data.metadata);
  }, [node.data.metadata, schema]);

  const [draftValues, setDraftValues] = useState<Record<string, unknown>>(initialValues);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Synchronize when node identity changes
  useEffect(() => {
    setDraftValues(initializeDefaultConfiguration(schema, node.data.metadata));
  }, [node.id, schema, node.data.metadata]);

  // Evaluate validation in real time
  const validation = useMemo(() => {
    return validateNodeConfiguration(schema, draftValues, canvasNodes, canvasEdges);
  }, [schema, draftValues, canvasNodes, canvasEdges]);

  // Check if draft has unsaved changes compared to node.data.metadata
  const isDirty = useMemo(() => {
    const existing = node.data.metadata ?? {};
    const keys = new Set([...Object.keys(existing), ...Object.keys(draftValues)]);
    for (const key of keys) {
      if (JSON.stringify(existing[key]) !== JSON.stringify(draftValues[key])) {
        return true;
      }
    }
    return false;
  }, [node.data.metadata, draftValues]);

  const handleFieldChange = (key: string, value: unknown) => {
    setDraftValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleSave = () => {
    if (!validation.isValid) return;
    onSave(draftValues);
  };

  const handleReset = () => {
    setDraftValues(initializeDefaultConfiguration(schema, node.data.metadata));
    if (onReset) onReset();
  };

  const errorMap = useMemo(() => {
    const map = new Map<string, (typeof validation.errors)[0]>();
    for (const err of validation.errors) {
      map.set(err.fieldKey, err);
    }
    return map;
  }, [validation.errors]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Validation & Status Banner */}
      {validation.errors.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div>
              <p className="font-semibold">
                {validation.errors.length} configuration {validation.errors.length === 1 ? 'issue' : 'issues'}
              </p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-rose-200/90 list-disc list-inside">
                {validation.errors.slice(0, 3).map((err, i) => (
                  <li key={i}>{err.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : validation.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <p className="text-[11px] leading-relaxed">
              {validation.warnings[0].message}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-[11px]">Configuration is valid and Terraform-ready</span>
        </div>
      )}

      {/* Dynamic Sections */}
      <div className="space-y-3">
        {schema.sections.map((section) => {
          const isCollapsed = Boolean(collapsedSections[section.id]);
          const visibleFields = section.fields.filter((f) =>
            isFieldVisible(f, draftValues),
          );

          if (visibleFields.length === 0) return null;

          const sectionHasError = visibleFields.some((f) => errorMap.has(f.key));

          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated/40"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-hover"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span className="text-xs font-semibold text-slate-200">
                    {section.title}
                  </span>
                  {sectionHasError ? (
                    <span className="h-2 w-2 rounded-full bg-rose-500" title="Section contains validation errors" />
                  ) : null}
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {visibleFields.length} {visibleFields.length === 1 ? 'field' : 'fields'}
                </span>
              </button>

              {!isCollapsed ? (
                <div className="space-y-3.5 border-t border-border-subtle/80 bg-canvas/40 p-3.5">
                  {visibleFields.map((field) => (
                    <ConfigFieldRenderer
                      key={field.key}
                      field={field}
                      value={draftValues[field.key]}
                      allValues={draftValues}
                      canvasNodes={canvasNodes}
                      currentNodeId={node.id}
                      error={errorMap.get(field.key)}
                      onChange={handleFieldChange}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Save & Reset Actions Bar */}
      <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
        <button
          type="button"
          onClick={handleReset}
          disabled={!isDirty}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || !validation.isValid}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors',
            isDirty && validation.isValid
              ? 'bg-sky-600 hover:bg-sky-500 ring-1 ring-sky-400/50'
              : 'bg-slate-800 text-slate-400 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <Save className="h-3.5 w-3.5" />
          <span>{isDirty ? 'Save Configuration' : 'Saved'}</span>
        </button>
      </div>
    </div>
  );
}
