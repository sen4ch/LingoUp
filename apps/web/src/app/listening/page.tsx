'use client';

import {
  CEFR_LEVELS,
  ListeningLessonSchema,
  ListeningResultSchema,
  type CefrLevel,
  type ListeningLesson,
} from '@lingoup/contracts';
import { Alert, Button, Card, SelectField, Skeleton, TextField } from '@lingoup/ui';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type SyntheticEvent } from 'react';
import { VocabularyIcon as Icon } from '@/components/vocabulary-icon';
import { PracticeTimer } from '@/components/practice-timer';
import { ListeningWatch } from '@/components/listening-watch';
import { t } from '@/i18n';
import { api, ApiRequestError } from '@/lib/api-client';
import { useRequireUser } from '@/lib/auth';
import { describeError } from '@/lib/errors';

function listeningError(error: unknown) {
  if (error instanceof ApiRequestError && error.code === 'NOT_FOUND') return t.listening.expired;
  if (error instanceof ApiRequestError && error.code === 'AI_UNAVAILABLE') {
    const details = error.details as { aiStatus?: string } | undefined;
    if (details?.aiStatus === 'consent_required') return t.listening.consentRequired;
    if (details?.aiStatus === 'quota_exceeded') return t.myTexts.aiErrors.quota_exceeded!;
    return t.listening.generationError;
  }
  return describeError(error);
}

function Lesson({ lesson }: { lesson: ListeningLesson }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [current, setCurrent] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const checked = useMutation({
    mutationFn: () =>
      api(`/v1/learning/listening/${lesson.id}/answers`, {
        method: 'POST',
        body: { answers: lesson.questions.map((_, index) => answers[index]) },
        schema: ListeningResultSchema,
      }),
  });
  const audio = `/api/v1/learning/listening/${lesson.id}/audio`;
  const [audioError, setAudioError] = useState(false);
  const question = lesson.questions[current]!;
  const result = checked.data?.results[current];
  const answered = Object.keys(answers).length;
  const last = current === lesson.questions.length - 1;
  function goTo(index: number) {
    setCurrent(index);
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }
  return (
    <div className="listening-lesson">
      <Card className="listening-audio-card">
        <div className="listening-sound-art" aria-hidden="true">
          <span>
            <Icon name="headphones" width="30" height="30" />
          </span>
          <div>
            {[12, 24, 39, 22, 50, 33, 60, 42, 25, 53, 34, 17, 38, 25, 12].map((height, index) => (
              <i key={index} style={{ height }} />
            ))}
          </div>
        </div>
        <p className="eyebrow listening-audio-eyebrow">PRESS PLAY. TUNE IN.</p>
        <div className="listening-audio-title">
          <h2 lang="en" tabIndex={-1}>
            {lesson.title}
          </h2>
          <span>
            {lesson.level} · {Math.floor(lesson.durationSeconds / 60)}:
            {String(Math.floor(lesson.durationSeconds % 60)).padStart(2, '0')}
          </span>
        </div>
        <audio
          controls
          preload="metadata"
          src={audio}
          className="listening-audio"
          aria-label={t.listening.audioPlayer}
          onError={() => setAudioError(true)}
        />
        <div className="listening-audio-information">
          <p>{t.listening.audioHint}</p>
          <a href={audio} download={`${lesson.id}.mp3`}>
            <Icon name="download" width="12" height="12" />
            {t.listening.download}
          </a>
        </div>
        {audioError ? <Alert tone="warning">{t.listening.audioError}</Alert> : null}
        {lesson.isMock ? <Alert tone="warning">{t.listening.mock}</Alert> : null}
        {checked.data ? (
          <details className="listening-transcript">
            <summary>
              <Icon name="cards" width="13" height="13" />
              {t.listening.transcript}
              <Icon name="chevron" width="12" height="12" />
            </summary>
            <p lang="en">{checked.data.transcript}</p>
          </details>
        ) : null}
      </Card>
      <Card className="listening-quiz">
        {checked.data ? (
          <div className="listening-score">
            <span>
              <Icon
                name={checked.data.correct === checked.data.total ? 'check' : 'spark'}
                width="21"
                height="21"
              />
            </span>
            <div>
              <p role="status">{t.listening.score(checked.data.correct, checked.data.total)}</p>
              <span>Review each answer, then explore the transcript.</span>
            </div>
          </div>
        ) : (
          <header className="listening-quiz-heading">
            <p className="eyebrow">
              <span className="status-dot" />
              LISTEN FOR THE DETAILS
            </p>
            <span>
              {answered} of {lesson.questions.length} answered
            </span>
          </header>
        )}
        <nav className="listening-question-nav" aria-label="Question navigation">
          {lesson.questions.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to question ${index + 1}${checked.data ? (checked.data.results[index]?.correct ? ', correct' : ', incorrect') : answers[index] !== undefined ? ', answered' : ''}`}
              aria-current={current === index ? 'step' : undefined}
              data-answered={answers[index] !== undefined}
              data-correct={checked.data ? checked.data.results[index]?.correct : undefined}
              onClick={() => goTo(index)}
            >
              {index + 1}
            </button>
          ))}
          <span>
            Question {current + 1} of {lesson.questions.length}
          </span>
        </nav>
        <div className="listening-question-content">
          <h3 ref={heading} tabIndex={-1} lang="en">
            {question.question}
          </h3>
          <div
            role="group"
            aria-label={`${t.listening.question} ${current + 1}`}
            className="listening-options"
          >
            {question.options.map((option, optionIndex) => (
              <button
                key={optionIndex}
                type="button"
                lang="en"
                aria-pressed={answers[current] === optionIndex}
                disabled={checked.isPending || Boolean(checked.data)}
                data-correct={result ? result.answerIndex === optionIndex : undefined}
                data-incorrect={
                  result ? !result.correct && answers[current] === optionIndex : undefined
                }
                aria-label={
                  result
                    ? `${String.fromCharCode(65 + optionIndex)}. ${option}${result.answerIndex === optionIndex ? '. Correct answer.' : answers[current] === optionIndex ? '. Your answer.' : ''}`
                    : undefined
                }
                onClick={() => setAnswers((values) => ({ ...values, [current]: optionIndex }))}
              >
                <span>{String.fromCharCode(65 + optionIndex)}</span>
                <span>{option}</span>
                {result && result.answerIndex === optionIndex ? (
                  <Icon name="check" width="13" height="13" />
                ) : null}
              </button>
            ))}
          </div>
          {result ? (
            <div className="listening-answer-feedback" data-correct={result.correct}>
              <p>
                <Icon name={result.correct ? 'check' : 'spark'} width="13" height="13" />
                {result.correct ? t.listening.correct : t.listening.incorrect}
              </p>
              <p lang="en">{result.explanation}</p>
              <blockquote lang="en">“{result.evidence}”</blockquote>
            </div>
          ) : (
            <p className="listening-question-hint">
              Listen again if you need to. You can change your answers before checking.
            </p>
          )}
          {checked.isError ? <Alert tone="danger">{listeningError(checked.error)}</Alert> : null}
        </div>
        <footer className="listening-question-footer">
          <Button
            variant="ghost"
            disabled={current === 0 || checked.isPending}
            onClick={() => goTo(current - 1)}
          >
            <Icon name="arrow" width="13" height="13" className="listening-previous-icon" />
            Previous
          </Button>
          {last ? (
            checked.data ? (
              <Button variant="secondary" onClick={() => goTo(0)}>
                Review from the start
                <Icon name="arrow" width="13" height="13" />
              </Button>
            ) : (
              <Button
                loading={checked.isPending}
                disabled={answered !== lesson.questions.length}
                onClick={() => checked.mutate()}
              >
                {t.listening.check}
                <Icon name="check" width="13" height="13" />
              </Button>
            )
          ) : (
            <Button onClick={() => goTo(current + 1)}>
              Next question
              <Icon name="arrow" width="13" height="13" />
            </Button>
          )}
        </footer>
      </Card>
    </div>
  );
}

export default function ListeningPage() {
  const { user, isLoading } = useRequireUser();
  const [section, setSection] = useState<'practice' | 'watch'>('practice');
  const [level, setLevel] = useState<CefrLevel | ''>('');
  const [topic, setTopic] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const generate = useMutation({
    mutationFn: () =>
      api('/v1/learning/listening', {
        method: 'POST',
        body: { level: level || user?.settings.targetLevel || 'B1', topic: topic.trim() },
        schema: ListeningLessonSchema,
      }),
    onSuccess: () =>
      requestAnimationFrame(() => {
        if (root.current?.querySelector<HTMLElement>('#panel-practice')?.hidden) return;
        root.current
          ?.querySelector<HTMLElement>('.listening-audio-title h2')
          ?.focus({ preventScroll: true });
        if (window.matchMedia('(max-width: 767px)').matches)
          window.scrollTo({ top: 0, behavior: 'instant' });
      }),
  });
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!generate.isPending) generate.mutate();
  };
  function selectSection(value: 'practice' | 'watch') {
    if (value === 'watch') root.current?.querySelector('audio')?.pause();
    setSection(value);
  }
  if (isLoading || !user) return <Skeleton className="h-80" />;
  const selectedLevel = level || user.settings.targetLevel;
  return (
    <div
      ref={root}
      className="listening-workspace"
      data-active-lesson={section === 'practice' && Boolean(generate.data)}
    >
      <header className="listening-heading">
        <div>
          <p className="eyebrow">
            <Icon name="headphones" width="13" height="13" /> HEAR MORE. UNDERSTAND MORE.
          </p>
          <h1>
            {t.listening.title}
            <span aria-hidden="true" className="text-primary">
              .
            </span>
          </h1>
          <p>A story, a conversation, a new perspective. Let English come to you.</p>
        </div>
        <span className="listening-header-badge">
          <Icon name="headphones" width="14" height="14" />A little listening. Every day.
        </span>
      </header>
      <div
        role="tablist"
        aria-label={t.listening.sections}
        className="listening-tabs"
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const value =
            event.key === 'Home'
              ? 'practice'
              : event.key === 'End'
                ? 'watch'
                : section === 'practice'
                  ? 'watch'
                  : 'practice';
          selectSection(value);
          document.getElementById(`tab-${value}`)?.focus();
        }}
      >
        {(['practice', 'watch'] as const).map((value) => (
          <button
            key={value}
            id={`tab-${value}`}
            type="button"
            role="tab"
            tabIndex={section === value ? 0 : -1}
            aria-selected={section === value}
            aria-controls={`panel-${value}`}
            onClick={() => selectSection(value)}
          >
            <Icon name={value === 'practice' ? 'headphones' : 'film'} width="16" height="16" />
            {value === 'practice' ? t.listening.practice : t.listening.films}
            <Icon name="arrow" width="13" height="13" />
          </button>
        ))}
      </div>
      <div
        id="panel-practice"
        role="tabpanel"
        hidden={section !== 'practice'}
        aria-labelledby="tab-practice"
      >
        <div className="listening-practice" data-has-lesson={Boolean(generate.data)}>
          <details className="listening-setup-shell" open={!generate.data}>
            <summary>
              <Icon name="settings" width="14" height="14" />
              <span>{generate.data ? 'Create another recording' : 'Make it yours'}</span>
              <span>{generate.data ? generate.data.level : '3–5 MINUTES'}</span>
              <Icon name="chevron" width="12" height="12" />
            </summary>
            <Card className="listening-setup-panel">
              <form onSubmit={submit}>
                <div className="listening-setup-fields">
                  <SelectField
                    label={t.listening.level}
                    value={selectedLevel}
                    disabled={generate.isPending}
                    options={CEFR_LEVELS.map((value) => ({ value, label: value }))}
                    onChange={(event) => setLevel(event.target.value as CefrLevel)}
                  />
                  <TextField
                    label={t.listening.topic}
                    placeholder={t.listening.topicPlaceholder}
                    maxLength={80}
                    value={topic}
                    disabled={generate.isPending}
                    onChange={(event) => setTopic(event.target.value)}
                  />
                </div>
                <div
                  className="listening-topic-suggestions"
                  role="group"
                  aria-label="Suggested listening topics"
                >
                  <span>TRY</span>
                  {['Travel', 'Everyday life', 'Work'].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={topic === value}
                      disabled={generate.isPending}
                      onClick={() => setTopic(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <p className="listening-level-guide">
                  <span>
                    {selectedLevel} · {t.levels.names[selectedLevel]}
                  </span>
                  {t.listening.difficulty[selectedLevel]}
                </p>
                <Button type="submit" loading={generate.isPending}>
                  <Icon name="headphones" width="15" height="15" />
                  {generate.isPending ? t.listening.generating : t.listening.generate}
                  {!generate.isPending ? <Icon name="arrow" width="14" height="14" /> : null}
                </Button>
                <p className="listening-start-hint">
                  <Icon name="check" width="12" height="12" />
                  Your level. Your interests. Your pace.
                </p>
              </form>
              {generate.isPending ? (
                <p role="status" className="listening-generation-status">
                  {t.listening.wait}
                </p>
              ) : null}
              {generate.isError ? (
                <Alert tone="danger">{listeningError(generate.error)}</Alert>
              ) : null}
            </Card>
          </details>
          {generate.data ? (
            <Lesson key={generate.data.id} lesson={generate.data} />
          ) : (
            <Card className="listening-welcome" aria-busy={generate.isPending}>
              <div className="listening-welcome-art" aria-hidden="true">
                <div>
                  <Icon name="headphones" width="51" height="51" />
                </div>
                <span />
                <span />
                <i>ENGLISH, IN YOUR ELEMENT.</i>
              </div>
              <p className="eyebrow">
                {generate.isPending
                  ? 'MAKING SOMETHING FOR YOU'
                  : 'A FEW MINUTES. A WHOLE NEW PERSPECTIVE.'}
              </p>
              <h2>
                {generate.isPending ? (
                  'Your story is taking shape.'
                ) : (
                  <>
                    Less translating.
                    <br />
                    More understanding.
                  </>
                )}
              </h2>
              <p>
                {generate.isPending
                  ? 'We are preparing your recording and questions. Keep this page open — your lesson will appear here when it is ready.'
                  : 'Choose a topic, put your headphones on, and find out how much you already understand.'}
              </p>
              <div className="listening-welcome-steps">
                <span>
                  <b>01</b>Listen
                </span>
                <span>
                  <b>02</b>Answer
                </span>
                <span>
                  <b>03</b>Discover
                </span>
              </div>
            </Card>
          )}
        </div>
      </div>
      {section === 'watch' ? (
        <div id="panel-watch" role="tabpanel" aria-labelledby="tab-watch">
          <ListeningWatch />
        </div>
      ) : null}
      <details
        className="listening-session-tools"
        onToggle={(event) => setToolsOpen(event.currentTarget.open)}
      >
        <summary>
          <Icon name="clock" width="13" height="13" />
          Focus timer & listening information
          <Icon name="chevron" width="12" height="12" />
        </summary>
        {toolsOpen ? (
          <div className="listening-tools-content">
            <div className="grammar-focus">
              <PracticeTimer skill="listening" />
            </div>
            <div>
              <h2>Make listening a small daily habit.</h2>
              <p>{t.listening.localVoice}</p>
              <p>
                External AI text generation uses the data-sharing setting in your profile. Audio
                practice recordings are available for 24 hours; download yours if you want to keep
                it.
              </p>
            </div>
          </div>
        ) : null}
      </details>
    </div>
  );
}
