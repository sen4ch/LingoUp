import { cn } from './cn';

export interface SpinnerProps {
  size?: 'sm' | 'md';
  /** Accessible label; pass an empty string when the parent already announces the state. */
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        size === 'sm' ? 'size-4' : 'size-6',
        className,
      )}
    />
  );
}
