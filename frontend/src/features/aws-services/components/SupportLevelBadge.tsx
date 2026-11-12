import { Badge, type BadgeVariant } from '@/components/Badge';

interface SupportLevelBadgeProps {
  level: string;
}

const LEVEL_META: Record<string, { label: string; variant: BadgeVariant }> = {
  CORE: { label: 'Core', variant: 'info' },
  STANDARD: { label: 'Standard', variant: 'neutral' },
  EXTENDED: { label: 'Extended', variant: 'muted' },
  PREVIEW: { label: 'Preview', variant: 'warning' },
};

export function SupportLevelBadge({ level }: SupportLevelBadgeProps) {
  const meta = LEVEL_META[level] ?? { label: level, variant: 'neutral' as BadgeVariant };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
