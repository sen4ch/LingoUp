'use client';

import { CurrentUserSchema, type CurrentUser } from '@lingoup/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api, isUnauthenticated } from './api-client';
import { useHydrated } from './use-hydrated';

export const ME_QUERY_KEY = ['me'] as const;

/** Current user, or null for anonymous visitors. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<CurrentUser | null> => {
      try {
        return await api('/v1/me', { schema: CurrentUserSchema });
      } catch (error) {
        if (isUnauthenticated(error)) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: (count, error) => !isUnauthenticated(error) && count < 2,
  });
}

/** Redirects anonymous visitors to the login page, returning here afterwards. */
export function useRequireUser(): { user: CurrentUser | null | undefined; isLoading: boolean } {
  const { data: user, isLoading } = useCurrentUser();
  // Render the same loading state as the server until hydration completes.
  const hydrated = useHydrated();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!isLoading && user === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isLoading, user, router, pathname]);
  return { user, isLoading: !hydrated || isLoading || user === null };
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async () => {
    try {
      await api('/v1/auth/logout', { method: 'POST' });
    } finally {
      queryClient.clear();
      queryClient.setQueryData(ME_QUERY_KEY, null);
      router.push('/library');
    }
  };
}

export { safeNextPath } from './redirect';
