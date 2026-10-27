'use client';

import { ReadingCompletionsResponseSchema } from '@lingoup/contracts';
import { Badge } from '@lingoup/ui';
import { useQuery } from '@tanstack/react-query';
import { t } from '@/i18n';
import { api } from '@/lib/api-client';
import { useCurrentUser } from '@/lib/auth';
import { useHydrated } from '@/lib/use-hydrated';

export const COMPLETIONS_QUERY_KEY = ['reading', 'completions'] as const;

export function useCompletions() {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: COMPLETIONS_QUERY_KEY,
    queryFn: () =>
      api('/v1/learning/reading/completions', { schema: ReadingCompletionsResponseSchema }),
    enabled: Boolean(user),
  });
}

/** "Read" badge for texts the signed-in user has completed. */
export function CompletionMark({ slug }: { slug: string }) {
  const hydrated = useHydrated();
  const { data } = useCompletions();
  if (!hydrated || !data?.items.some((item) => item.textSlug === slug)) return null;
  return (
    <Badge tone="success" className="ml-auto">
      ✓ {t.library.completed}
    </Badge>
  );
}
