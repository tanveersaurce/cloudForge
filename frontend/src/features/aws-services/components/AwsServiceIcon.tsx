import { cn } from '@/utils/cn';
import { getOfficialAwsVisual } from '../utils/awsIconRegistry';

interface AwsServiceIconProps {
  iconKey?: string;
  categoryIconKey?: string;
  serviceSlug?: string;
  resourceType?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const PIXEL_SIZES = {
  sm: 24,
  md: 36,
  lg: 44,
  xl: 52,
} as const;

export function AwsServiceIcon({
  iconKey,
  categoryIconKey,
  serviceSlug,
  resourceType,
  size = 'md',
  className,
}: AwsServiceIconProps) {
  const visual = getOfficialAwsVisual(resourceType || serviceSlug || iconKey, categoryIconKey || iconKey);
  const IconComponent = visual.icon;
  const pixelSize = PIXEL_SIZES[size];

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-lg shadow-sm transition-transform',
        className,
      )}
      aria-hidden="true"
    >
      <IconComponent size={pixelSize} className="h-full w-full object-contain" />
    </div>
  );
}
