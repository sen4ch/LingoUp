'use client';

import {
  CEFR_LEVELS,
  GenerateTextResponseSchema,
  MyTextsResponseSchema,
  WordPageSchema,
  type CefrLevel,
  type GenerateTextResponse,
  type TextSummary,
  type Word,
  type WordPage,
} from '@lingoup/contracts';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  LevelBadge,
  SelectField,
  Skeleton,
  Spinner,
  TextField,
  buttonClasses,
} from '@lingoup/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type SyntheticEvent } from 'react';
import { t } from '@/i18n';
import { ApiRequestError, api } from '@/lib/api-client';
import { useRequireUser } from '@/lib/auth';
import { describeError } from '@/lib/errors';

const MY_TEXTS_QUERY_KEY = ['my-texts'] as const;

/** Maps generation failures to actionable messages (missing words, AI policy, AI outage). */
function describeGenerationError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === 'NOT_ENOUGH_WORDS') return t.myTexts.notEnoughWords;
    if (error.code === 'AI_UNAVAILABLE') {
      const details = error.details as { aiStatus?: unknown } | undefined;
      const status = typeof details?.aiStatus === 'string' ? details.aiStatus : 'unavailable';
      return t.myTexts.aiErrors[status] ?? t.myTexts.aiErrors.unavailable ?? t.common.error;
    }
  }
  return describeError(error);
}

function GenerateForm({ defaultLevel }: { defaultLevel: CefrLevel }) {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<CefrLevel>(defaultLevel);
  const [topic, setTopic] = useState('');
  const [wordMode, setWordMode] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const vocabulary = useQuery({
    queryKey: ['generation-vocabulary'],
    queryFn: async ({ signal }) => {
      const words: Word[] = [];
      let cursor: string | null = null;
      do {
        const params: URLSearchParams = new URLSearchParams({
          limit: '100',
          ...(cursor ? { cursor } : {}),
        });
        const page: WordPage = await api(`/v1/vocabulary/words?${params}`, {
          schema: WordPageSchema,
          signal,
        });
        words.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      return words;
    },
  });
  const words = vocabulary.data ?? [];
  const chosenCount = wordMode === 'all' ? words.length : selected.length;
  const filtered = words.filter((word) =>
    `${word.term} ${word.translation ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const generate = useMutation({
    mutationFn: () =>
      api('/v1/learning/generated-texts', {
        method: 'POST',
        body: {
          level,
          ...(topic.trim() ? { topic: topic.trim() } : {}),
          ...(wordMode === 'selected' ? { wordIds: selected } : {}),
        },
        schema: GenerateTextResponseSchema,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MY_TEXTS_QUERY_KEY }),
  });

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    generate.mutate();
  };

  return (
    <Card className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset disabled={generate.isPending} className="flex flex-col gap-3">
          <legend className="mb-2 font-semibold">{t.myTexts.words}</legend>
          <div className="flex flex-wrap gap-4">
            {(['all', 'selected'] as const).map((mode) => (
              <label key={mode} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="word-mode"
                  value={mode}
                  checked={wordMode === mode}
                  onChange={() => setWordMode(mode)}
                  className="accent-primary"
                />
                {mode === 'all' ? t.myTexts.allWords : t.myTexts.selectWords}
              </label>
            ))}
          </div>
          {vocabulary.isPending ? (
            <Skeleton className="h-10" />
          ) : vocabulary.isError ? (
            <Alert
              tone="danger"
              action={
                <Button type="button" variant="secondary" onClick={() => void vocabulary.refetch()}>
                  {t.common.retry}
                </Button>
              }
            >
              {describeError(vocabulary.error)}
            </Alert>
          ) : (
            <>
              {wordMode === 'selected' ? (
                <>
                  <TextField
                    label={t.myTexts.wordSearch}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelected(words.map((word) => word.id))}
                    >
                      {t.myTexts.selectAll}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>
                      {t.myTexts.clearSelection}
                    </Button>
                  </div>
                  <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
                    {filtered.map((word) => (
                      <label
                        key={word.id}
                        className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-surface-muted"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(word.id)}
                          className="mt-1 accent-primary"
                          onChange={(event) =>
                            setSelected((ids) =>
                              event.target.checked
                                ? [...ids, word.id]
                                : ids.filter((id) => id !== word.id),
                            )
                          }
                        />
                        <span>
                          <span className="font-semibold">{word.term}</span>
                          {word.translation ? (
                            <span className="ml-2 text-sm text-muted">{word.translation}</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                    {filtered.length === 0 ? (
                      <p className="text-sm text-muted">{t.myTexts.noMatchingWords}</p>
                    ) : null}
                  </div>
                </>
              ) : null}
              <p className="text-sm text-muted" aria-live="polite">
                {t.myTexts.wordCount(chosenCount)}
              </p>
              {chosenCount < 3 ? (
                <p className="text-sm text-muted">{t.myTexts.minimumWords}</p>
              ) : null}
            </>
          )}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <SelectField
            label={t.myTexts.level}
            value={level}
            disabled={generate.isPending}
            onChange={(event) => setLevel(event.target.value as CefrLevel)}
            options={CEFR_LEVELS.map((value) => ({ value, label: value }))}
          />
          <TextField
            label={t.myTexts.topic}
            placeholder={t.myTexts.topicPlaceholder}
            value={topic}
            maxLength={80}
            disabled={generate.isPending}
            onChange={(event) => setTopic(event.target.value)}
          />
          <Button
            type="submit"
            loading={generate.isPending}
            disabled={!vocabulary.isSuccess || chosenCount < 3}
          >
            {t.myTexts.generate}
          </Button>
        </div>
      </form>
      {generate.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <Spinner /> {t.myTexts.generating}
        </p>
      ) : null}
      {generate.isError ? (
        <Alert tone="danger">{describeGenerationError(generate.error)}</Alert>
      ) : null}
      {generate.data ? <GeneratedNotice result={generate.data} /> : null}
    </Card>
  );
}

function GeneratedNotice({ result }: { result: GenerateTextResponse }) {
  return (
    <Alert
      tone="success"
      title={t.myTexts.created(result.title)}
      action={
        <Link href={`/read/${result.slug}`} className={buttonClasses('primary', 'sm')}>
          {t.myTexts.open}
        </Link>
      }
    >
      {result.missingTerms.length > 0 ? (
        <p>{t.myTexts.missingTerms(result.missingTerms.join(', '))}</p>
      ) : null}
      {result.isMock ? <p className="text-muted">{t.myTexts.mockNotice}</p> : null}
    </Alert>
  );
}

function TextRow({ text }: { text: TextSummary }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api(`/v1/texts/mine/${text.slug}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MY_TEXTS_QUERY_KEY }),
  });
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <LevelBadge level={text.level} />
          <h2 className="truncate font-semibold">{text.title}</h2>
        </div>
        <p className="text-sm text-muted">{text.summary}</p>
        {remove.isError ? (
          <p className="text-sm text-danger">{describeError(remove.error)}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href={`/read/${text.slug}`} className={buttonClasses('secondary', 'sm')}>
          {t.myTexts.open}
        </Link>
        <Button
          variant="danger-ghost"
          size="sm"
          loading={remove.isPending}
          onClick={() => {
            if (window.confirm(t.myTexts.confirmDelete(text.title))) remove.mutate();
          }}
        >
          {t.myTexts.delete}
        </Button>
      </div>
    </Card>
  );
}

export default function MyTextsPage() {
  const { user, isLoading } = useRequireUser();
  const texts = useQuery({
    queryKey: MY_TEXTS_QUERY_KEY,
    enabled: !isLoading,
    queryFn: ({ signal }) => api('/v1/texts/mine', { schema: MyTextsResponseSchema, signal }),
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t.myTexts.title}</h1>
        <p className="max-w-2xl text-muted">{t.myTexts.intro}</p>
      </header>
      {isLoading || !user ? (
        <Skeleton className="h-32" />
      ) : (
        <GenerateForm defaultLevel={user.settings.targetLevel} />
      )}
      {texts.isError ? <Alert tone="danger">{describeError(texts.error)}</Alert> : null}
      {texts.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : texts.data?.items.length === 0 ? (
        <EmptyState title={t.myTexts.empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {texts.data?.items.map((text) => (
            <li key={text.id}>
              <TextRow text={text} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
