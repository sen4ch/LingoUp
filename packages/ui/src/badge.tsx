import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-muted',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-text',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

const LEVEL_COLOR = {
  A: 'text-level-a border-level-a',
  B: 'text-level-b border-level-b',
  C: 'text-level-c border-level-c',
};

/** CEFR level chip; the colour groups A / B / C, the text carries the meaning. */
export function LevelBadge({ level, className }: { level: string; className?: string }) {
  const group = (level[0] ?? 'A') as keyof typeof LEVEL_COLOR;
  return (
    <span
      className={cn(
        'inline-flex h-6 min-w-9 items-center justify-center rounded-md border px-1.5 text-xs font-bold',
        LEVEL_COLOR[group],
        className,
      )}
      title={`CEFR ${level}`}
    >
      {level}
    </span>
  );
}
