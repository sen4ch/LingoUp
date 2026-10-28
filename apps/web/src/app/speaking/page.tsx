'use client';

import { CEFR_LEVELS, type CefrLevel, type SpeakingMessage } from '@lingoup/contracts';
import { Alert, Button, Card, SelectField, Skeleton, TextField } from '@lingoup/ui';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { useRequireUser } from '@/lib/auth';
import { ApiRequestError } from '@/lib/api-client';
import { SpeakingCall, type CallState } from '@/lib/speaking-call';

function callError(error: unknown): string {
  if (
    error instanceof DOMException &&
    ['NotAllowedError', 'NotFoundError', 'NotReadableError'].includes(error.name)
  )
    return t.speaking.microphoneError;
  if (error instanceof ApiRequestError) {
    const details = error.details as { aiStatus?: string } | undefined;
    if (details?.aiStatus === 'consent_required') return t.myTexts.aiErrors.consent_required!;
    if (details?.aiStatus === 'quota_exceeded') return t.myTexts.aiErrors.quota_exceeded!;
    return t.speaking.serviceError;
  }
  if (error instanceof Error && error.message.includes('English voice'))
    return t.speaking.voiceError;
  if (error instanceof Error && error.message.includes('HTTPS or localhost'))
    return t.speaking.microphoneError;
  return t.speaking.callError;
}

export default function SpeakingPage() {
  const { user, isLoading } = useRequireUser();
  const call = useRef<SpeakingCall | null>(null);
  const [state, setState] = useState<CallState>('idle');
  const [level, setLevel] = useState<CefrLevel | ''>('');
  const [topic, setTopic] = useState('');
  const [messages, setMessages] = useState<SpeakingMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mock, setMock] = useState(false);
  const latest = useRef<HTMLDivElement>(null);
  const active = state !== 'idle';
  useEffect(() => () => call.current?.end(), []);
  useEffect(() => {
    latest.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const start = () => {
    if (!user) return;
    call.current?.end();
    setMessages([]);
    setError(null);
    setMock(false);
    const connection = new SpeakingCall({
      level: level || user.settings.targetLevel,
      topic: topic.trim() || 'Everyday life',
      consent: user.settings.aiDataSharing,
      onState: setState,
      onMessages: setMessages,
      onMock: () => setMock(true),
      onError: (failure) => setError(callError(failure)),
    });
    call.current = connection;
    void connection.start();
  };

  if (isLoading || !user) return <Skeleton className="h-80" />;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">
          English only · AI teacher
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{t.speaking.title}</h1>
        <p className="text-muted">{t.speaking.intro}</p>
      </header>
      <Card className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <SelectField
            label={t.speaking.level}
            value={level || user.settings.targetLevel}
            disabled={active}
            onChange={(event) => setLevel(event.target.value as CefrLevel)}
            options={CEFR_LEVELS.map((value) => ({ value, label: value }))}
          />
          <TextField
            label={t.speaking.topic}
            placeholder={t.speaking.topicPlaceholder}
            value={topic}
            maxLength={80}
            disabled={active}
            onChange={(event) => setTopic(event.target.value)}
          />
        </div>
        <div className="flex flex-col items-center gap-4 rounded-xl bg-surface-muted px-4 py-8 text-center">
          <div
            aria-hidden="true"
            className={`flex size-24 items-center justify-center rounded-full border-4 border-primary/20 bg-surface text-4xl ${state === 'speaking' || state === 'listening' ? 'motion-safe:animate-pulse' : ''}`}
          >
            {state === 'listening' ? '🎙' : '☎'}
          </div>
          <p role="status" aria-live="polite" className="text-lg font-semibold">
            {t.speaking.states[state]}
          </p>
          <p className="max-w-lg text-sm text-muted">{t.speaking.howItWorks}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {!active ? (
              <Button size="lg" onClick={start}>
                {t.speaking.start}
              </Button>
            ) : (
              <>
                {state === 'listening' ? (
                  <Button variant="secondary" onClick={() => call.current?.send()}>
                    {t.speaking.send}
                  </Button>
                ) : null}
                {state === 'speaking' ? (
                  <Button variant="secondary" onClick={() => call.current?.interrupt()}>
                    {t.speaking.interrupt}
                  </Button>
                ) : null}
                {state !== 'connecting' ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      state === 'paused' ? call.current?.resume() : call.current?.pause()
                    }
                  >
                    {state === 'paused' ? t.speaking.resume : t.speaking.pause}
                  </Button>
                ) : null}
                <Button variant="danger-ghost" onClick={() => call.current?.end()}>
                  {t.speaking.end}
                </Button>
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-muted">{t.speaking.privacy}</p>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {mock ? <Alert tone="warning">{t.speaking.mock}</Alert> : null}
      </Card>
      {messages.length ? (
        <section className="flex flex-col gap-3" aria-label={t.speaking.transcript}>
          <h2 className="text-xl font-semibold">{t.speaking.transcript}</h2>
          <ol className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1">
            {messages.map((message, index) => (
              <li
                key={index}
                className={`max-w-[90%] rounded-xl border border-border px-4 py-3 ${message.role === 'assistant' ? 'self-start bg-surface' : 'self-end bg-surface-muted'}`}
              >
                <p className="mb-1 text-xs font-semibold text-muted">
                  {message.role === 'assistant' ? t.speaking.teacher : t.speaking.you}
                </p>
                <p
                  lang={message.role === 'assistant' ? 'en' : undefined}
                  className="leading-relaxed whitespace-pre-wrap"
                >
                  {message.content}
                </p>
              </li>
            ))}
          </ol>
          <div ref={latest} />
        </section>
      ) : null}
    </div>
  );
}
