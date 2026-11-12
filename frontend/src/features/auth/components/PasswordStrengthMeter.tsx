import { Check, Circle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { evaluatePasswordStrength } from '../validation/authSchemas';

interface PasswordStrengthMeterProps {
  password: string;
}

const BAR_COLORS = [
  'bg-rose-500',
  'bg-amber-500',
  'bg-yellow-400',
  'bg-sky-400',
  'bg-emerald-400',
] as const;

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) {
    return null;
  }

  const strength = evaluatePasswordStrength(password);
  const rules = [
    { key: 'minLength', label: '8+ chars', met: strength.checks.minLength },
    { key: 'uppercase', label: 'Uppercase', met: strength.checks.uppercase },
    { key: 'lowercase', label: 'Lowercase', met: strength.checks.lowercase },
    { key: 'number', label: 'Number', met: strength.checks.number },
    { key: 'special', label: 'Special char', met: strength.checks.special },
  ];

  return (
    <div className="space-y-2 rounded-lg border border-border-subtle bg-canvas/70 p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400">Password strength</span>
        <span
          className={cn(
            'font-medium',
            strength.score >= 4
              ? 'text-emerald-400'
              : strength.score >= 2
                ? 'text-sky-300'
                : 'text-amber-400',
          )}
        >
          {strength.label}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => (
          <div
            key={segment}
            className={cn(
              'h-1.5 rounded-full transition-colors',
              strength.score >= segment ? BAR_COLORS[strength.score] : 'bg-slate-800',
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 sm:grid-cols-3">
        {rules.map((rule) => (
          <div
            key={rule.key}
            className={cn(
              'flex items-center gap-1.5 text-[11px]',
              rule.met ? 'text-emerald-400' : 'text-slate-500',
            )}
          >
            {rule.met ? <Check className="h-3 w-3 shrink-0" /> : <Circle className="h-3 w-3 shrink-0" />}
            <span>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
