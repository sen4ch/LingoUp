'use client';

import { CEFR_LEVELS, type CefrLevel, type SpeakingMessage } from '@lingoup/contracts';
import { Alert, Button, Card, SelectField, Skeleton, TextField } from '@lingoup/ui';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { useRequireUser } from '@/lib/auth';
import { ApiRequestError } from '@/lib/api-client';
import { SpeakingCall, type CallState } from '@/lib/speaking-call';
import { VocabularyIcon as Icon } from '@/components/vocabulary-icon';
import { PracticeTimer } from '@/components/practice-timer';

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
  const [toolsOpen, setToolsOpen] = useState(false);
  const latest = useRef<HTMLOListElement>(null);
  const active = state !== 'idle';
  useEffect(() => () => call.current?.end(), []);
  useEffect(() => {
    if (latest.current) latest.current.scrollTop = latest.current.scrollHeight;
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
    <div className="speaking-workspace" data-call-state={state}>
      <header className="speaking-heading">
        <div>
          <p className="eyebrow">
            <Icon name="mic" width="13" height="13" /> FIND YOUR VOICE. ONE CONVERSATION AT A TIME.
          </p>
          <h1>
            Speaking<span className="text-primary">.</span>
          </h1>
          <p>A little less overthinking. A little more conversation.</p>
        </div>
        <span className="speaking-language-badge">
          <span className="status-dot" /> English-speaking AI teacher
        </span>
      </header>
      <div className="speaking-layout">
        <div className="speaking-main">
          <Card className="speaking-console">
            <div className="speaking-setup">
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
            {!active ? (
              <div
                className="speaking-topic-suggestions"
                role="group"
                aria-label="Suggested conversation topics"
              >
                <span>TRY A TOPIC</span>
                {['Everyday life', 'Travel', 'Work & study', 'Food & culture'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={topic === value || (!topic && value === 'Everyday life')}
                    onClick={() => setTopic(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            ) : (
              <p className="speaking-current-topic">
                <span className="status-dot" />
                {level || user.settings.targetLevel} · {topic.trim() || 'Everyday life'}
              </p>
            )}
            <section className="speaking-call-stage" aria-label="Voice call">
              <div className="speaking-orb-scene" aria-hidden="true">
                <span className="speaking-orbit orbit-outer" />
                <span className="speaking-orbit orbit-inner" />
                <div className="speaking-orb">
                  <Icon
                    name={state === 'paused' ? 'pause' : state === 'idle' ? 'phone' : 'mic'}
                    width="35"
                    height="35"
                  />
                </div>
                <span className="speaking-orb-caption">
                  {state === 'idle'
                    ? 'YOUR ENGLISH, OUT LOUD'
                    : state === 'listening'
                      ? 'THE FLOOR IS YOURS'
                      : state === 'speaking'
                        ? 'LISTEN. THEN MAKE IT YOURS.'
                        : state === 'paused'
                          ? 'TAKE A MOMENT'
                          : 'ONE MOMENT'}
                </span>
              </div>
              <p role="status" aria-live="polite" className="speaking-call-status">
                {t.speaking.states[state]}
              </p>
              <p className="speaking-call-hint">
                {state === 'idle'
                  ? 'Choose a topic, take a breath, and say hello. Your teacher will guide the conversation.'
                  : state === 'listening'
                    ? 'Speak naturally. A short pause sends your turn automatically.'
                    : state === 'speaking'
                      ? 'Listen to your teacher, or interrupt when you are ready to respond.'
                      : state === 'paused'
                        ? 'Your microphone is off. Continue whenever you feel ready.'
                        : 'Your teacher is getting the next part of the conversation ready.'}
              </p>
              <div className="speaking-call-controls">
                {!active ? (
                  <Button size="lg" onClick={start}>
                    <Icon name="phone" width="18" height="18" />
                    {t.speaking.start}
                    <Icon name="arrow" width="17" height="17" />
                  </Button>
                ) : (
                  <>
                    {state === 'listening' ? (
                      <Button variant="secondary" onClick={() => call.current?.send()}>
                        <Icon name="check" width="16" height="16" />
                        {t.speaking.send}
                      </Button>
                    ) : null}
                    {state === 'speaking' ? (
                      <Button variant="secondary" onClick={() => call.current?.interrupt()}>
                        <Icon name="mic" width="16" height="16" />
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
                        <Icon name={state === 'paused' ? 'play' : 'pause'} width="16" height="16" />
                        {state === 'paused' ? t.speaking.resume : t.speaking.pause}
                      </Button>
                    ) : null}
                    <Button variant="danger-outline" onClick={() => call.current?.end()}>
                      <Icon name="phone" width="16" height="16" />
                      {t.speaking.end}
                    </Button>
                  </>
                )}
              </div>
            </section>
            <p className="speaking-mic-note">
              <Icon name="mic" width="12" height="12" />
              {active
                ? 'Your microphone follows the call status above.'
                : 'Microphone access starts only when you call.'}
            </p>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {mock ? <Alert tone="warning">{t.speaking.mock}</Alert> : null}
          </Card>
          <details
            className="speaking-session-tools"
            onToggle={(event) => setToolsOpen(event.currentTarget.open)}
          >
            <summary>
              <Icon name="settings" width="14" height="14" />
              Focus timer & call information
              <Icon name="chevron" width="13" height="13" />
            </summary>
            {toolsOpen ? (
              <div className="speaking-tools-content">
                <div className="grammar-focus">
                  <PracticeTimer skill="speaking" />
                </div>
                <div>
                  <h2>A little space to practise.</h2>
                  <p>{t.speaking.howItWorks}</p>
                  <p>{t.speaking.privacy}</p>
                </div>
              </div>
            ) : null}
          </details>
        </div>
        <section className="speaking-conversation" aria-label={t.speaking.transcript}>
          <header>
            <div>
              <Icon name="cards" width="17" height="17" />
              <h2>{t.speaking.transcript}</h2>
            </div>
            <span>{messages.length ? `${messages.length} messages` : 'YOUR PRACTICE SPACE'}</span>
          </header>
          {messages.length ? (
            <ol
              ref={latest}
              className="speaking-messages"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.map((message, index) => (
                <li key={index} className={`speaking-message speaking-message-${message.role}`}>
                  <p className="speaking-message-author">
                    {message.role === 'assistant' ? t.speaking.teacher : t.speaking.you}
                  </p>
                  <p
                    lang={message.role === 'assistant' ? 'en' : undefined}
                    className="speaking-message-text"
                  >
                    {message.content}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="speaking-conversation-empty">
              <div aria-hidden="true">
                <span>Hello.</span>
                <span>
                  Let’s talk<span className="text-primary"> ↗</span>
                </span>
              </div>
              <h3>
                Good conversations
                <br />
                start with a hello.
              </h3>
              <p>Your words and your teacher’s replies will appear here as you talk.</p>
              <span>
                <Icon name="check" width="12" height="12" /> Make mistakes. Find your words. Keep
                going.
              </span>
            </div>
          )}
          <footer>
            <span className={active ? 'status-dot' : 'speaking-idle-dot'} />
            <span>
              {active
                ? 'Conversation in progress'
                : messages.length
                  ? 'Call ended · Your conversation stays here until the next call'
                  : 'Ready when you are'}
            </span>
          </footer>
        </section>
      </div>
    </div>
  );
}
