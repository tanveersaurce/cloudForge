import { CheckCircle2, Clock3, MinusCircle } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/Badge';

interface TerraformStatusBadgeProps {
  status: string;
  compact?: boolean;
}

const STATUS_META: Record<
  string,
  { label: string; shortLabel: string; variant: BadgeVariant }
> = {
  SUPPORTED: {
    label: 'Terraform Ready (Phase 05)',
    shortLabel: 'TF Ready',
    variant: 'success',
  },
  PARTIAL: {
    label: 'Terraform Partial',
    shortLabel: 'TF Partial',
    variant: 'warning',
  },
  NOT_IMPLEMENTED: {
    label: 'Provider Ready • Generator Pending',
    shortLabel: 'TF Pending',
    variant: 'info',
  },
  NOT_APPLICABLE: {
    label: 'Terraform N/A',
    shortLabel: 'TF N/A',
    variant: 'muted',
  },
};

export function TerraformStatusBadge({ status, compact = false }: TerraformStatusBadgeProps) {
  const meta = STATUS_META[status] ?? {
    label: status,
    shortLabel: status,
    variant: 'neutral' as BadgeVariant,
  };

  const Icon =
    status === 'SUPPORTED'
      ? CheckCircle2
      : status === 'NOT_APPLICABLE'
        ? MinusCircle
        : Clock3;

  return (
    <Badge variant={meta.variant} className="whitespace-nowrap">
      <Icon className="h-3 w-3 shrink-0" />
      <span>{compact ? meta.shortLabel : meta.label}</span>
    </Badge>
  );
}
