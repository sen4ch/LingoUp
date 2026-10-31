'use client';

import { useEffect, useRef, useState } from 'react';
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
import { VocabularyIcon as Icon } from '@/components/vocabulary-icon';
import { PracticeTimer } from '@/components/practice-timer';
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
  const [mobileTab, setMobileTab] = useState<'email' | 'reply' | 'feedback'>('email');
  const [toolsOpen, setToolsOpen] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
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
  const latestEmail = emails.at(-1);
  const latestReply = emails.findLast((email) => email.role === 'user');
  const history = emails.length > 2 ? emails.slice(0, -2) : [];

  useEffect(() => {
    const root = workspace.current;
    const panel = root?.querySelector<HTMLElement>('.writing-layout');
    if (!root || !panel) return;
    const fit = () => {
      root.style.setProperty(
        '--writing-nav-height',
        `${document.querySelector('.site-header')?.getBoundingClientRect().height ?? 72}px`,
      );
      root.style.setProperty(
        '--writing-panel-height',
        `${Math.max(220, (window.visualViewport?.height ?? innerHeight) - panel.getBoundingClientRect().top - window.scrollY - 16)}px`,
      );
    };
    const observer = new ResizeObserver(fit);
    for (const element of [
      document.querySelector('.site-header'),
      root.querySelector('.writing-heading'),
      root.querySelector('.writing-setup-panel'),
      root.querySelector('.writing-mobile-tabs'),
    ])
      if (element) observer.observe(element);
    fit();
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
    };
  }, [user?.id, emails.length, error, mock]);

  function selectView(view: 'email' | 'reply' | 'feedback') {
    setMobileTab(view);
    if (window.matchMedia('(max-width: 767px)').matches)
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  }

  function compose() {
    if (window.matchMedia('(max-width: 767px)').matches) selectView('reply');
    requestAnimationFrame(() => editor.current?.focus({ preventScroll: true }));
  }
  async function send() {
    if (!user || pending.current || (emails.length > 0 && !draft.trim())) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const context: WritingMessage[] = emails.map(({ role, content }) => ({ role, content }));
    if (emails.length) context.push({ role: 'user', content: draft });
    try {
      const response = await api('/v1/learning/writing/turn', {
        method: 'POST',
        body: { level: selectedLevel, topic, messages: writingContext(context) },
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
      selectView(emails.length ? 'feedback' : 'email');
      requestAnimationFrame(() =>
        workspace.current
          ?.querySelector<HTMLElement>(
            emails.length ? '.writing-feedback-heading h2' : '.writing-email-content h2',
          )
          ?.focus({ preventScroll: true }),
      );
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
  function newExchange() {
    if (draft.trim() && !window.confirm('Discard your draft and start a new exchange?')) return;
    setEmails([]);
    setDraft('');
    setMock(false);
    setError(null);
    selectView('email');
  }
  function feedback(email: Email) {
    return (
      <WritingFeedback
        key={email.subject}
        id={email.subject}
        text={email.content}
        level={email.level ?? selectedLevel}
        issues={email.issues ?? []}
        feedback={email.feedback ?? ''}
        correctedText={email.correctedText}
        needsClarification={email.needsClarification}
      />
    );
  }

  if (isLoading || !user) return <Skeleton className="h-80" />;
  return (
    <div ref={workspace} className="writing-workspace" data-started={emails.length > 0}>
      <header className="writing-heading">
        <div>
          <p className="eyebrow">
            <Icon name="edit" width="13" height="13" /> FIND YOUR WORDS. MAKE THEM YOURS.
          </p>
          <h1>
            Writing<span className="text-primary">.</span>
          </h1>
          <p>A letter for your level. A reply in your own words.</p>
        </div>
        <span className="writing-penpal-badge">
          <span className="status-dot" /> Your English pen pal
        </span>
      </header>
      <Card className="writing-setup-panel">
        {!emails.length ? (
          <>
            <div className="writing-setup-fields">
              <SelectField
                label="CEFR level"
                value={selectedLevel}
                disabled={busy}
                options={CEFR_LEVELS.map((value) => ({ value, label: value }))}
                onChange={(event) => setLevel(event.target.value as CefrLevel)}
              />
              <TextField
                label="Email topic"
                value={topic}
                maxLength={80}
                disabled={busy}
                onChange={(event) => setTopic(event.target.value)}
              />
              <Button onClick={() => void send()} loading={busy} disabled={!topic.trim()}>
                <Icon name="mail" width="16" height="16" />
                {busy ? 'Preparing your email…' : 'Receive an email'}
              </Button>
            </div>
            <div
              className="writing-topic-suggestions"
              role="group"
              aria-label="Suggested email topics"
            >
              <span>A LITTLE INSPIRATION</span>
              {['Everyday life', 'Travel', 'Work & study', 'Weekend plans'].map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  aria-pressed={topic === value}
                  onClick={() => setTopic(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="writing-session-summary">
            <div>
              <span className="writing-level-badge">{selectedLevel}</span>
              <span>{topic}</span>
              <span>Aim for {target} words per reply</span>
            </div>
            <Button variant="secondary" size="sm" disabled={busy} onClick={newExchange}>
              <Icon name="plus" width="13" height="13" />
              New exchange
            </Button>
          </div>
        )}
      </Card>
      {mock ? (
        <Alert tone="warning">
          Demo mode: these are example emails. Your writing has not been assessed. Configure an AI
          provider for real feedback.
        </Alert>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="writing-mobile-tabs" role="group" aria-label="Writing workspace view">
        <button
          type="button"
          aria-pressed={mobileTab === 'email'}
          onClick={() => selectView('email')}
        >
          <Icon name="mail" width="14" height="14" />
          Email
        </button>
        <button
          type="button"
          disabled={!emails.length}
          aria-pressed={mobileTab === 'reply'}
          onClick={compose}
        >
          <Icon name="edit" width="14" height="14" />
          Write
        </button>
        <button
          type="button"
          disabled={!latestReply}
          aria-pressed={mobileTab === 'feedback'}
          onClick={() => selectView('feedback')}
        >
          <Icon name="check" width="14" height="14" />
          Feedback
        </button>
      </div>
      <div className="writing-layout" data-mobile-tab={mobileTab}>
        <section className="writing-reading-column" aria-label="Email exchange" aria-busy={busy}>
          <Card className="writing-inbox-panel">
            <header className="writing-panel-heading">
              <div>
                <span className="writing-avatar">A</span>
                <div>
                  <h2>Alex</h2>
                  <p>Your English pen pal</p>
                </div>
              </div>
              <span className="writing-inbox-label">
                <Icon name="mail" width="13" height="13" />
                {latestEmail ? 'INBOX' : 'A LETTER IS A GOOD BEGINNING'}
              </span>
            </header>
            {latestEmail ? (
              <>
                <div className="writing-email-content">
                  <p className="eyebrow">A NOTE FOR YOU</p>
                  <h2 tabIndex={-1}>{latestEmail.subject}</h2>
                  <p lang="en" className="writing-email-text">
                    {latestEmail.content}
                  </p>
                  {latestEmail.feedback ? (
                    <p className="writing-email-prompt">
                      <Icon name="spark" width="14" height="14" />
                      {latestEmail.feedback}
                    </p>
                  ) : null}
                </div>
                <footer className="writing-inbox-footer">
                  <span>One reply. A little more confidence.</span>
                  <button type="button" onClick={compose}>
                    Write a reply
                    <Icon name="arrow" width="14" height="14" />
                  </button>
                </footer>
              </>
            ) : (
              <div className="writing-inbox-empty">
                <div className="writing-letter-art" aria-hidden="true">
                  <span>
                    <Icon name="mail" width="27" height="27" />
                  </span>
                  <div>
                    <span>Dear you,</span>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <h2>
                  Good things start
                  <br />
                  with a few words.
                </h2>
                <p>
                  Choose a topic and receive a letter from Alex. Read it, write back, and let your
                  English grow.
                </p>
                <span>
                  <Icon name="check" width="12" height="12" /> Real practice. Room to make mistakes.
                </span>
              </div>
            )}
          </Card>
          {latestReply ? (
            <Card className="writing-feedback-latest">
              <div className="writing-feedback-heading">
                <p className="eyebrow">
                  <Icon name="spark" width="13" height="13" /> A LITTLE CLARITY FOR YOUR NEXT REPLY
                </p>
                <h2 tabIndex={-1}>
                  Your words, with feedback<span className="text-primary">.</span>
                </h2>
              </div>
              {feedback(latestReply)}
            </Card>
          ) : null}
          {history.length ? (
            <details className="writing-history">
              <summary>
                <Icon name="cards" width="14" height="14" />
                Earlier in this exchange <span>{history.length}</span>
                <Icon name="chevron" width="13" height="13" />
              </summary>
              <div>
                {history.map((email, index) => (
                  <Card key={index} className="writing-history-email">
                    <p className="eyebrow">
                      {email.role === 'assistant' ? 'INBOX · ALEX → YOU' : 'SENT · YOU → ALEX'}
                    </p>
                    <h3>
                      {email.role === 'assistant'
                        ? email.subject
                        : `Re: ${emails[index - 1]?.subject}`}
                    </h3>
                    {email.role === 'user' ? (
                      feedback(email)
                    ) : (
                      <p lang="en" className="writing-email-text">
                        {email.content}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </details>
          ) : null}
        </section>
        <Card className="writing-composer">
          <form
            aria-label="Write your reply"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <header>
              <div>
                <p className="eyebrow">
                  <Icon name="edit" width="12" height="12" /> YOUR SIDE OF THE CONVERSATION
                </p>
                <h2>
                  Reply to Alex<span className="text-primary">.</span>
                </h2>
              </div>
              <span>{selectedLevel}</span>
            </header>
            <label htmlFor="writing-reply" className="sr-only">
              Your email
            </label>
            <textarea
              ref={editor}
              id="writing-reply"
              lang="en"
              value={draft}
              maxLength={4000}
              rows={9}
              disabled={busy || !emails.length}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                emails.length
                  ? 'Hi Alex,\n\nTell me a little about yourself…\n\nBest,'
                  : 'Your reply starts here.\n\nReceive an email to begin your exchange with Alex.'
              }
              aria-describedby="writing-hint"
            />
            <div id="writing-hint" className="writing-draft-meta">
              <span>
                {wordCount} words <span>· {draft.length}/4000 characters</span>
              </span>
              <span>Aim for {target}</span>
            </div>
            <progress
              aria-label="Reply length guide"
              value={Math.min(wordCount, Number(target.split('–')[1]))}
              max={Number(target.split('–')[1])}
            />
            <p className="writing-composer-hint">
              Make it yours. Corrections appear after sending, and you can select any highlighted
              phrase to learn more.
            </p>
            <Button type="submit" loading={busy} disabled={!emails.length || !draft.trim()}>
              <span>{busy ? 'Checking and replying…' : 'Send & get feedback'}</span>
              <Icon name="arrow" width="16" height="16" />
            </Button>
            <p role="status" className="writing-send-status">
              {busy
                ? 'Reviewing your sentences and preparing a reply. This may take a minute.'
                : ''}
            </p>
          </form>
        </Card>
      </div>
      <details
        className="writing-session-tools"
        onToggle={(event) => setToolsOpen(event.currentTarget.open)}
      >
        <summary>
          <Icon name="settings" width="14" height="14" />
          Focus timer & practice information
          <Icon name="chevron" width="13" height="13" />
        </summary>
        {toolsOpen ? (
          <div className="writing-tools-content">
            <div className="grammar-focus">
              <PracticeTimer skill="writing" />
            </div>
            <div>
              <h2>A little space to write.</h2>
              <p>
                This exchange stays open until you leave or refresh the page. Emails are sent to
                your configured AI provider for feedback. External AI uses the data-sharing setting
                in your profile.
              </p>
              <p>
                Avoid sharing personal information. A failed request keeps your current draft, so
                you can try again.
              </p>
            </div>
          </div>
        ) : null}
      </details>
    </div>
  );
}
