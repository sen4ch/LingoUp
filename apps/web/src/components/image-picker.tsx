'use client';

import {
  ImageSearchResponseSchema,
  WORD_IMAGE_UPLOAD_TYPES,
  WordImageSchema,
  type WordImage,
} from '@lingoup/contracts';
import { Alert, Button, Skeleton, TextField, buttonClasses } from '@lingoup/ui';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useId, useState, type SyntheticEvent } from 'react';
import { t } from '@/i18n';
import { ApiRequestError, api } from '@/lib/api-client';
import { describeError } from '@/lib/errors';

function describeImageError(error: unknown): string {
  if (error instanceof ApiRequestError && t.images.errors[error.code])
    return t.images.errors[error.code]!;
  return describeError(error);
}

/**
 * Lets the learner pick a picture for a word: free-licensed images from search, or their
 * own upload. The search starts with the term; the learner can refine an ambiguous word.
 */
export function ImagePicker({
  wordId,
  term,
  current,
  onChange,
  onClose,
}: {
  wordId: string;
  term: string;
  current: WordImage | null;
  onChange: (image: WordImage | null) => void;
  onClose: () => void;
}) {
  const uploadId = useId();
  const [draft, setDraft] = useState(term);
  const [query, setQuery] = useState(term);

  const results = useInfiniteQuery({
    queryKey: ['image-search', query],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api(
        `/v1/vocabulary/images/search?${new URLSearchParams({ q: query, page: String(pageParam) })}`,
        {
          schema: ImageSearchResponseSchema,
          signal,
        },
      ),
    getNextPageParam: (last, pages) =>
      last.hasMore && pages.length < 10 ? pages.length + 1 : undefined,
    retry: false,
    staleTime: 10 * 60_000,
  });

  const choose = useMutation({
    mutationFn: (imageId: string) =>
      api(`/v1/vocabulary/words/${wordId}/image`, {
        method: 'PUT',
        body: { imageId },
        schema: WordImageSchema,
      }),
    onSuccess: onChange,
  });
  const upload = useMutation({
    mutationFn: (file: File) =>
      api(`/v1/vocabulary/words/${wordId}/image/upload`, {
        method: 'PUT',
        body: file,
        schema: WordImageSchema,
      }),
    onSuccess: onChange,
  });
  const remove = useMutation({
    mutationFn: () => api(`/v1/vocabulary/words/${wordId}/image`, { method: 'DELETE' }),
    onSuccess: () => onChange(null),
  });

  const onSearch = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.trim()) setQuery(draft.trim());
  };
  const items = results.data?.pages.flatMap((page) => page.items) ?? [];
  const busy = choose.isPending || upload.isPending || remove.isPending;
  const error = choose.error ?? upload.error ?? remove.error;

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-border bg-surface-muted p-3 text-left">
      <form onSubmit={onSearch} className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            label={t.images.searchLabel}
            value={draft}
            maxLength={80}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          loading={results.isFetching && !results.isFetchingNextPage}
        >
          {t.images.search}
        </Button>
      </form>
      <p className="text-xs text-muted">{t.images.hint}</p>

      {results.isError ? (
        <Alert tone="warning">{describeImageError(results.error)}</Alert>
      ) : results.isPending ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">{t.images.empty}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => choose.mutate(item.id)}
                title={[item.title, item.license].filter(Boolean).join(' · ')}
                aria-label={t.images.choose(item.title ?? t.images.untitled)}
                className="block aspect-square w-full overflow-hidden rounded-md border border-border bg-surface hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- proxied and resized by the API */}
                <img
                  src={`/api/v1/vocabulary/images/${item.id}/thumb`}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {results.hasNextPage ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-center"
          loading={results.isFetchingNextPage}
          onClick={() => void results.fetchNextPage()}
        >
          {t.images.more}
        </Button>
      ) : null}

      {error ? <Alert tone="danger">{describeImageError(error)}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={uploadId}
          className={buttonClasses(
            'secondary',
            'sm',
            busy ? 'pointer-events-none opacity-60' : 'cursor-pointer',
          )}
        >
          {upload.isPending ? `${t.images.upload}…` : t.images.upload}
        </label>
        <input
          id={uploadId}
          type="file"
          accept={WORD_IMAGE_UPLOAD_TYPES.join(',')}
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) upload.mutate(file);
          }}
        />
        {current ? (
          <Button
            variant="danger-ghost"
            size="sm"
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {t.images.remove}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
          {t.images.done}
        </Button>
      </div>
    </div>
  );
}
