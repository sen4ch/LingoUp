'use client';

import { DueReviewsResponseSchema } from '@lingoup/contracts';
import { buttonClasses, cn } from '@lingoup/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/i18n';
import { api } from '@/lib/api-client';
import { useCurrentUser, useSignOut } from '@/lib/auth';

export const DUE_COUNT_QUERY_KEY = ['reviews', 'due-count'] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const signOut = useSignOut();
  const { data: due } = useQuery({
    queryKey: DUE_COUNT_QUERY_KEY,
    queryFn: () => api('/v1/vocabulary/reviews/due?limit=1', { schema: DueReviewsResponseSchema }),
    enabled: Boolean(user),
    refetchInterval: 5 * 60_000,
  });

  const links = [
    { href: '/library', label: t.nav.library },
    { href: '/grammar', label: t.nav.grammar },
    ...(user
      ? [
          { href: '/vocabulary', label: t.nav.vocabulary },
          { href: '/review', label: t.nav.review, count: due?.totalDue },
          { href: '/speaking', label: t.nav.speaking },
          { href: '/writing', label: t.nav.writing },
          { href: '/mistakes', label: 'Mistakes' },
          { href: '/exams', label: t.nav.exams },
          { href: '/listening', label: t.nav.listening },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/library" className="text-lg font-bold tracking-tight text-primary">
          {t.appName}
        </Link>
        <nav
          aria-label={t.nav.main}
          className="order-3 w-full overflow-x-auto sm:order-none sm:w-auto"
        >
          <ul className="flex flex-wrap gap-0.5 sm:gap-1">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm whitespace-nowrap sm:gap-1.5 sm:px-3',
                      active ? 'bg-surface-muted font-semibold' : 'text-muted hover:text-text',
                    )}
                  >
                    {link.label}
                    {link.count ? (
                      <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-white">
                        {link.count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/profile"
                aria-current={pathname.startsWith('/profile') ? 'page' : undefined}
                className={buttonClasses(
                  'ghost',
                  'sm',
                  pathname.startsWith('/profile') ? 'bg-surface-muted' : undefined,
                )}
              >
                {t.nav.profile}
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className={buttonClasses('ghost', 'sm')}
              >
                {t.nav.logout}
              </button>
            </>
          ) : user === null ? (
            <>
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                className={buttonClasses('ghost', 'sm')}
              >
                {t.nav.login}
              </Link>
              <Link href="/register" className={buttonClasses('primary', 'sm')}>
                {t.nav.register}
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
