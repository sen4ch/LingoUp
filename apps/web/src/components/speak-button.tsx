'use client';

import type { PronunciationQuery } from '@lingoup/contracts';
import { cn } from '@lingoup/ui';
import { useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n';
import { useCurrentUser } from '@/lib/auth';
import { pronounce } from '@/lib/pronunciation';

type State = 'idle' | 'playing' | 'failed';

/**
 * Speaker button: a Microsoft voice through the API, or the browser's own voice as a fallback.
 * `shortcut` is a KeyboardEvent.code (e.g. KeyP), so it works with any keyboard layout.
 */
export function SpeakButton({
  text,
  kind,
  label,
  shortcut,
}: PronunciationQuery & { label: string; shortcut?: string }) {
  const { data: user } = useCurrentUser();
  const [state, setState] = useState<State>('idle');
  const consent = user?.settings.aiDataSharing ?? false;

  const play = useCallback(async () => {
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
  }, [text, kind, user, consent]);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== shortcut || event.repeat || event.altKey || event.ctrlKey || event.metaKey)
        return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      void play();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut, play]);

  return (
    <button
      type="button"
      onClick={() => void play()}
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
