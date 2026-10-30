'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@lingoup/ui';

/** Load an authenticated recording fully before exposing controls, so duration/seek work. */
export function ExamAudio({ examId, part }: { examId: string; part: number }) {
  const [source, setSource] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const resource = useRef<string | null>(null);
  const operation = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      operation.current?.abort();
      if (resource.current) URL.revokeObjectURL(resource.current);
    };
  }, []);

  async function load() {
    if (pending.current) return;
    pending.current = true;
    setStatus('loading');
    setMessage('');
    setSource('');
    if (resource.current) URL.revokeObjectURL(resource.current);
    resource.current = null;
    const controller = new AbortController();
    operation.current = controller;
    try {
      const response = await fetch(`/api/v1/learning/exams/${examId}/audio/${part}`, {
        credentials: 'same-origin',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? 'Your session expired. Sign in again to load the recording.'
            : 'Could not load this recording. Please try again.',
        );
      if (!response.headers.get('content-type')?.startsWith('audio/mpeg'))
        throw new Error('The recording was not returned as audio. Please try again.');
      const blob = await response.blob();
      if (!blob.size || blob.size > 1024 * 1024)
        throw new Error('The recording is incomplete. Please try again.');
      if (!alive.current) return;
      resource.current = URL.createObjectURL(blob);
      setSource(resource.current);
    } catch (failure) {
      if (!alive.current || controller.signal.aborted) return;
      setStatus('error');
      setMessage(
        failure instanceof Error
          ? failure.message
          : 'Could not load this recording. Please try again.',
      );
    } finally {
      pending.current = false;
    }
  }
  function audioFailed() {
    setSource('');
    setStatus('error');
    setMessage('This recording could not be played. Please try loading it again.');
    if (resource.current) URL.revokeObjectURL(resource.current);
    resource.current = null;
  }
  return (
    <div className="space-y-2 rounded-xl bg-surface-muted p-4">
      <p className="text-sm font-medium">Part {part + 1}</p>
      {source ? (
        <audio
          aria-label={`Listening part ${part + 1}`}
          controls
          preload="metadata"
          hidden={status !== 'ready'}
          className="w-full"
          src={source}
          onLoadedMetadata={(event) => {
            if (Number.isFinite(event.currentTarget.duration) && event.currentTarget.duration > 0)
              setStatus('ready');
            else audioFailed();
          }}
          onError={audioFailed}
        />
      ) : null}
      {status === 'idle' || status === 'error' ? (
        <Button type="button" variant="secondary" onClick={() => void load()}>
          {status === 'error'
            ? `Retry audio for Part ${part + 1}`
            : `Load audio for Part ${part + 1}`}
        </Button>
      ) : null}
      {status === 'loading' ? (
        <p role="status" className="text-sm text-muted">
          Loading recording for Part {part + 1}…
        </p>
      ) : null}
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
