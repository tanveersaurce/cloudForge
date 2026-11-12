import { cn } from '@/utils/cn';
import { resolveAwsVisual } from '../utils/awsIconMap';

interface AwsServiceIconProps {
  iconKey: string;
  categoryIconKey?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CONTAINER_SIZES = {
  sm: 'h-7 w-7 rounded-md',
  md: 'h-9 w-9 rounded-lg',
  lg: 'h-12 w-12 rounded-xl',
} as const;

const ICON_SIZES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
} as const;

export function AwsServiceIcon({
  iconKey,
  categoryIconKey,
  size = 'md',
  className,
}: AwsServiceIconProps) {
  const { icon: Icon, badgeClassName } = resolveAwsVisual(iconKey, categoryIconKey);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center border',
        CONTAINER_SIZES[size],
        badgeClassName,
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={ICON_SIZES[size]} />
    </div>
  );
}
