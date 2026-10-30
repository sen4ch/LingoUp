'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MistakeEntrySchema, MistakeListSchema, type MistakeEntry } from '@lingoup/contracts';
import { Alert, Button, Card, EmptyState, SelectField, Skeleton } from '@lingoup/ui';
import { api } from '@/lib/api-client';
import { useRequireUser } from '@/lib/auth';
import { describeError } from '@/lib/errors';

export default function MistakesPage() {
  const { user, isLoading } = useRequireUser();
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('open');
  const [category, setCategory] = useState('');
  const [practice, setPractice] = useState(false);
  const client = useQueryClient();
  const journal = useInfiniteQuery({
    queryKey: ['mistakes', user?.id, source, status, category],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ status, limit: '20' });
      if (source) params.set('source', source);
      if (category) params.set('category', category);
      if (pageParam) params.set('cursor', pageParam);
      return api(`/v1/progress/mistakes?${params}`, { schema: MistakeListSchema, signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !isLoading && Boolean(user),
    staleTime: 0,
  });
  const update = useMutation({
    mutationFn: (entry: MistakeEntry) =>
      api(`/v1/progress/mistakes/${entry.id}`, {
        method: 'PATCH',
        body: { resolved: !entry.resolvedAt },
        schema: MistakeEntrySchema,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['mistakes', user?.id] });
    },
  });
  if (isLoading || !user) return <Skeleton className="h-96" />;
  const items = journal.data?.pages.flatMap((page) => page.items) ?? [];
  const counts = journal.data?.pages[0]?.counts;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Mistake journal</h1>
        <p className="max-w-3xl text-muted">
          Learn from your Writing, Grammar and Speaking corrections. Review the rule, try the phrase
          again, and mark it as understood when you are ready.
        </p>
        {counts ? (
          <p className="text-sm font-medium">
            {counts.open} to review · {counts.resolved} understood
          </p>
        ) : null}
        <p className="text-xs text-muted">
          New corrections are saved automatically. Demo AI feedback is excluded. Style suggestions
          are labelled separately. Marking an entry as understood does not award XP.
        </p>
      </header>
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            options={[
              { value: '', label: 'All sections' },
              { value: 'writing', label: 'Writing' },
              { value: 'grammar', label: 'Grammar' },
              { value: 'speaking', label: 'Speaking' },
            ]}
          />
          <SelectField
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { value: 'open', label: 'To review' },
              { value: 'resolved', label: 'Understood' },
              { value: 'all', label: 'All entries' },
            ]}
          />
          <SelectField
            label="Correction type"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            options={[
              { value: '', label: 'All types' },
              { value: 'grammar', label: 'Grammar' },
              { value: 'word', label: 'Spelling and word choice' },
              { value: 'suggestion', label: 'Style suggestions' },
            ]}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={practice}
            onChange={(event) => setPractice(event.target.checked)}
            className="accent-primary"
          />
          Hide corrections to practise first
        </label>
      </Card>
      {update.isError ? <Alert tone="danger">{describeError(update.error)}</Alert> : null}
      {journal.isPending ? (
        <Skeleton className="h-48" />
      ) : journal.isError ? (
        <Alert tone="danger">
          {describeError(journal.error)}{' '}
          <Button variant="secondary" onClick={() => void journal.refetch()}>
            Retry
          </Button>
        </Alert>
      ) : items.length ? (
        <ul className="space-y-4">
          {items.map((entry) => (
            <li key={entry.id}>
              <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold capitalize">{entry.source}</span>
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${entry.category === 'word' ? 'bg-red-100 text-red-900' : entry.category === 'grammar' ? 'bg-yellow-100 text-yellow-950' : 'bg-blue-100 text-blue-950'}`}
                    >
                      {entry.category === 'suggestion'
                        ? 'Style suggestion'
                        : entry.category === 'word'
                          ? 'Word correction'
                          : 'Grammar'}
                    </span>
                    {entry.errorType ? (
                      <span className="text-muted capitalize">
                        {entry.errorType.replaceAll('_', ' ')}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted">
                    {entry.createdAt.slice(0, 10)} · {entry.resolvedAt ? 'Understood' : 'To review'}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-muted">{entry.context}</p>
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted">Your phrase</p>
                  <p lang="en" className="font-reading text-lg whitespace-pre-wrap wrap-break-word">
                    {entry.original}
                  </p>
                </div>
                <details key={`${entry.id}:${practice}`} open={!practice} className="space-y-3">
                  <summary className="cursor-pointer text-sm font-semibold text-primary">
                    Correction and rule
                  </summary>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted">Corrected phrase</p>
                    <p
                      lang="en"
                      className="font-reading text-lg whitespace-pre-wrap text-primary wrap-break-word"
                    >
                      {entry.corrected || '(Remove this fragment)'}
                    </p>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{entry.explanation}</p>
                  {entry.example ? (
                    <p className="text-sm">
                      <strong>Example: </strong>
                      {entry.example}
                    </p>
                  ) : null}
                  {entry.alternatives.length ? (
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold">Other possible meanings</p>
                      {entry.alternatives.map((alternative, index) => (
                        <p key={index}>
                          <strong>{alternative.replacement}</strong> — {alternative.meaning}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </details>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link className="text-sm text-primary underline" href={entry.sourceHref}>
                    Practise {entry.source}
                  </Link>
                  <Button
                    size="sm"
                    variant={entry.resolvedAt ? 'secondary' : 'primary'}
                    disabled={update.isPending}
                    onClick={() => update.mutate(entry)}
                  >
                    {entry.resolvedAt ? 'Review again' : 'Mark as understood'}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={
            status === 'open' && !source && !category
              ? 'No mistakes to review'
              : 'No matching entries'
          }
        >
          New corrections will appear here after checked grammar answers, assessed writing replies
          or speaking turns. Try changing the filters to see other entries.
        </EmptyState>
      )}
      {journal.hasNextPage ? (
        <Button
          variant="secondary"
          loading={journal.isFetchingNextPage}
          onClick={() => void journal.fetchNextPage()}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
