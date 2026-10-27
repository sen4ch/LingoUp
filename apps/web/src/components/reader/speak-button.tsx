'use client';

import type { PronunciationQuery } from '@lingoup/contracts';
import { cn } from '@lingoup/ui';
import { useState } from 'react';
import { t } from '@/i18n';
import { useCurrentUser } from '@/lib/auth';
import { pronounce } from '@/lib/pronunciation';

type State = 'idle' | 'playing' | 'failed';

/** Speaker button: Azure voice through the API, or the browser's own voice as a fallback. */
export function SpeakButton({ text, kind, label }: PronunciationQuery & { label: string }) {
  const { data: user } = useCurrentUser();
  const [state, setState] = useState<State>('idle');
  const consent = user?.settings.aiDataSharing ?? false;

  const onClick = async () => {
    setState('playing');
    try {
      await pronounce(
        { text, kind },
        {
          useServer: Boolean(user) && (kind === 'term' || consent),
          localOnly: kind === 'sentence' && !consent,
        },
      );
      setState('idle');
    } catch {
      setState('failed');
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      aria-label={label}
      title={state === 'failed' ? t.speech.unavailable : label}
      aria-busy={state === 'playing' || undefined}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-text',
        state === 'playing' && 'text-primary',
        state === 'failed' && 'text-danger',
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        {state === 'failed' ? (
          <path d="m22 9-6 6m0-6 6 6" />
        ) : (
          <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
        )}
      </svg>
    </button>
  );
}
