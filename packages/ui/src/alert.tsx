import type { ReactNode } from 'react';
import { cn } from './cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, string> = {
  info: 'bg-info-bg border-border',
  success: 'bg-success-bg border-success/30',
  warning: 'bg-warning-bg border-warning/30',
  danger: 'bg-danger-bg border-danger/30',
};

export interface AlertProps {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Inline message. Errors use role="alert" so screen readers announce them immediately. */
export function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex flex-col gap-2 rounded-lg border p-4 text-sm', TONES[tone], className)}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className="text-text">{children}</div> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
