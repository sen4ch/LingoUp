'use client';

import { LookupResponseSchema, WordSchema, type LookupResponse } from '@lingoup/contracts';
import { normalizeTerm } from '@lingoup/learning-engine';
import { Alert, Badge, Button, buttonClasses, Skeleton } from '@lingoup/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { t } from '@/i18n';
import { api, ApiRequestError } from '@/lib/api-client';
import { describeError } from '@/lib/errors';
import { useCurrentUser } from '@/lib/auth';
import { DUE_COUNT_QUERY_KEY } from '../site-header';
import type { Lookup } from './selection';

export function WordCard({
  lookup,
  textSlug,
  onClose,
}: {
  lookup: Lookup;
  textSlug: string;
  onClose: () => void;
}) {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const pathname = usePathname();

  // Escape closes the card even when focus is inside it.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section aria-labelledby="word-card-term" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h2 id="word-card-term" className="text-2xl font-bold break-words">
          {lookup.term}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t.common.close}>
          ✕
        </Button>
      </div>
      {lookup.context ? (
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t.card.context}
          </p>
          <p className="mt-1 font-reading text-sm italic">{lookup.context}</p>
        </div>
      ) : null}
      {userLoading ? (
        <Skeleton className="h-24" />
      ) : user ? (
        <LookupDetails lookup={lookup} textSlug={textSlug} />
      ) : (
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
          {t.card.loginRequired}
        </Alert>
      )}
    </section>
  );
}

function LookupDetails({ lookup, textSlug }: { lookup: Lookup; textSlug: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['lookup', textSlug, normalizeTerm(lookup.term), lookup.context];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      api('/v1/vocabulary/lookup', {
        method: 'POST',
        body: { term: lookup.term, context: lookup.context, textSlug },
        schema: LookupResponseSchema,
        signal,
      }),
    staleTime: 10 * 60_000,
  });

  const save = useMutation({
    mutationFn: (data: LookupResponse) => {
      // A placeholder explanation is not worth saving as a definition.
      const ai = data.ai && !data.ai.isMock ? data.ai : null;
      return api('/v1/vocabulary/words', {
        method: 'POST',
        body: {
          term: lookup.term,
          definition: data.glossary?.definition ?? ai?.definition ?? null,
          translation: data.glossary?.translation ?? ai?.translation ?? null,
          contextSentence: lookup.context || null,
          sourceTextSlug: textSlug,
        },
        schema: WordSchema,
      });
    },
    onSuccess: (word) => {
      queryClient.setQueryData<LookupResponse>(queryKey, (old) =>
        old ? { ...old, savedWordId: word.id } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ['words'] });
      void queryClient.invalidateQueries({ queryKey: DUE_COUNT_QUERY_KEY });
    },
    onError: (error) => {
      // Saved in another tab meanwhile: reflect the server state.
      if (error instanceof ApiRequestError && error.code === 'WORD_ALREADY_SAVED') {
        const wordId = (error.details as { wordId?: string } | undefined)?.wordId ?? null;
        queryClient.setQueryData<LookupResponse>(queryKey, (old) =>
          old ? { ...old, savedWordId: wordId } : old,
        );
      }
    },
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <span className="sr-only">{t.common.loading}</span>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Alert
        tone="danger"
        action={
          <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
            {t.common.retry}
          </Button>
        }
      >
        {describeError(query.error)}
      </Alert>
    );
  }

  const data = query.data;
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {data.glossary ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t.card.glossary}
          </p>
          {data.glossary.partOfSpeech ? (
            <p className="text-xs text-muted italic">{data.glossary.partOfSpeech}</p>
          ) : null}
          <p>{data.glossary.definition}</p>
          {data.glossary.translation ? (
            <p>
              <span className="text-muted">{t.card.translation}: </span>
              <strong>{data.glossary.translation}</strong>
            </p>
          ) : null}
          {data.glossary.example ? (
            <p className="text-sm text-muted">
              {t.card.example}: <span className="font-reading italic">{data.glossary.example}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">{t.card.noDefinition}</p>
      )}

      {data.ai ? (
        <div className="flex flex-col gap-1.5 rounded-lg bg-surface-muted p-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">
              {t.card.aiExplanation}
            </p>
            <Badge tone={data.ai.isMock ? 'warning' : 'info'}>
              {data.ai.isMock ? 'MockAIProvider' : data.ai.model}
            </Badge>
          </div>
          {data.ai.isMock ? <p className="text-xs text-warning">{t.card.mockNotice}</p> : null}
          <p className="text-sm">{data.ai.definition}</p>
          {data.ai.translation ? (
            <p className="text-sm font-semibold">{data.ai.translation}</p>
          ) : null}
          {data.ai.usageNote ? <p className="text-xs text-muted">{data.ai.usageNote}</p> : null}
        </div>
      ) : data.aiStatus !== 'skipped' && t.card.aiStatus[data.aiStatus] ? (
        <Alert
          tone={data.aiStatus === 'consent_required' ? 'info' : 'warning'}
          action={
            data.aiStatus === 'consent_required' ? (
              <Link href="/profile#settings" className="text-sm font-medium underline">
                {t.card.profileLink}
              </Link>
            ) : undefined
          }
        >
          {t.card.aiStatus[data.aiStatus]}
        </Alert>
      ) : null}

      {data.savedWordId ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="success">✓ {t.card.saved}</Badge>
          <Link href="/vocabulary" className="text-sm underline">
            {t.card.openVocabulary}
          </Link>
        </div>
      ) : (
        <Button onClick={() => save.mutate(data)} loading={save.isPending}>
          {t.card.save}
        </Button>
      )}
      {save.isError &&
      !(save.error instanceof ApiRequestError && save.error.code === 'WORD_ALREADY_SAVED') ? (
        <Alert tone="danger">{describeError(save.error)}</Alert>
      ) : null}
    </div>
  );
}
