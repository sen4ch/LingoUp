'use client';

import {
  DueReviewsResponseSchema,
  DEFAULT_REVIEW_TEMPLATE,
  REVIEW_RATINGS,
  SubmitReviewResponseSchema,
  type ReviewCard,
  type ReviewRating,
  type WordImage,
  type ReviewTemplate,
} from '@lingoup/contracts';
import { Alert, Button, Card, Kbd, Skeleton, buttonClasses } from '@lingoup/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DUE_COUNT_QUERY_KEY } from '@/components/site-header';
import { ImagePicker } from '@/components/image-picker';
import { SpeakButton } from '@/components/speak-button';
import { WordPicture } from '@/components/word-picture';
import { VocabularyIcon as Icon } from '@/components/vocabulary-icon';
import { PracticeTimer } from '@/components/practice-timer';
import { t } from '@/i18n';
import { api } from '@/lib/api-client';
import { useRequireUser } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { formatInterval } from '@/lib/format';

const RATING_HINT: Record<ReviewRating, string> = {
  again: 'Not yet',
  hard: 'With some effort',
  good: 'I remembered',
  easy: 'Without a doubt',
};

export default function ReviewPage() {
  const workspace = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = workspace.current;
    const stage = root?.querySelector<HTMLElement>('.review-layout');
    if (!root || !stage) return;
    const fitSession = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const top = stage.getBoundingClientRect().top + window.scrollY;
      root.style.setProperty(
        '--review-stage-height',
        `${Math.max(280, viewportHeight - top - 12)}px`,
      );
    };
    const observer = new ResizeObserver(fitSession);
    for (const element of [
      document.querySelector('.site-header'),
      root.querySelector('.review-heading'),
    ]) {
      if (element) observer.observe(element);
    }
    fitSession();
    window.addEventListener('resize', fitSession);
    window.visualViewport?.addEventListener('resize', fitSession);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fitSession);
      window.visualViewport?.removeEventListener('resize', fitSession);
    };
  }, []);
  const { user, isLoading: authLoading } = useRequireUser();
  const due = useQuery({
    queryKey: ['reviews', 'due'],
    enabled: !authLoading,
    queryFn: () => api('/v1/vocabulary/reviews/due?limit=20', { schema: DueReviewsResponseSchema }),
    staleTime: 0,
  });

  return (
    <div ref={workspace} className="review-workspace">
      <header className="review-heading">
        <div>
          <Link href="/vocabulary" className="review-back-link">
            ← My vocabulary
          </Link>
          <h1>
            {t.review.title}
            <span className="text-primary">.</span>
          </h1>
        </div>
        <Link href="/vocabulary#card-display" className="review-settings-link">
          <Icon name="settings" width="16" height="16" />
          Card display settings
        </Link>
      </header>
      <div className="review-layout">
        <section className="review-main" aria-label="Word review session">
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
            <ReviewFinish
              title={t.review.nothingDue}
              description="You're up to date. Add a new word or read something interesting while your memory does its thing."
            />
          ) : (
            <ReviewSession
              key={due.dataUpdatedAt}
              cards={due.data.cards}
              totalDue={due.data.totalDue}
              template={user?.settings.reviewTemplate ?? DEFAULT_REVIEW_TEMPLATE}
              onFinished={() => void due.refetch()}
            />
          )}
        </section>
      </div>
      <details className="review-tools">
        <summary>
          <Icon name="clock" width="14" height="14" />
          Session tools & timer
          <Icon name="chevron" width="13" height="13" />
        </summary>
        <aside className="review-sidebar" aria-label="Review tools">
          <div className="review-guide">
            <p className="eyebrow">MAKE IT STICK</p>
            <h2>A moment for your memory.</h2>
            <p>No rush. Give yourself a chance to remember before turning the card.</p>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>Recall</strong>
                  <p>Say the answer to yourself.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Reveal</strong>
                  <p>See how close you were.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Reflect</strong>
                  <p>Choose how it really felt.</p>
                </div>
              </li>
            </ol>
            <div className="review-guide-note">
              <Icon name="spark" width="15" height="15" />
              <p>Honest answers help us choose the right time to show each word again.</p>
            </div>
          </div>
          <div className="grammar-focus review-focus">
            <p className="eyebrow">
              <Icon name="clock" width="14" height="14" /> YOUR FOCUS TIME
            </p>
            <PracticeTimer skill="vocabulary" />
          </div>
          <div className="review-shortcuts">
            <p className="eyebrow">A LITTLE LESS CLICKING</p>
            <div>
              <Kbd>Space</Kbd>
              <span>Reveal the answer</span>
            </div>
            <div>
              <Kbd>1–4</Kbd>
              <span>Rate your recall</span>
            </div>
            <div>
              <Kbd>P</Kbd>
              <span>Hear the English word</span>
            </div>
          </div>
        </aside>
      </details>
    </div>
  );
}

function ReviewFinish({
  title,
  description,
  reviewed,
  onContinue,
}: {
  title: string;
  description: string;
  reviewed?: number;
  onContinue?: () => void;
}) {
  return (
    <div className="review-finish">
      <div className="review-finish-art" aria-hidden="true">
        <span className="finish-orbit" />
        <span className="finish-orbit finish-orbit-two" />
        <span className="finish-check">
          <Icon name="check" width="34" height="34" />
        </span>
        <span className="finish-spark">
          <Icon name="spark" width="20" height="20" />
        </span>
      </div>
      <p className="eyebrow">
        {reviewed ? `${reviewed} WORDS. A LITTLE MORE CONFIDENCE.` : 'LET YOUR LEARNING SETTLE IN.'}
      </p>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="review-finish-actions">
        {onContinue ? (
          <Button onClick={onContinue}>
            Check for more words
            <Icon name="arrow" width="16" height="16" />
          </Button>
        ) : (
          <Link href="/vocabulary" className={buttonClasses('primary')}>
            Grow my vocabulary
            <Icon name="plus" width="16" height="16" />
          </Link>
        )}
        <Link href="/library" className={buttonClasses('secondary')}>
          Explore the library
        </Link>
      </div>
      <Link href="/vocabulary" className="review-finish-back">
        Back to my words <Icon name="arrow" width="14" height="14" />
      </Link>
    </div>
  );
}

function ReviewContext({ card }: { card: ReviewCard }) {
  if (!card.contextSentence) return null;
  return (
    <div className="review-context">
      <p className="font-reading text-muted italic">“{card.contextSentence}”</p>
      <SpeakButton
        key={card.cardId}
        text={card.contextSentence}
        kind="sentence"
        label={t.speech.sentence}
      />
    </div>
  );
}

function ReviewSession({
  cards,
  totalDue,
  onFinished,
  template,
}: {
  cards: ReviewCard[];
  totalDue: number;
  onFinished: () => void;
  template: ReviewTemplate;
}) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  // Idempotency key per shown card: a retried submit reuses it, so it is never counted twice.
  const [clientReviewId, setClientReviewId] = useState(() => crypto.randomUUID());
  const shownAt = useRef(0);
  const card = cards[index];
  // Pictures added or changed during this session (the due list is loaded once).
  const [images, setImages] = useState<Record<string, WordImage | null>>({});
  const [picking, setPicking] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const image = card ? (card.wordId in images ? images[card.wordId]! : card.image) : null;
  const translationFirst = template.front === 'translation' && Boolean(card?.translation?.trim());

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
      void queryClient.invalidateQueries({ queryKey: ['progress', 'summary'] });
      setRevealed(false);
      setPicking(false);
      setDetailsOpen(false);
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
        picking ||
        detailsOpen ||
        event.repeat ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.key === ' ' && !revealed) {
        if (event.target instanceof HTMLElement && event.target.closest('button, a, summary'))
          return;
        event.preventDefault();
        setRevealed(true);
        return;
      }
      const rating = REVIEW_RATINGS[Number(event.key) - 1];
      if (rating) rate(rating);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rate, revealed, picking, detailsOpen]);

  if (!card) {
    return (
      <ReviewFinish
        title={totalDue > index ? 'A little progress goes a long way.' : t.review.done}
        description={
          totalDue > index
            ? `${index} words reviewed. ${totalDue - index} more are ready whenever you are.`
            : 'You showed up. You practised. Let these words settle in, and come back when they are ready for a refresh.'
        }
        reviewed={index}
        onContinue={onFinished}
      />
    );
  }

  const now = new Date();
  return (
    <div className="review-session">
      <div className="review-session-progress">
        <div>
          <span>
            <span className="status-dot" /> YOUR REVIEW SESSION
          </span>
          <p aria-live="polite">
            Card <strong>{index + 1}</strong> of {cards.length}
            <span> · {t.review.remaining(totalDue - index)}</span>
          </p>
        </div>
        <progress value={index} max={cards.length} aria-label="Cards reviewed in this session" />
      </div>
      <Card
        key={card.cardId}
        role="region"
        tabIndex={0}
        className={`review-flashcard ${revealed ? 'review-flashcard-revealed' : ''}`}
        aria-label="Review card"
        aria-busy={submit.isPending || undefined}
      >
        <div className="review-card-topline">
          <span>
            <Icon name="cards" width="14" height="14" />
            {translationFirst ? 'TRANSLATION → ENGLISH' : 'ENGLISH → MEANING'}
          </span>
          <span>{revealed ? 'ANSWER REVEALED' : 'TAKE YOUR TIME'}</span>
        </div>
        <div className="review-card-question">
          <p className="review-prompt">
            {translationFirst ? 'Recall the English word' : t.review.prompt}
          </p>
          {template.front === 'translation' && !translationFirst ? (
            <p className="text-xs text-muted">No translation saved. Showing English first.</p>
          ) : null}
          <div className="review-term-row">
            <p className="review-term">{translationFirst ? card.translation : card.term}</p>
            {!translationFirst ? (
              <SpeakButton
                key={card.cardId}
                text={card.term}
                kind="term"
                label={t.speech.term(card.term)}
                shortcut="KeyP"
              />
            ) : null}
          </div>
          {template.showContext && !translationFirst && !revealed ? (
            <ReviewContext card={card} />
          ) : null}
        </div>
        {revealed ? (
          <div
            className={`review-answer ${template.showImage && image ? 'review-answer-with-image' : ''}`}
            aria-live="polite"
          >
            <div className="review-answer-copy">
              <p className="review-answer-label">
                <Icon name="check" width="13" height="13" />
                THE OTHER SIDE
              </p>
              {translationFirst ? (
                <div className="review-answer-term-row">
                  <p className="review-answer-term">{card.term}</p>
                  <SpeakButton
                    key={card.cardId}
                    text={card.term}
                    kind="term"
                    label={t.speech.term(card.term)}
                    shortcut="KeyP"
                  />
                </div>
              ) : card.translation ? (
                <p className="review-answer-term">{card.translation}</p>
              ) : null}
              {template.showDefinition && card.definition ? (
                <p className="review-definition">{card.definition}</p>
              ) : null}
              {template.showContext ? <ReviewContext card={card} /> : null}
            </div>
            {template.showImage && image ? (
              <WordPicture
                wordId={card.wordId}
                term={card.term}
                image={image}
                className="review-answer-picture"
              />
            ) : null}
          </div>
        ) : null}
      </Card>
      {detailsOpen ? (
        <ReviewDetails
          card={card}
          image={image}
          template={template}
          onClose={() => setDetailsOpen(false)}
        />
      ) : null}

      {translationFirst && !revealed ? null : picking ? (
        <div className="review-image-picker">
          <ImagePicker
            key={card.wordId}
            wordId={card.wordId}
            term={card.term}
            current={image}
            onChange={(next) => {
              setImages((all) => ({ ...all, [card.wordId]: next }));
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />
        </div>
      ) : (
        <div className="review-card-tools">
          <Button
            variant="secondary"
            size="sm"
            className="review-picture-button"
            aria-expanded={false}
            onClick={() => setPicking(true)}
          >
            <Icon name="image" width="15" height="15" />
            {image ? t.images.change : t.images.add}
          </Button>
          {revealed ? (
            <button
              type="button"
              className="review-more-details"
              onClick={() => setDetailsOpen(true)}
            >
              View full card <Icon name="arrow" width="13" height="13" />
            </button>
          ) : null}
        </div>
      )}

      {revealed ? (
        <div className="review-rating-section">
          <p>How well did you remember?</p>
          <div className="review-ratings" role="group" aria-label={t.review.title}>
            {REVIEW_RATINGS.map((rating, i) => (
              <button
                key={rating}
                type="button"
                disabled={submit.isPending}
                onClick={() => rate(rating)}
                className={`review-rating rating-${rating}`}
              >
                <span className="rating-name">
                  {t.review.ratings[rating]} <Kbd>{i + 1}</Kbd>
                </span>
                <span className="rating-hint">{RATING_HINT[rating]}</span>
                <span className="rating-interval">
                  {formatInterval(now, new Date(card.nextDue[rating]))}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Button size="lg" className="review-reveal-button" onClick={() => setRevealed(true)}>
          <span>
            {t.review.showAnswer}
            <Icon name="arrow" width="18" height="18" />
          </span>
          <Kbd>Space</Kbd>
        </Button>
      )}
      {submit.isError ? <Alert tone="danger">{t.review.saveFailed}</Alert> : null}
      <p className="review-session-note">
        {revealed
          ? 'There is no perfect score. Just be honest with yourself.'
          : 'Try to remember first. A little effort helps the word stay.'}
      </p>
    </div>
  );
}

function ReviewDetails({
  card,
  image,
  template,
  onClose,
}: {
  card: ReviewCard;
  image: WordImage | null;
  template: ReviewTemplate;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="review-details-dialog"
      aria-label="Full review card"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div>
        <header>
          <p className="eyebrow">YOUR WORD, IN CONTEXT</p>
          <button type="button" onClick={onClose} aria-label="Close full card">
            <Icon name="close" />
          </button>
        </header>
        <h2>{card.term}</h2>
        {card.translation ? <p className="review-answer-term">{card.translation}</p> : null}
        {template.showDefinition && card.definition ? (
          <p className="review-definition">{card.definition}</p>
        ) : null}
        {template.showContext ? <ReviewContext card={card} /> : null}
        {template.showImage && image ? (
          <WordPicture wordId={card.wordId} term={card.term} image={image} />
        ) : null}
      </div>
    </dialog>
  );
}
