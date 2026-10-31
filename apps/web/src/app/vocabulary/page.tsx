'use client';

import {
  ProgressSummarySchema,
  WordPageSchema,
  WordCategoryCountsSchema,
  WORD_CATEGORIES,
  WORD_CATEGORY_LABELS,
  type Word,
  type WordCategory,
} from '@lingoup/contracts';
import { Alert, Badge, Button, Card, EmptyState, Skeleton, buttonClasses } from '@lingoup/ui';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { ImagePicker } from '@/components/image-picker';
import { VocabularyWordForm } from '@/components/vocabulary-word-form';
import { ReviewTemplateSettings } from '@/components/review-template-settings';
import { VocabularyIcon as Icon } from '@/components/vocabulary-icon';
import { PracticeTimer } from '@/components/practice-timer';
import { SpeakButton } from '@/components/speak-button';
import { DUE_COUNT_QUERY_KEY } from '@/components/site-header';
import { wordImageUrl } from '@/components/word-picture';
import { t } from '@/i18n';
import { api } from '@/lib/api-client';
import { useRequireUser } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

const STATE_TONE = {
  new: 'info',
  learning: 'warning',
  review: 'success',
  relearning: 'danger',
} as const;

export default function VocabularyPage() {
  const { user, isLoading: authLoading } = useRequireUser();
  const [editing, setEditing] = useState<Word | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<WordCategory | 'all'>('all');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [notice, setNotice] = useState('');
  const q = useDeferredValue(search.trim());
  const queryClient = useQueryClient();
  const [pickingId, setPickingId] = useState<string | null>(null);
  const stats = useQuery({
    queryKey: ['progress', 'summary', user?.id],
    enabled: !authLoading,
    queryFn: () => api('/v1/progress/summary', { schema: ProgressSummarySchema }),
  });
  const words = useInfiniteQuery({
    queryKey: ['words', q, category],
    enabled: !authLoading,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.set('cursor', pageParam);
      if (q) params.set('q', q);
      if (category !== 'all') params.set('category', category);
      return api(`/v1/vocabulary/words?${params.toString()}`, { schema: WordPageSchema, signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const remove = useMutation({
    mutationFn: (word: Word) => api(`/v1/vocabulary/words/${word.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['words'] });
      void queryClient.invalidateQueries({ queryKey: ['word-categories'] });
      void queryClient.invalidateQueries({ queryKey: ['progress', 'summary'] });
      void queryClient.invalidateQueries({ queryKey: DUE_COUNT_QUERY_KEY });
      setNotice('Word removed from your vocabulary.');
    },
  });
  const items = words.data?.pages.flatMap((page) => page.items) ?? [];
  const categories = useQuery({
    queryKey: ['word-categories', user?.id],
    enabled: !authLoading,
    queryFn: () => api('/v1/vocabulary/categories', { schema: WordCategoryCountsSchema }),
  });
  const vocabulary = stats.data?.vocabulary;

  return (
    <div className="vocabulary-workspace">
      <header className="vocabulary-heading">
        <div>
          <p className="eyebrow">
            <Icon name="book" width="14" height="14" /> YOUR PERSONAL WORD COLLECTION
          </p>
          <h1>
            My vocabulary<span className="text-primary">.</span>
          </h1>
          <p className="vocabulary-subtitle">A little more English, one word at a time.</p>
        </div>
        <div className="vocabulary-heading-actions">
          <Button
            className="vocabulary-add-button"
            onClick={() => setEditing('new')}
            disabled={authLoading}
          >
            + Add word
          </Button>
          <Link href="/review" className="vocabulary-mobile-review">
            Review words <Icon name="arrow" width="16" height="16" />
          </Link>
        </div>
      </header>
      <div className="vocabulary-stats" aria-label="Vocabulary overview">
        {(
          [
            ['book', vocabulary?.total, 'Words collected', 'Your growing collection'],
            ['cards', vocabulary?.dueNow, 'Ready for review', 'Keep them fresh in your memory'],
            ['check', vocabulary?.totalReviews, 'Reviews completed', 'Small steps that add up'],
          ] as const
        ).map(([icon, count, title, description]) => (
          <div key={title} className="vocabulary-stat">
            <span className={`vocabulary-stat-icon stat-${icon}`}>
              <Icon name={icon} />
            </span>
            <div>
              <div className="vocabulary-stat-value">
                <strong>{count ?? '—'}</strong>
                <span>{title}</span>
              </div>
              <p>{description}</p>
            </div>
          </div>
        ))}
      </div>
      {!authLoading && user ? (
        <ReviewTemplateSettings key={user.id} saved={user.settings.reviewTemplate} />
      ) : null}
      {editing ? (
        <VocabularyWordForm
          key={editing === 'new' ? 'new' : editing.id}
          {...(editing === 'new' ? {} : { word: editing })}
          {...(category !== 'all' ? { defaultCategory: category } : {})}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setSearch('');
            setCategory('all');
            setNotice(
              editing === 'new'
                ? 'Word added. Make it part of your everyday.'
                : 'Your word has been updated.',
            );
          }}
        />
      ) : null}

      <div className="vocabulary-body">
        <section className="vocabulary-collection" aria-labelledby="collection-title">
          <div className="collection-heading">
            <h2 id="collection-title">
              Your words <span>{categories.data?.total ?? vocabulary?.total ?? '…'}</span>
            </h2>
            <span>Keep the words. Find your voice.</span>
          </div>
          <div className="vocabulary-category-section">
            <p>
              CATEGORIES <span>Grouped automatically. Change a category with Edit.</span>
            </p>
            <nav className="vocabulary-category-tabs" aria-label="Vocabulary categories">
              <button
                type="button"
                aria-pressed={category === 'all'}
                onClick={() => setCategory('all')}
              >
                All words <span>{categories.data?.total ?? '…'}</span>
              </button>
              {WORD_CATEGORIES.filter(
                (value) =>
                  (categories.data?.items.find((item) => item.category === value)?.count ?? 0) >
                    0 ||
                  value === category ||
                  ['clothes', 'food', 'travel'].includes(value),
              ).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={category === value}
                  onClick={() => setCategory(value)}
                >
                  {WORD_CATEGORY_LABELS[value]}
                  <span>
                    {categories.data?.items.find((item) => item.category === value)?.count ?? 0}
                  </span>
                </button>
              ))}
            </nav>
            {categories.isError ? (
              <p role="alert">
                Categories could not be loaded.{' '}
                <button type="button" onClick={() => void categories.refetch()}>
                  Try again
                </button>
              </p>
            ) : null}
          </div>
          <div className="vocabulary-toolbar">
            <div className="vocabulary-search">
              <Icon name="search" />
              <label className="sr-only" htmlFor="vocabulary-search">
                {t.vocabulary.search}
              </label>
              <input
                id="vocabulary-search"
                type="search"
                placeholder="Find a word in your collection…"
                value={search}
                maxLength={80}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="vocabulary-view-switch" role="group" aria-label="Collection view">
              <button
                type="button"
                aria-label="List view"
                title="List view"
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                <Icon name="list" width="18" height="18" />
              </button>
              <button
                type="button"
                aria-label="Grid view"
                title="Grid view"
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              >
                <Icon name="grid" width="18" height="18" />
              </button>
            </div>
          </div>
          <div className="collection-meta">
            <span>
              {q
                ? `Results for “${q}”`
                : category === 'all'
                  ? 'All saved words'
                  : WORD_CATEGORY_LABELS[category]}
            </span>
            <span>
              Newest first <span aria-hidden="true">↓</span>
            </span>
          </div>
          {notice ? (
            <div className="vocabulary-notice" role="status">
              <Icon name="check" width="16" height="16" />
              <span>{notice}</span>
              <button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}>
                <Icon name="close" width="14" height="14" />
              </button>
            </div>
          ) : null}
          {remove.isError ? <Alert tone="danger">{describeError(remove.error)}</Alert> : null}
          {authLoading || words.isPending ? (
            <div className="space-y-3" aria-busy="true">
              <span className="sr-only">{t.common.loading}</span>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : words.isError ? (
            <Alert
              tone="danger"
              action={
                <Button variant="secondary" size="sm" onClick={() => void words.refetch()}>
                  {t.common.retry}
                </Button>
              }
            >
              {describeError(words.error)}
            </Alert>
          ) : items.length === 0 ? (
            <div className="vocabulary-empty">
              <span className="vocabulary-empty-icon">
                <Icon name={q ? 'search' : 'book'} width="32" height="32" />
              </span>
              <EmptyState
                title={
                  q
                    ? 'No words found'
                    : category !== 'all'
                      ? `No words in ${WORD_CATEGORY_LABELS[category]} yet`
                      : 'Your next favourite word starts here'
                }
                action={
                  q ? (
                    <Button variant="secondary" onClick={() => setSearch('')}>
                      Clear search
                    </Button>
                  ) : (
                    <Button onClick={() => setEditing('new')}>
                      {category === 'all'
                        ? '+ Add your first word'
                        : '+ Add a word to this category'}
                    </Button>
                  )
                }
              >
                {q
                  ? 'Try another English word or a shorter search.'
                  : 'Add a word you want to remember, or discover one in the text library.'}
              </EmptyState>
            </div>
          ) : (
            <ul className={`vocabulary-words vocabulary-words-${view}`}>
              {items.map((word) => {
                const due = Date.parse(word.card.due) <= words.dataUpdatedAt;
                return (
                  <li key={word.id}>
                    <Card className="vocabulary-word">
                      <div className="word-card-heading">
                        {word.image ? (
                          <img
                            src={wordImageUrl(word.id, word.image)}
                            alt=""
                            className="word-thumbnail"
                          />
                        ) : (
                          <span
                            className={`word-letter letter-${word.card.state}`}
                            aria-hidden="true"
                          >
                            {word.term.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="word-title">
                          <div>
                            <h2>{word.term}</h2>
                            <SpeakButton
                              text={word.term}
                              kind="term"
                              label={t.speech.term(word.term)}
                            />
                          </div>
                          <p>{word.translation || 'Add a translation to make it yours'}</p>
                        </div>
                        <Badge tone={STATE_TONE[word.card.state]}>
                          {t.vocabulary.states[word.card.state]}
                        </Badge>
                      </div>
                      {word.definition ? (
                        <p className="word-definition">{word.definition}</p>
                      ) : null}
                      {word.contextSentence ? (
                        <blockquote className="word-example">“{word.contextSentence}”</blockquote>
                      ) : null}
                      {word.note ? <p className="word-note">{word.note}</p> : null}
                      <div className="word-card-footer">
                        <div className="word-meta">
                          <span className="word-category-label">
                            {WORD_CATEGORY_LABELS[word.category]}
                          </span>
                          <span className={due ? 'word-due' : ''}>
                            <span className="word-status-dot" />
                            {due
                              ? 'Ready to review'
                              : t.vocabulary.due(formatDateTime(word.card.due))}
                          </span>
                          {word.sourceTextSlug ? (
                            <Link href={`/read/${word.sourceTextSlug}`}>
                              {t.vocabulary.fromText} ↗
                            </Link>
                          ) : null}
                        </div>
                        <div className="word-actions">
                          <button
                            type="button"
                            onClick={() => setEditing(word)}
                            aria-label={`Edit: ${word.term}`}
                            title="Edit word"
                          >
                            <Icon name="edit" width="16" height="16" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            aria-label={word.image ? t.images.change : t.images.add}
                            title={word.image ? t.images.change : t.images.add}
                            aria-expanded={pickingId === word.id}
                            onClick={() => setPickingId(pickingId === word.id ? null : word.id)}
                          >
                            <Icon name="image" width="16" height="16" />
                            <span>Picture</span>
                          </button>
                          <button
                            type="button"
                            className="word-delete"
                            disabled={remove.isPending && remove.variables.id === word.id}
                            onClick={() => {
                              if (window.confirm(t.vocabulary.confirmDelete(word.term)))
                                remove.mutate(word);
                            }}
                            aria-label={`${t.common.delete}: ${word.term}`}
                            title="Delete word"
                          >
                            <Icon name="trash" width="16" height="16" />
                          </button>
                        </div>
                      </div>
                      {pickingId === word.id ? (
                        <ImagePicker
                          wordId={word.id}
                          term={word.term}
                          current={word.image}
                          onChange={() => {
                            setPickingId(null);
                            void queryClient.invalidateQueries({ queryKey: ['words'] });
                          }}
                          onClose={() => setPickingId(null)}
                        />
                      ) : null}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
          {words.hasNextPage ? (
            <Button
              variant="secondary"
              className="mt-5 w-full"
              loading={words.isFetchingNextPage}
              onClick={() => void words.fetchNextPage()}
            >
              {t.vocabulary.loadMore}
            </Button>
          ) : null}
        </section>
        <aside className="vocabulary-sidebar" aria-label="Your practice space">
          <div className="vocabulary-review-card">
            <div className="review-card-top">
              <span className="eyebrow">A LITTLE PRACTICE, EVERY DAY</span>
              <Icon name="spark" />
            </div>
            <div className="review-card-art" aria-hidden="true">
              <span className="mini-flashcard mini-flashcard-back">Hello.</span>
              <span className="mini-flashcard mini-flashcard-front">
                Aa<span>↗</span>
              </span>
            </div>
            <h2>Make it stick.</h2>
            <p>
              {vocabulary?.dueNow
                ? `${vocabulary.dueNow} ${vocabulary.dueNow === 1 ? 'word is' : 'words are'} ready for a little refresh. Your future self will thank you.`
                : 'A few minutes of practice today. A little more confidence tomorrow.'}
            </p>
            <Link href="/review" className={buttonClasses('primary', 'md', 'w-full')}>
              Start review <Icon name="arrow" width="17" height="17" />
            </Link>
            <Link href="/vocabulary/practice" className="vocabulary-practice-link">
              {t.practice.vocabularyLink}
              <Icon name="arrow" width="15" height="15" />
            </Link>
          </div>
          <div className="vocabulary-focus">
            <div className="focus-eyebrow">
              <Icon name="clock" width="15" height="15" />
              <span>MAKE A LITTLE TIME</span>
            </div>
            <PracticeTimer skill="vocabulary" />
          </div>
          <div className="vocabulary-discover">
            <span>
              <Icon name="book" />
            </span>
            <h3>Find words in the wild.</h3>
            <p>A good story is a great place to grow your vocabulary.</p>
            <Link href="/library">
              Explore the text library <Icon name="arrow" width="15" height="15" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
