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
import { useState, type SyntheticEvent } from 'react';
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
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 lang="en" className="text-xl font-semibold">
            {lesson.title}
          </h2>
          <span className="text-sm text-muted">
            {lesson.level} · {Math.floor(lesson.durationSeconds / 60)}:
            {String(Math.floor(lesson.durationSeconds % 60)).padStart(2, '0')}
          </span>
        </div>
        <audio
          controls
          preload="metadata"
          src={audio}
          className="w-full"
          aria-label={t.listening.audioPlayer}
          onError={() => setAudioError(true)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <p>{t.listening.audioHint}</p>
          <a href={audio} download={`${lesson.id}.mp3`} className="underline">
            {t.listening.download}
          </a>
        </div>
        {audioError ? <Alert tone="warning">{t.listening.audioError}</Alert> : null}
        {lesson.isMock ? <Alert tone="warning">{t.listening.mock}</Alert> : null}
      </Card>
      <ol className="flex flex-col gap-4">
        {lesson.questions.map((question, index) => {
          const result = checked.data?.results[index];
          return (
            <li key={index}>
              <Card className="flex flex-col gap-3">
                <p lang="en" className="font-semibold">
                  {index + 1}. {question.question}
                </p>
                <div
                  role="group"
                  aria-label={`${t.listening.question} ${index + 1}`}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {question.options.map((option, optionIndex) => (
                    <button
                      key={optionIndex}
                      type="button"
                      lang="en"
                      aria-pressed={answers[index] === optionIndex}
                      disabled={checked.isPending || Boolean(checked.data)}
                      onClick={() => setAnswers((values) => ({ ...values, [index]: optionIndex }))}
                      className={`rounded-lg border px-4 py-3 text-left text-sm ${result && result.answerIndex === optionIndex ? 'border-success bg-success-bg' : answers[index] === optionIndex ? 'border-primary bg-surface-muted ring-1 ring-primary' : 'border-border hover:bg-surface-muted'}`}
                    >
                      {String.fromCharCode(65 + optionIndex)}. {option}
                    </button>
                  ))}
                </div>
                {result ? (
                  <Alert tone={result.correct ? 'success' : 'warning'}>
                    <p>{result.correct ? t.listening.correct : t.listening.incorrect}</p>
                    <p lang="en">{result.explanation}</p>
                    <p lang="en" className="mt-1 italic">
                      “{result.evidence}”
                    </p>
                  </Alert>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ol>
      {checked.isError ? <Alert tone="danger">{listeningError(checked.error)}</Alert> : null}
      {checked.data ? (
        <Card className="flex flex-col gap-4">
          <p className="text-xl font-semibold" role="status">
            {t.listening.score(checked.data.correct, checked.data.total)}
          </p>
          <details>
            <summary className="cursor-pointer font-semibold">{t.listening.transcript}</summary>
            <p lang="en" className="mt-3 leading-relaxed whitespace-pre-wrap">
              {checked.data.transcript}
            </p>
          </details>
        </Card>
      ) : (
        <Button
          loading={checked.isPending}
          disabled={Object.keys(answers).length !== lesson.questions.length}
          onClick={() => checked.mutate()}
        >
          {t.listening.check}
        </Button>
      )}
    </div>
  );
}

export default function ListeningPage() {
  const { user, isLoading } = useRequireUser();
  const [section, setSection] = useState<'practice' | 'watch'>('practice');
  const [level, setLevel] = useState<CefrLevel | ''>('');
  const [topic, setTopic] = useState('');
  const generate = useMutation({
    mutationFn: () =>
      api('/v1/learning/listening', {
        method: 'POST',
        body: {
          level: level || user?.settings.targetLevel || 'B1',
          topic: topic.trim(),
        },
        schema: ListeningLessonSchema,
      }),
  });
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    generate.mutate();
  };
  if (isLoading || !user) return <Skeleton className="h-80" />;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t.listening.title}</h1>
        <p className="mt-2 text-muted">{t.listening.intro}</p>
      </header>
      <div role="tablist" aria-label={t.listening.sections} className="grid grid-cols-2 gap-2">
        {(['practice', 'watch'] as const).map((value) => (
          <button
            key={value}
            id={`tab-${value}`}
            type="button"
            role="tab"
            aria-selected={section === value}
            aria-controls={`panel-${value}`}
            onClick={() => setSection(value)}
            className={`rounded-lg border px-3 py-4 font-semibold ${section === value ? 'border-primary bg-primary text-white' : 'border-border bg-surface hover:bg-surface-muted'}`}
          >
            {value === 'practice' ? t.listening.practice : t.listening.films}
          </button>
        ))}
      </div>
      <div id={`panel-${section}`} role="tabpanel" aria-labelledby={`tab-${section}`}>
        {section === 'watch' ? (
          <ListeningWatch />
        ) : (
          <div className="flex flex-col gap-5">
            <Card className="flex flex-col gap-4">
              <form onSubmit={submit} className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
                  <SelectField
                    label={t.listening.level}
                    value={level || user.settings.targetLevel}
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
                <p className="text-sm text-muted">
                  {t.listening.difficulty[level || user.settings.targetLevel]}
                </p>
                <p className="text-xs text-muted">{t.listening.localVoice}</p>
                <Button type="submit" loading={generate.isPending}>
                  {generate.isPending ? t.listening.generating : t.listening.generate}
                </Button>
              </form>
              {generate.isPending ? (
                <p role="status" className="text-sm text-muted">
                  {t.listening.wait}
                </p>
              ) : null}
              {generate.isError ? (
                <Alert tone="danger">{listeningError(generate.error)}</Alert>
              ) : null}
            </Card>
            {generate.data ? <Lesson key={generate.data.id} lesson={generate.data} /> : null}
          </div>
        )}
      </div>
    </div>
  );
}
