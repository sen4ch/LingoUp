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
    <header className="site-header sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="brand flex items-center gap-2.5 text-xl font-semibold tracking-tight text-text"
        >
          <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 text-primary" fill="none">
            <path
              d="M5 23V9l10 5v14L5 23Zm12 5V14l10-5v14l-10 5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="m8 5 8 4 8-4M16 2v7" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          {t.appName}
        </Link>
        <nav
          aria-label={t.nav.main}
          className="site-nav order-3 w-full overflow-x-auto lg:order-none lg:w-auto lg:flex-1"
        >
          <ul className="flex gap-0.5 lg:justify-center">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm whitespace-nowrap transition-colors',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted hover:text-text',
                    )}
                  >
                    {link.label}
                    {link.count ? (
                      <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-primary-fg">
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
