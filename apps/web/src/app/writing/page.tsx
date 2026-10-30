'use client';

import { useRef, useState } from 'react';
import {
  CEFR_LEVELS,
  WritingTurnResponseSchema,
  type CefrLevel,
  type WritingMessage,
  type WritingIssue,
} from '@lingoup/contracts';
import { Alert, Button, Card, SelectField, Skeleton, TextField } from '@lingoup/ui';
import { api, ApiRequestError } from '@/lib/api-client';
import { useRequireUser } from '@/lib/auth';
import { writingContext } from '@/lib/writing';
import { WritingFeedback } from '@/components/writing-feedback';
import { t } from '@/i18n';

interface Email extends WritingMessage {
  subject: string;
  issues?: WritingIssue[];
  feedback?: string;
  correctedText?: string | null;
  needsClarification?: boolean;
  level?: CefrLevel;
}

export default function WritingPage() {
  const { user, isLoading } = useRequireUser();
  const [level, setLevel] = useState<CefrLevel | ''>('');
  const [topic, setTopic] = useState('Everyday life');
  const [emails, setEmails] = useState<Email[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [mock, setMock] = useState(false);
  const selectedLevel = level || user?.settings.targetLevel || 'A1';
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const target = {
    A1: '30–50',
    A2: '50–80',
    B1: '80–120',
    B2: '120–160',
    C1: '160–200',
    C2: '180–240',
  }[selectedLevel];

  async function send() {
    if (!user || pending.current || (emails.length > 0 && !draft.trim())) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const history: WritingMessage[] = emails.map(({ role, content }) => ({ role, content }));
    if (emails.length) history.push({ role: 'user', content: draft });
    try {
      const response = await api('/v1/learning/writing/turn', {
        method: 'POST',
        body: { level: selectedLevel, topic, messages: writingContext(history) },
        schema: WritingTurnResponseSchema,
      });
      const next: Email[] = [...emails];
      if (emails.length)
        next.push({
          role: 'user',
          content: draft,
          subject: `sent-${emails.length}`,
          issues: response.issues,
          correctedText: response.correctedText,
          needsClarification: response.needsClarification,
          level: selectedLevel,
          feedback: response.feedback,
        });
      next.push({
        role: 'assistant',
        content: response.reply,
        subject: response.subject,
        ...(emails.length ? {} : { feedback: response.feedback }),
      });
      setEmails(next);
      setDraft('');
      setMock(response.isMock);
    } catch (failure) {
      const status =
        failure instanceof ApiRequestError
          ? (failure.details as { aiStatus?: string } | undefined)?.aiStatus
          : undefined;
      setError(
        status
          ? t.card.aiStatus[status] || t.card.aiStatus.unavailable!
          : 'Could not send your email. Your draft is still here. Please try again.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if (isLoading || !user) return <Skeleton className="h-80" />;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">
          Your English pen pal
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Writing</h1>
        <p className="text-muted">
          A letter for your level. A reply in your own words. Get feedback and keep the conversation
          going.
        </p>
      </header>
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <SelectField
            label="CEFR level"
            value={selectedLevel}
            disabled={busy || emails.length > 0}
            options={CEFR_LEVELS.map((value) => ({ value, label: value }))}
            onChange={(event) => setLevel(event.target.value as CefrLevel)}
          />
          <TextField
            label="Email topic"
            value={topic}
            maxLength={80}
            disabled={busy || emails.length > 0}
            onChange={(event) => setTopic(event.target.value)}
          />
        </div>
        <p className="text-sm text-muted">
          Practice inside LingoUp. Aim for {target} words per reply. This exchange stays open until
          you leave or refresh this page.
        </p>
        {!emails.length ? (
          <Button onClick={() => void send()} disabled={busy || !topic.trim()}>
            {busy ? 'Preparing your email…' : 'Receive an email'}
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (draft.trim() && !window.confirm('Discard your draft and start a new exchange?'))
                return;
              setEmails([]);
              setDraft('');
              setMock(false);
              setError(null);
            }}
          >
            New exchange
          </Button>
        )}
        <p className="text-xs text-muted">
          Emails are sent to your configured AI provider for feedback. Avoid sharing personal
          information. External AI uses the data-sharing setting in your profile.
        </p>
      </Card>
      {mock ? (
        <Alert tone="warning">
          Demo mode: these are example emails. Your writing has not been assessed. Configure an AI
          provider for real feedback.
        </Alert>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <section aria-label="Email exchange" className="space-y-5" aria-busy={busy}>
        {emails.map((email, index) => (
          <Card key={index} className="space-y-4">
            <div className="border-b border-border pb-3">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                {email.role === 'assistant' ? 'Inbox · Alex → You' : 'Sent · You → Alex'}
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                {email.role === 'assistant' ? email.subject : `Re: ${emails[index - 1]?.subject}`}
              </h2>
            </div>
            {email.role === 'user' ? (
              <WritingFeedback
                id={email.subject}
                text={email.content}
                level={email.level ?? selectedLevel}
                issues={email.issues ?? []}
                feedback={email.feedback ?? ''}
                correctedText={email.correctedText}
                needsClarification={email.needsClarification}
              />
            ) : (
              <>
                <p lang="en" className="leading-8 whitespace-pre-wrap break-words">
                  {email.content}
                </p>
                {email.feedback ? (
                  <p className="rounded-xl bg-surface-muted p-4 text-sm">{email.feedback}</p>
                ) : null}
              </>
            )}
          </Card>
        ))}
      </section>
      {emails.length ? (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <h2 className="text-lg font-semibold">Reply to Alex</h2>
            <label htmlFor="writing-reply" className="block text-sm font-medium">
              Your email
            </label>
            <textarea
              id="writing-reply"
              lang="en"
              value={draft}
              maxLength={4000}
              rows={9}
              disabled={busy}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={'Hi Alex,\n\n…\n\nBest,'}
              aria-describedby="writing-hint"
              className="w-full resize-y rounded-xl border border-border bg-bg p-4 text-base leading-relaxed focus:outline-2 focus:outline-primary"
            />
            <div
              id="writing-hint"
              className="flex flex-wrap justify-between gap-2 text-sm text-muted"
            >
              <span>
                {wordCount} words · {draft.length}/4000 characters
              </span>
              <span>
                <span className="rounded bg-red-100 px-1 text-red-900">Red: word errors</span>{' '}
                <span className="rounded bg-yellow-100 px-1 text-yellow-950">Yellow: grammar</span>{' '}
                <span className="rounded bg-blue-100 px-1 text-blue-950">Blue: suggestions</span>
              </span>
            </div>
            <p className="text-xs text-muted">
              Corrections appear after sending. Select a highlighted phrase to read its explanation.
            </p>
            <Button type="submit" disabled={busy || !draft.trim()}>
              {busy ? 'Checking and replying…' : 'Send & get feedback'}
            </Button>
            <p role="status" className="text-sm text-muted">
              {busy
                ? 'Reviewing your sentences and preparing a reply. This may take a minute.'
                : ''}
            </p>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
