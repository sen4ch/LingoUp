'use client';

import {
  GrammarAnswerResultSchema,
  type GrammarAnswerResult,
  type GrammarExercise,
} from '@lingoup/contracts';
import { Alert, Button, Card, buttonClasses } from '@lingoup/ui';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useId, useState, type SyntheticEvent } from 'react';
import { AnswerOption, answerOptionState } from '@/components/answer-option';
import { t } from '@/i18n';
import { api } from '@/lib/api-client';
import { useCurrentUser } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { useHydrated } from '@/lib/use-hydrated';

const GAP = '___';

/** Shows the prompt with the gap rendered as a visible blank (or the given answer). */
function Prompt({ prompt, filled }: { prompt: string; filled?: string | undefined }) {
  const [before, ...rest] = prompt.split(GAP);
  return (
    <p className="font-reading text-lg">
      {before}
      <span className="mx-1 inline-block min-w-16 border-b-2 border-primary px-1 text-center font-semibold">
        {filled ?? ' '}
      </span>
      {rest.join(GAP)}
    </p>
  );
}

function ExerciseCard({ exercise, number }: { exercise: GrammarExercise; number: number }) {
  const router = useRouter();
  const inputId = useId();
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<GrammarAnswerResult | null>(null);
  const submit = useMutation({
    mutationFn: (value: string) =>
      api(`/v1/grammar/exercises/${exercise.id}/attempts`, {
        method: 'POST',
        body: { answer: value },
        schema: GrammarAnswerResultSchema,
      }),
    onSuccess: (data) => {
      setResult(data);
      // Refresh server-rendered progress on the topic and list pages.
      router.refresh();
    },
  });

  const onGapSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (answer.trim()) submit.mutate(answer.trim());
  };
  const reset = () => {
    setResult(null);
    setAnswer('');
    submit.reset();
  };

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        {t.grammar.exerciseLabel(number)}
      </p>
      <Prompt
        prompt={exercise.prompt}
        filled={result ? (result.correct ? answer : undefined) : undefined}
      />

      {exercise.kind === 'choice' ? (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t.grammar.exerciseLabel(number)}
        >
          {exercise.options.map((option) => (
            <AnswerOption
              key={option}
              label={option}
              state={answerOptionState(
                option,
                result ? answer : null,
                result?.correctAnswer ?? null,
              )}
              onSelect={() => {
                if (submit.isPending) return;
                setAnswer(option);
                submit.mutate(option);
              }}
            />
          ))}
        </div>
      ) : (
        <form onSubmit={onGapSubmit} className="flex flex-wrap gap-2">
          <label htmlFor={inputId} className="sr-only">
            {t.grammar.answerPlaceholder}
          </label>
          <input
            id={inputId}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={result !== null}
            maxLength={200}
            autoComplete="off"
            placeholder={t.grammar.answerPlaceholder}
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
          />
          <Button
            type="submit"
            loading={submit.isPending}
            disabled={result !== null || !answer.trim()}
          >
            {t.grammar.check}
          </Button>
        </form>
      )}

      {result ? (
        <Alert
          tone={result.correct ? 'success' : 'danger'}
          title={result.correct ? t.grammar.correct : t.grammar.incorrect}
          action={
            <Button variant="ghost" size="sm" onClick={reset}>
              {t.grammar.tryAgain}
            </Button>
          }
        >
          {result.correct ? null : <p>{t.grammar.correctAnswer(result.correctAnswer)}</p>}
          {result.explanation ? <p className="text-muted">{result.explanation}</p> : null}
        </Alert>
      ) : null}
      {submit.isError ? <Alert tone="danger">{describeError(submit.error)}</Alert> : null}
    </Card>
  );
}

export function GrammarExercises({ exercises }: { exercises: GrammarExercise[] }) {
  const hydrated = useHydrated();
  const { data: user } = useCurrentUser();
  const pathname = usePathname();

  if (!hydrated || user === undefined) return null;
  if (user === null) {
    return (
      <Alert
        tone="info"
        action={
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className={buttonClasses('primary', 'sm')}
          >
            {t.nav.login}
          </Link>
        }
      >
        {t.grammar.loginToCheck}
      </Alert>
    );
  }
  return (
    <ol className="flex flex-col gap-4">
      {exercises.map((exercise, index) => (
        <li key={exercise.id}>
          <ExerciseCard exercise={exercise} number={index + 1} />
        </li>
      ))}
    </ol>
  );
}
