'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MistakeEntrySchema, MistakeListSchema, type MistakeEntry } from '@lingoup/contracts';
import { Alert, Button, Card, SelectField, Skeleton } from '@lingoup/ui';
import { api } from '@/lib/api-client';
import { useRequireUser } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { VocabularyIcon as Icon } from '@/components/vocabulary-icon';

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
  const total = counts ? counts.open + counts.resolved : 0;
  const understood = total && counts ? Math.round((counts.resolved / total) * 100) : 0;
  const filtered = source !== '' || category !== '' || status !== 'open';
  function resetFilters() {
    setSource('');
    setCategory('');
    setStatus('open');
  }
  return (
    <div className="mistakes-workspace">
      <header className="mistakes-heading">
        <div>
          <p className="eyebrow">
            <Icon name="spark" width="13" height="13" /> SMALL CORRECTIONS. STRONGER ENGLISH.
          </p>
          <h1>
            Mistake journal
            <span aria-hidden="true" className="text-primary">
              .
            </span>
          </h1>
          <p>Notice the pattern. Understand the rule. Make your next attempt a little better.</p>
          <p className="mistakes-counts" role="status">
            {counts
              ? `${counts.open} to review · ${counts.resolved} understood`
              : journal.isError
                ? 'Could not load your journal.'
                : 'Loading your journal…'}
          </p>
        </div>
        <div
          className="mistakes-progress"
          style={{ '--understood': `${understood}%` } as CSSProperties}
        >
          <div
            className="mistakes-progress-ring"
            role="img"
            aria-label={
              counts
                ? total
                  ? `${understood}% of entries marked as understood`
                  : 'No entries yet'
                : journal.isError
                  ? 'Journal statistics unavailable'
                  : 'Loading journal statistics'
            }
          >
            <span>
              {counts && total ? `${understood}%` : <Icon name="book" width="23" height="23" />}
            </span>
          </div>
          <div>
            <p className="eyebrow">YOUR LEARNING, IN FOCUS</p>
            <h2>{counts && total ? 'One step clearer.' : 'Room to grow.'}</h2>
            <p>
              {counts
                ? `${total} ${total === 1 ? 'entry' : 'entries'} in your journal`
                : 'Your personal learning journal'}
            </p>
            <span>Progress through understanding.</span>
          </div>
        </div>
      </header>
      <Card className="mistakes-toolbar">
        <div className="mistakes-filters">
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
        <div className="mistakes-toolbar-footer">
          <label className="mistakes-practice-switch">
            <input
              type="checkbox"
              checked={practice}
              onChange={(event) => setPractice(event.target.checked)}
            />
            <span>Hide corrections to practise first</span>
          </label>
          <span>
            {practice
              ? 'Try it yourself, then reveal the answer.'
              : 'Read, reflect, and try again.'}
          </span>
          {filtered ? (
            <button type="button" onClick={resetFilters}>
              <Icon name="close" width="12" height="12" />
              Reset filters
            </button>
          ) : null}
        </div>
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
        <>
          <div className="mistakes-list-heading">
            <p className="eyebrow">
              <span className="status-dot" />
              {status === 'open'
                ? 'A LITTLE PRACTICE GOES A LONG WAY'
                : status === 'resolved'
                  ? 'LESSONS YOU HAVE TAKEN WITH YOU'
                  : 'EVERY CORRECTION, ONE PLACE'}
            </p>
            <span>
              {items.length}
              {journal.hasNextPage ? '+' : ''} {items.length === 1 ? 'entry' : 'entries'} shown
            </span>
          </div>
          <ul className="mistakes-list" aria-label="Journal entries">
            {items.map((entry) => (
              <li key={entry.id}>
                <Card
                  className="mistake-entry"
                  data-category={entry.category}
                  data-resolved={Boolean(entry.resolvedAt)}
                >
                  <header className="mistake-entry-header">
                    <div>
                      <span className="mistake-source">
                        <Icon
                          name={
                            entry.source === 'writing'
                              ? 'edit'
                              : entry.source === 'speaking'
                                ? 'mic'
                                : 'book'
                          }
                          width="13"
                          height="13"
                        />
                        {entry.source}
                      </span>
                      <span className="mistake-category">
                        {entry.category === 'suggestion'
                          ? 'Style suggestion'
                          : entry.category === 'word'
                            ? 'Word correction'
                            : 'Grammar'}
                      </span>
                      {entry.errorType ? (
                        <span className="mistake-type">{entry.errorType.replaceAll('_', ' ')}</span>
                      ) : null}
                    </div>
                    <span className="mistake-entry-status">
                      {entry.resolvedAt ? (
                        <Icon name="check" width="11" height="11" />
                      ) : (
                        <span className="mistake-status-dot" />
                      )}
                      {entry.resolvedAt ? 'Understood' : 'To review'}
                      <time dateTime={entry.createdAt}>{entry.createdAt.slice(0, 10)}</time>
                    </span>
                  </header>
                  <div className="mistake-comparison">
                    <div className="mistake-original">
                      <p className="eyebrow">YOUR PHRASE</p>
                      <p lang="en">{entry.original}</p>
                      <span>
                        {entry.category === 'suggestion'
                          ? 'A chance to make it sound more natural.'
                          : 'A small detail worth another look.'}
                      </span>
                    </div>
                    <details
                      key={`${entry.id}:${practice}`}
                      open={!practice}
                      className="mistake-answer"
                    >
                      <summary>
                        Correction and rule
                        <Icon name="chevron" width="13" height="13" />
                      </summary>
                      <div className="mistake-answer-body">
                        <p className="eyebrow">
                          {entry.category === 'suggestion'
                            ? 'OPTIONAL REWRITE'
                            : 'CORRECTED PHRASE'}
                        </p>
                        <p lang="en" className="mistake-corrected">
                          {entry.corrected || '(Remove this fragment)'}
                        </p>
                        <p className="mistake-explanation">{entry.explanation}</p>
                        {entry.example ? (
                          <p className="mistake-example">
                            <span>EXAMPLE</span>
                            <span lang="en">{entry.example}</span>
                          </p>
                        ) : null}
                        {entry.alternatives.length ? (
                          <div className="mistake-alternatives">
                            <h3>Other possible meanings</h3>
                            {entry.alternatives.map((alternative, index) => (
                              <p key={index}>
                                <strong lang="en">{alternative.replacement}</strong>
                                <span>{alternative.meaning}</span>
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </div>
                  {entry.context ? (
                    <details className="mistake-context">
                      <summary>
                        <Icon name="cards" width="12" height="12" />
                        View original context
                        <Icon name="chevron" width="12" height="12" />
                      </summary>
                      <p>{entry.context}</p>
                    </details>
                  ) : null}
                  <footer className="mistake-entry-footer">
                    <Link href={entry.sourceHref}>
                      Practise {entry.source}
                      <Icon name="arrow" width="13" height="13" />
                    </Link>
                    <Button
                      size="sm"
                      variant={entry.resolvedAt ? 'secondary' : 'primary'}
                      disabled={update.isPending}
                      loading={update.isPending && update.variables.id === entry.id}
                      onClick={() => update.mutate(entry)}
                    >
                      {entry.resolvedAt ? (
                        <Icon name="clock" width="12" height="12" />
                      ) : (
                        <Icon name="check" width="12" height="12" />
                      )}
                      {entry.resolvedAt ? 'Review again' : 'Mark as understood'}
                    </Button>
                  </footer>
                </Card>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Card className="mistakes-empty">
          <div className="mistakes-empty-art" aria-hidden="true">
            <Icon name={filtered ? 'search' : 'check'} width="30" height="30" />
            <span />
            <span />
          </div>
          <p className="eyebrow">
            {filtered ? 'A DIFFERENT VIEW' : 'EVERY ATTEMPT TEACHES YOU SOMETHING'}
          </p>
          <h2>{filtered ? 'No matching entries' : 'No mistakes to review'}</h2>
          <p>
            {filtered
              ? 'There are no corrections for these filters. Try another source, status, or correction type.'
              : counts?.resolved
                ? 'You have reviewed every open correction. Keep practising, or revisit what you have already learned.'
                : 'Your checked Grammar, Writing and Speaking corrections will find a home here. Start a little practice and come back to reflect.'}
          </p>
          {filtered ? (
            <Button variant="secondary" onClick={resetFilters}>
              Clear filters
            </Button>
          ) : (
            <div className="mistakes-empty-actions">
              <Link href="/grammar">
                <Icon name="book" width="14" height="14" />
                Practise grammar
                <Icon name="arrow" width="13" height="13" />
              </Link>
              <Link href="/writing">
                <Icon name="edit" width="14" height="14" />
                Try writing
                <Icon name="arrow" width="13" height="13" />
              </Link>
              {counts?.resolved ? (
                <button type="button" onClick={() => setStatus('resolved')}>
                  View understood entries
                  <Icon name="arrow" width="13" height="13" />
                </button>
              ) : null}
            </div>
          )}
        </Card>
      )}
      {journal.hasNextPage ? (
        <div className="mistakes-pagination">
          <Button
            variant="secondary"
            loading={journal.isFetchingNextPage}
            onClick={() => void journal.fetchNextPage()}
          >
            Load more
            <Icon name="chevron" width="13" height="13" />
          </Button>
        </div>
      ) : null}
      <details className="mistakes-about">
        <summary>
          <Icon name="spark" width="13" height="13" />
          About your mistake journal
          <Icon name="chevron" width="13" height="13" />
        </summary>
        <p>
          New corrections are saved automatically from assessed Writing, checked Grammar answers,
          and Speaking turns. Demo AI feedback is excluded. Style suggestions are labelled
          separately. Mark an entry as understood when the correction makes sense to you. You can
          reopen it any time. Marking entries as understood does not award XP.
        </p>
      </details>
    </div>
  );
}
