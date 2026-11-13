import { Info } from 'lucide-react';
import type { ArchitectureFlowNode } from '../../types/architecture.types';
import type {
  ConfigFieldDefinition,
  ConfigurationValidationIssue,
} from '../../types/configuration.types';
import { ResourceReferenceSelect } from './ResourceReferenceSelect';
import { cn } from '@/utils/cn';

export interface ConfigFieldRendererProps {
  field: ConfigFieldDefinition;
  value: unknown;
  allValues: Record<string, unknown>;
  canvasNodes: ArchitectureFlowNode[];
  currentNodeId: string;
  error?: ConfigurationValidationIssue;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
}

export function ConfigFieldRenderer({
  field,
  value,
  canvasNodes,
  currentNodeId,
  error,
  onChange,
  disabled = false,
}: ConfigFieldRendererProps) {
  const fieldId = `config-field-${field.key}`;

  const renderInput = () => {
    switch (field.type) {
      case 'text':
        return (
          <input
            id={fieldId}
            type="text"
            value={typeof value === 'string' ? value : ''}
            disabled={disabled || field.readOnly}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={cn(
              'w-full rounded-lg border border-border-subtle bg-canvas/80 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 transition-colors focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40 disabled:opacity-50',
              error && 'border-rose-500/50 focus:border-rose-500',
            )}
          />
        );

      case 'number':
        return (
          <input
            id={fieldId}
            type="number"
            min={field.validation?.min}
            max={field.validation?.max}
            value={typeof value === 'number' ? value : ''}
            disabled={disabled || field.readOnly}
            placeholder={field.placeholder}
            onChange={(e) => {
              const val = e.target.value.trim();
              onChange(field.key, val === '' ? '' : Number(val));
            }}
            className={cn(
              'w-full rounded-lg border border-border-subtle bg-canvas/80 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 transition-colors focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40 disabled:opacity-50',
              error && 'border-rose-500/50 focus:border-rose-500',
            )}
          />
        );

      case 'textarea':
        return (
          <textarea
            id={fieldId}
            rows={2}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled || field.readOnly}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={cn(
              'w-full resize-none rounded-lg border border-border-subtle bg-canvas/80 px-3 py-2 text-xs leading-relaxed text-slate-200 placeholder-slate-500 transition-colors focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40 disabled:opacity-50',
              error && 'border-rose-500/50 focus:border-rose-500',
            )}
          />
        );

      case 'boolean':
        return (
          <label className="relative flex cursor-pointer items-center gap-3">
            <input
              id={fieldId}
              type="checkbox"
              checked={Boolean(value)}
              disabled={disabled || field.readOnly}
              onChange={(e) => onChange(field.key, e.target.checked)}
              className="sr-only peer"
            />
            <div className="h-5 w-9 rounded-full bg-slate-800 transition-colors peer-checked:bg-sky-500 peer-focus:ring-2 peer-focus:ring-sky-500/30 peer-disabled:opacity-50 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
            <span className="text-xs font-medium text-slate-300">
              {Boolean(value) ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        );

      case 'select':
        return (
          <select
            id={fieldId}
            value={typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''}
            disabled={disabled || field.readOnly}
            onChange={(e) => {
              const raw = e.target.value;
              // Cast boolean or number if original option had boolean/number
              const matched = field.options?.find((o) => String(o.value) === raw);
              onChange(field.key, matched ? matched.value : raw);
            }}
            className={cn(
              'w-full rounded-lg border border-border-subtle bg-canvas/80 px-3 py-2 text-xs text-slate-100 transition-colors focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40 disabled:opacity-50',
              error && 'border-rose-500/50',
            )}
          >
            {field.options?.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="grid grid-cols-2 gap-2">
            {field.options?.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  disabled={disabled || field.readOnly}
                  onClick={() => onChange(field.key, opt.value)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-center text-xs font-medium transition-colors',
                    isSelected
                      ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                      : 'border-border-subtle bg-canvas/50 text-slate-300 hover:bg-surface-elevated',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );

      case 'resource-reference':
        return (
          <ResourceReferenceSelect
            id={fieldId}
            label={field.label}
            value={typeof value === 'string' ? value : ''}
            isMulti={false}
            targetResourceTypes={field.targetResourceTypes}
            canvasNodes={canvasNodes}
            currentNodeId={currentNodeId}
            placeholder={field.placeholder}
            disabled={disabled || field.readOnly}
            onChange={(next) => onChange(field.key, next)}
          />
        );

      case 'resource-reference-multi':
        return (
          <ResourceReferenceSelect
            id={fieldId}
            label={field.label}
            value={Array.isArray(value) ? (value as string[]) : []}
            isMulti={true}
            targetResourceTypes={field.targetResourceTypes}
            canvasNodes={canvasNodes}
            currentNodeId={currentNodeId}
            placeholder={field.placeholder}
            disabled={disabled || field.readOnly}
            onChange={(next) => onChange(field.key, next)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={fieldId}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-200"
        >
          <span>{field.label}</span>
          {field.validation?.required ? (
            <span className="text-rose-400 font-bold" title="Required field">*</span>
          ) : null}
        </label>

        {field.terraform?.terraformArgument ? (
          <span
            className="font-mono text-[9px] text-slate-500 truncate max-w-[140px]"
            title={`Terraform: ${field.terraform.terraformArgument}`}
          >
            {field.terraform.terraformArgument}
          </span>
        ) : null}
      </div>

      {field.description ? (
        <p className="text-[11px] leading-relaxed text-slate-400">{field.description}</p>
      ) : null}

      {renderInput()}

      {error ? (
        <p className="flex items-center gap-1 text-[11px] text-rose-300 font-medium">
          <Info className="h-3 w-3 shrink-0 text-rose-400" />
          <span>{error.message}</span>
        </p>
      ) : null}
    </div>
  );
}
