import { Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  enablePasswordToggle?: boolean;
}

export function FormField({
  id,
  label,
  error,
  hint,
  type = 'text',
  enablePasswordToggle = false,
  className,
  ...props
}: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordField = type === 'password' && enablePasswordToggle;
  const resolvedType = isPasswordField ? (showPassword ? 'text' : 'password') : type;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-slate-300">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={resolvedType}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={cn(
            'h-10 w-full rounded-lg border bg-canvas px-3 text-sm text-slate-100 placeholder:text-slate-500 transition-colors focus:outline-none',
            isPasswordField && 'pr-10',
            error
              ? 'border-rose-500/60 focus:border-rose-400'
              : 'border-border-subtle focus:border-sky-500/70',
            className,
          )}
          {...props}
        />

        {isPasswordField ? (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-200"
            aria-label={showPassword ? `Hide ${label}` : `Show ${label}`}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
