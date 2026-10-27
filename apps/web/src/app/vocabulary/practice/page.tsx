'use client';

import { PracticeSetSchema, type PracticeSet } from '@lingoup/contracts';
import { Alert, Button, Card, Skeleton } from '@lingoup/ui';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { AnswerOption, answerOptionState } from '@/components/answer-option';
import { t } from '@/i18n';
import { ApiRequestError, api } from '@/lib/api-client';
import { useRequireUser } from '@/lib/auth';
import { describeError } from '@/lib/errors';

const GAP = '___';

function describePracticeError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === 'NOT_ENOUGH_WORDS') return t.practice.notEnoughWords;
    if (error.code === 'AI_UNAVAILABLE') return t.practice.noSentences;
  }
  return describeError(error);
}

function Sentence({ sentence, filled }: { sentence: string; filled: string | null }) {
  const [before, ...rest] = sentence.split(GAP);
  return (
    <p className="font-reading text-xl leading-relaxed">
      {before}
      <span className="mx-1 inline-block min-w-20 border-b-2 border-primary px-1 text-center font-semibold">
        {filled ?? ' '}
      </span>
      {rest.join(GAP)}
    </p>
  );
}

/** One pass through a practice set; answers are checked locally (self-practice). */
function PracticeRun({ set, onRestart }: { set: PracticeSet; onRestart: () => void }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const complete = useMutation({
    mutationFn: (score: number) =>
      api('/v1/vocabulary/practice/complete', {
        method: 'POST',
        body: { setId: set.setId, total: set.items.length, correct: score },
      }),
  });

  const item = set.items[index];
  if (finished || !item) {
    return (
      <Card className="flex flex-col items-start gap-4">
        <p className="text-2xl font-semibold">{t.practice.result(correct, set.items.length)}</p>
        {complete.isError ? <Alert tone="danger">{describeError(complete.error)}</Alert> : null}
        <Button onClick={onRestart}>{t.practice.again}</Button>
      </Card>
    );
  }

  const isLast = index === set.items.length - 1;
  const choose = (option: string) => {
    if (picked !== null) return;
    setPicked(option);
    if (option === item.answer) setCorrect((value) => value + 1);
  };
  const advance = () => {
    if (isLast) {
      setFinished(true);
      complete.mutate(correct);
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setShowHint(false);
  };

  return (
    <Card className="flex flex-col gap-5">
      <p className="text-sm text-muted">{t.practice.progress(index + 1, set.items.length)}</p>
      <Sentence sentence={item.sentence} filled={picked === null ? null : item.answer} />
      {item.hint ? (
        showHint ? (
          <p className="text-sm text-muted">
            {t.practice.hint}: {item.hint}
          </p>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setShowHint(true)}
          >
            {t.practice.hint}
          </Button>
        )
      ) : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.practice.title}>
        {item.options.map((option) => (
          <AnswerOption
            key={option}
            label={option}
            state={answerOptionState(option, picked, item.answer)}
            onSelect={() => choose(option)}
          />
        ))}
      </div>
      {picked !== null ? (
        <Button className="self-start" onClick={advance}>
          {isLast ? t.practice.finish : t.practice.next}
        </Button>
      ) : null}
    </Card>
  );
}

export default function PracticePage() {
  const { isLoading } = useRequireUser();
  const [run, setRun] = useState(0);
  const start = useMutation({
    mutationFn: () => api('/v1/vocabulary/practice', { method: 'POST', schema: PracticeSetSchema }),
    onSuccess: () => setRun((value) => value + 1),
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/vocabulary" className="text-sm text-muted hover:text-text">
          ← {t.vocabulary.title}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{t.practice.title}</h1>
        <p className="text-muted">{t.practice.intro}</p>
      </header>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : start.isPending ? (
        <Card className="flex flex-col gap-3" aria-busy>
          <p className="text-sm text-muted" role="status">
            {t.practice.loading}
          </p>
          <Skeleton className="h-24" />
        </Card>
      ) : start.data ? (
        <>
          <p className="text-sm text-muted">
            {start.data.source === 'ai' ? t.practice.sourceAi : t.practice.sourceContext}
            {start.data.isMock ? ` ${t.practice.mockNotice}` : ''}
          </p>
          <PracticeRun key={run} set={start.data} onRestart={() => start.mutate()} />
        </>
      ) : (
        <Card className="flex flex-col items-start gap-4">
          {start.isError ? <Alert tone="danger">{describePracticeError(start.error)}</Alert> : null}
          <Button onClick={() => start.mutate()}>{t.practice.start}</Button>
        </Card>
      )}
    </div>
  );
}
