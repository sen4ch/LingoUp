'use client';

import { ReadingCompletionSchema } from '@lingoup/contracts';
import { Alert, Badge, Button } from '@lingoup/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from '@/i18n';
import { api } from '@/lib/api-client';
import { useCurrentUser } from '@/lib/auth';
import { useHydrated } from '@/lib/use-hydrated';
import { COMPLETIONS_QUERY_KEY, useCompletions } from '../completion-mark';
import { describeError } from '@/lib/errors';

export function MarkAsRead({ slug }: { slug: string }) {
  const hydrated = useHydrated();
  const { data: user } = useCurrentUser();
  const { data: completions } = useCompletions();
  const queryClient = useQueryClient();
  const complete = useMutation({
    mutationFn: () =>
      api(`/v1/learning/reading/${slug}/complete`, {
        method: 'POST',
        schema: ReadingCompletionSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPLETIONS_QUERY_KEY }),
  });

  if (!hydrated || !user) return null;
  const done = completions?.items.some((item) => item.textSlug === slug) ?? false;
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-6">
      {done ? (
        <Badge tone="success" className="self-start text-sm">
          ✓ {t.reader.markedRead}
        </Badge>
      ) : (
        <Button
          variant="secondary"
          className="self-start"
          loading={complete.isPending}
          onClick={() => complete.mutate()}
        >
          {t.reader.markRead}
        </Button>
      )}
      {complete.isError ? <Alert tone="danger">{describeError(complete.error)}</Alert> : null}
    </div>
  );
}
