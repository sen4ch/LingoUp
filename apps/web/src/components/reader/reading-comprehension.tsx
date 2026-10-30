'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReadingCheckSchema, ReadingCheckStateSchema } from '@lingoup/contracts';
import { Alert, Button, Card, Skeleton } from '@lingoup/ui';
import { api, ApiRequestError } from '@/lib/api-client';
import { useCurrentUser } from '@/lib/auth';
import { useHydrated } from '@/lib/use-hydrated';
import { describeError } from '@/lib/errors';
import { COMPLETIONS_QUERY_KEY } from '@/components/completion-mark';

function checkError(error: unknown) {
  if (error instanceof ApiRequestError && error.code === 'NOT_FOUND')
    return 'This check is no longer available. Reload the page to check the current text.';
  if (error instanceof ApiRequestError && error.code === 'AI_UNAVAILABLE') {
    const status = (error.details as { aiStatus?: string } | undefined)?.aiStatus;
    if (status === 'consent_required')
      return 'Enable AI data sharing in Profile to generate questions for this text.';
    if (status === 'quota_exceeded')
      return 'Your daily AI limit has been reached. Try again tomorrow.';
    return 'Questions could not be prepared for this text. Please retry. New texts need a configured AI provider.';
  }
  return describeError(error);
}

export function ReadingComprehension({ slug }: { slug: string }) {
  const hydrated = useHydrated();
  const { data: user, isPending: authPending } = useCurrentUser();
  const client = useQueryClient();
  const key = ['reading-check', user?.id, slug];
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [retry, setRetry] = useState(false);
  const state = useQuery({
    queryKey: key,
    queryFn: () => api(`/v1/learning/reading/${slug}/check`, { schema: ReadingCheckStateSchema }),
    enabled: Boolean(user),
    staleTime: 0,
  });
  const check = state.data?.check;
  const start = useMutation({
    mutationFn: () =>
      api(`/v1/learning/reading/${slug}/check`, { method: 'POST', schema: ReadingCheckSchema }),
    onSuccess: (data) => {
      client.setQueryData(key, { check: data });
      setRetry(false);
      setAnswers({});
    },
  });
  const submit = useMutation({
    mutationFn: () =>
      api(`/v1/learning/reading/${slug}/check/${check!.id}/answers`, {
        method: 'POST',
        body: { answers: check!.questions.map((_, index) => answers[index]) },
        schema: ReadingCheckSchema,
      }),
    onSuccess: async (data) => {
      client.setQueryData(key, { check: data });
      setRetry(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: COMPLETIONS_QUERY_KEY }),
        client.invalidateQueries({ queryKey: ['progress'] }),
        client.invalidateQueries({ queryKey: ['learning', 'next-practice'] }),
      ]);
    },
  });
  const result = retry ? null : check?.result;
  const busy = start.isPending || submit.isPending;
  return (
    <section
      aria-labelledby={`comprehension-${slug}`}
      className="space-y-4 border-t border-border pt-6"
    >
      <header className="space-y-2">
        <h2 id={`comprehension-${slug}`} className="text-2xl font-semibold">
          Check your understanding
        </h2>
        <p className="text-sm text-muted">
          Answer questions about this text, then review the explanations and supporting quotes. You
          can look back at the passage.
        </p>
      </header>
      {!hydrated || authPending ? (
        <Skeleton className="h-24" />
      ) : !user ? (
        <p className="text-sm">
          <Link
            href={`/login?next=${encodeURIComponent(`/read/${slug}`)}`}
            className="font-semibold text-primary underline"
          >
            Log in
          </Link>{' '}
          to check your understanding and save your result.
        </p>
      ) : (
        <>
          {state.isPending ? (
            <Skeleton className="h-24" />
          ) : state.isError ? (
            <Alert tone="danger">
              {checkError(state.error)}{' '}
              <Button variant="secondary" onClick={() => void state.refetch()}>
                Retry loading
              </Button>
            </Alert>
          ) : !check ? (
            <Card className="space-y-3">
              <p className="text-sm">
                Finished reading? Take a short comprehension check at this text’s level. Your result
                will be saved in your account.
              </p>
              <Button loading={start.isPending} onClick={() => start.mutate()}>
                Start comprehension check
              </Button>
            </Card>
          ) : (
            <>
              <p className="text-xs text-muted">
                {check.level} · {check.questions.length} questions ·{' '}
                {check.source === 'authored'
                  ? 'Prepared for this passage'
                  : 'AI-generated questions'}
                . Pass with at least 60%. Passing marks this text as read; each text earns Reading
                XP once.
              </p>
              {result ? (
                <Alert
                  tone={result.passed ? 'success' : 'warning'}
                  title={`${result.correct}/${result.total} correct · ${result.score}%`}
                >
                  <p>
                    {result.passed
                      ? 'You passed! This text is marked as read.'
                      : 'Read the quotes and explanations, then try again.'}
                  </p>
                  <p className="mt-1 text-xs">Saved result · {result.answeredAt.slice(0, 10)}</p>
                </Alert>
              ) : null}
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!busy && check.questions.every((_, index) => answers[index] !== undefined))
                    submit.mutate();
                }}
              >
                {check.questions.map((question, index) => {
                  const selected = result ? result.answers[index] : answers[index];
                  const review = result?.results[index];
                  return (
                    <Card key={`${check.id}:${index}`} className="space-y-3">
                      <fieldset disabled={busy || Boolean(result)} className="space-y-3">
                        <legend className="mb-3 font-semibold">
                          {index + 1}. {question.question}
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {question.options.map((option, optionIndex) => (
                            <label
                              key={optionIndex}
                              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${review?.answerIndex === optionIndex ? 'border-success bg-success-bg text-success' : review && selected === optionIndex ? 'border-danger bg-danger-bg text-danger' : selected === optionIndex ? 'border-primary bg-primary/5' : 'border-border'}`}
                            >
                              <input
                                type="radio"
                                name={`question-${check.id}-${index}`}
                                value={optionIndex}
                                checked={selected === optionIndex}
                                onChange={() =>
                                  setAnswers((previous) => ({ ...previous, [index]: optionIndex }))
                                }
                                className="mt-0.5 shrink-0 accent-primary"
                              />
                              <span>
                                {option}
                                {review?.answerIndex === optionIndex ? (
                                  <span className="ml-1 font-semibold">✓ Correct answer</span>
                                ) : review && selected === optionIndex ? (
                                  <span className="ml-1 font-semibold">✗ Your answer</span>
                                ) : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      {review ? (
                        <div className="space-y-2 text-sm">
                          <p>{review.explanation}</p>
                          <blockquote className="border-l-2 border-primary pl-3 text-muted">
                            <span className="mb-1 block text-xs font-semibold">From the text</span>
                            {review.evidence}
                          </blockquote>
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
                {result ? (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setRetry(true);
                      setAnswers({});
                      submit.reset();
                    }}
                  >
                    Try again
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    loading={submit.isPending}
                    disabled={!check.questions.every((_, index) => answers[index] !== undefined)}
                  >
                    Check answers
                  </Button>
                )}
              </form>
            </>
          )}
          {start.isError ? <Alert tone="danger">{checkError(start.error)}</Alert> : null}
          {submit.isError ? <Alert tone="danger">{checkError(submit.error)}</Alert> : null}
          <Retelling
            key={`${user.id}:${slug}`}
            storageKey={`lingoup:retelling:${user.id}:${slug}`}
          />
        </>
      )}
    </section>
  );
}

function Retelling({ storageKey }: { storageKey: string }) {
  const id = useId();
  const [draft, setDraft] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey)?.slice(0, 2000) ?? '';
    } catch {
      return '';
    }
  });
  return (
    <details className="rounded-xl border border-border p-4">
      <summary className="cursor-pointer font-semibold">Retell the text in your own words</summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-muted">
          Write 2–4 sentences about the main idea and key details. Compare your version with the
          passage. This is self practice and does not affect your score.
        </p>
        <label htmlFor={id} className="block text-sm font-medium">
          Your retelling
        </label>
        <textarea
          id={id}
          rows={5}
          maxLength={2000}
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            try {
              sessionStorage.setItem(storageKey, value);
            } catch {
              /* Draft remains usable without storage. */
            }
          }}
          className="w-full rounded-lg border border-border bg-surface p-3 text-sm"
        />
        <p className="text-xs text-muted">
          {draft.trim() ? draft.trim().split(/\s+/).length : 0} words · Draft kept in this tab
        </p>
      </div>
    </details>
  );
}
