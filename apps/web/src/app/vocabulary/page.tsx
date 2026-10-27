'use client';

import { WordPageSchema, type Word } from '@lingoup/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  TextField,
  buttonClasses,
} from '@lingoup/ui';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { DUE_COUNT_QUERY_KEY } from '@/components/site-header';
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
  const { isLoading: authLoading } = useRequireUser();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const queryClient = useQueryClient();

  const words = useInfiniteQuery({
    queryKey: ['words', q],
    enabled: !authLoading,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.set('cursor', pageParam);
      if (q) params.set('q', q);
      return api(`/v1/vocabulary/words?${params.toString()}`, { schema: WordPageSchema, signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const remove = useMutation({
    mutationFn: (word: Word) => api(`/v1/vocabulary/words/${word.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['words'] });
      void queryClient.invalidateQueries({ queryKey: DUE_COUNT_QUERY_KEY });
    },
  });

  const items = words.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{t.vocabulary.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/vocabulary/practice" className={buttonClasses('secondary')}>
            {t.practice.vocabularyLink}
          </Link>
          <Link href="/review" className={buttonClasses('primary')}>
            {t.nav.review}
          </Link>
        </div>
      </header>
      <div className="max-w-md">
        <TextField
          label={t.vocabulary.search}
          type="search"
          placeholder={t.vocabulary.searchPlaceholder}
          value={search}
          maxLength={80}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {remove.isError ? <Alert tone="danger">{describeError(remove.error)}</Alert> : null}

      {authLoading || words.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <span className="sr-only">{t.common.loading}</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
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
        <EmptyState
          title={q ? t.vocabulary.notFound : t.vocabulary.empty}
          action={
            q ? undefined : (
              <Link href="/library" className={buttonClasses('primary')}>
                {t.nav.library}
              </Link>
            )
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((word) => (
            <li key={word.id}>
              <Card className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-lg font-semibold">{word.term}</h2>
                    {word.translation ? (
                      <span className="text-muted">{word.translation}</span>
                    ) : null}
                    <Badge tone={STATE_TONE[word.card.state]}>
                      {t.vocabulary.states[word.card.state]}
                    </Badge>
                  </div>
                  {word.definition ? <p className="text-sm">{word.definition}</p> : null}
                  {word.contextSentence ? (
                    <p className="font-reading text-sm text-muted italic">
                      “{word.contextSentence}”
                    </p>
                  ) : null}
                  <p className="text-xs text-muted">
                    {Date.parse(word.card.due) <= words.dataUpdatedAt
                      ? t.vocabulary.dueNow
                      : t.vocabulary.due(formatDateTime(word.card.due))}
                    {word.sourceTextSlug ? (
                      <>
                        {' · '}
                        <Link href={`/read/${word.sourceTextSlug}`} className="underline">
                          {t.vocabulary.fromText}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  className="self-end sm:self-start"
                  loading={remove.isPending && remove.variables.id === word.id}
                  onClick={() => {
                    if (window.confirm(t.vocabulary.confirmDelete(word.term))) remove.mutate(word);
                  }}
                  aria-label={`${t.common.delete}: ${word.term}`}
                >
                  {t.common.delete}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {words.hasNextPage ? (
        <Button
          variant="secondary"
          className="self-center"
          loading={words.isFetchingNextPage}
          onClick={() => void words.fetchNextPage()}
        >
          {t.vocabulary.loadMore}
        </Button>
      ) : null}
    </div>
  );
}
