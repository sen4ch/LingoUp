'use client';

import {
  DueReviewsResponseSchema,
  REVIEW_RATINGS,
  SubmitReviewResponseSchema,
  type ReviewCard,
  type ReviewRating,
} from '@lingoup/contracts';
import { Alert, Button, Card, EmptyState, Kbd, Skeleton, buttonClasses, cn } from '@lingoup/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DUE_COUNT_QUERY_KEY } from '@/components/site-header';
import { t } from '@/i18n';
import { api } from '@/lib/api-client';
import { useRequireUser } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { formatInterval } from '@/lib/format';

const RATING_STYLE: Record<ReviewRating, string> = {
  again: 'border-danger/40 hover:bg-danger-bg',
  hard: 'border-warning/40 hover:bg-warning-bg',
  good: 'border-success/40 hover:bg-success-bg',
  easy: 'border-primary/40 hover:bg-info-bg',
};

export default function ReviewPage() {
  const { isLoading: authLoading } = useRequireUser();
  const due = useQuery({
    queryKey: ['reviews', 'due'],
    enabled: !authLoading,
    queryFn: () => api('/v1/vocabulary/reviews/due?limit=20', { schema: DueReviewsResponseSchema }),
    staleTime: 0,
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t.review.title}</h1>
        <p className="text-sm text-muted">{t.review.intro}</p>
      </header>
      {authLoading || due.isPending ? (
        <Skeleton className="h-72" />
      ) : due.isError ? (
        <Alert
          tone="danger"
          action={
            <Button size="sm" variant="secondary" onClick={() => void due.refetch()}>
              {t.common.retry}
            </Button>
          }
        >
          {describeError(due.error)}
        </Alert>
      ) : due.data.cards.length === 0 ? (
        <EmptyState
          title={t.review.nothingDue}
          action={
            <Link href="/library" className={buttonClasses('primary')}>
              {t.nav.library}
            </Link>
          }
        >
          {t.review.nothingDueText}
        </EmptyState>
      ) : (
        <ReviewSession
          key={due.dataUpdatedAt}
          cards={due.data.cards}
          totalDue={due.data.totalDue}
          onFinished={() => void due.refetch()}
        />
      )}
    </div>
  );
}

function ReviewSession({
  cards,
  totalDue,
  onFinished,
}: {
  cards: ReviewCard[];
  totalDue: number;
  onFinished: () => void;
}) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  // Idempotency key per shown card: a retried submit reuses it, so it is never counted twice.
  const [clientReviewId, setClientReviewId] = useState(() => crypto.randomUUID());
  const shownAt = useRef(0);
  const card = cards[index];

  useEffect(() => {
    shownAt.current = performance.now();
  }, [index]);

  const submit = useMutation({
    mutationFn: (rating: ReviewRating) =>
      api('/v1/vocabulary/reviews', {
        method: 'POST',
        body: {
          cardId: card!.cardId,
          rating,
          clientReviewId,
          durationMs: Math.min(3_600_000, Math.round(performance.now() - shownAt.current)),
        },
        schema: SubmitReviewResponseSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DUE_COUNT_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['words'] });
      setRevealed(false);
      setClientReviewId(crypto.randomUUID());
      setIndex((i) => i + 1);
    },
  });

  const rate = useCallback(
    (rating: ReviewRating) => {
      if (revealed && !submit.isPending) submit.mutate(rating);
    },
    [revealed, submit],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.key === ' ' && !revealed) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      const rating = REVIEW_RATINGS[Number(event.key) - 1];
      if (rating) rate(rating);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rate, revealed]);

  if (!card) {
    return (
      <EmptyState
        title={t.review.done}
        action={<Button onClick={onFinished}>{t.common.retry}</Button>}
      >
        {t.review.doneText}
      </EmptyState>
    );
  }

  const now = new Date();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted" aria-live="polite">
        {t.review.remaining(totalDue - index)}
      </p>
      <Card className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
        <p className="text-xs tracking-wide text-muted uppercase">{t.review.prompt}</p>
        <p className="text-4xl font-bold break-words">{card.term}</p>
        {card.contextSentence ? (
          <p className="font-reading text-muted italic">“{card.contextSentence}”</p>
        ) : null}
        {revealed ? (
          <div className="flex flex-col gap-1 border-t border-border pt-4" aria-live="polite">
            {card.translation ? <p className="text-xl font-semibold">{card.translation}</p> : null}
            {card.definition ? <p>{card.definition}</p> : null}
          </div>
        ) : null}
      </Card>

      {revealed ? (
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          role="group"
          aria-label={t.review.title}
        >
          {REVIEW_RATINGS.map((rating, i) => (
            <button
              key={rating}
              type="button"
              disabled={submit.isPending}
              onClick={() => rate(rating)}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg border-2 bg-surface px-3 py-3 font-semibold disabled:opacity-60',
                RATING_STYLE[rating],
              )}
            >
              <span>
                {t.review.ratings[rating]} <Kbd>{i + 1}</Kbd>
              </span>
              <span className="text-xs font-normal text-muted">
                {formatInterval(now, new Date(card.nextDue[rating]))}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Button size="lg" onClick={() => setRevealed(true)}>
          {t.review.showAnswer} <Kbd>Space</Kbd>
        </Button>
      )}
      {submit.isError ? <Alert tone="danger">{t.review.saveFailed}</Alert> : null}
      <p className="text-center text-xs text-muted">{t.review.keyboard}</p>
    </div>
  );
}
