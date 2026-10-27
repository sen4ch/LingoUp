'use client';

import Link from 'next/link';
import { t } from '@/i18n';
import { useCurrentUser } from '@/lib/auth';
import { useHydrated } from '@/lib/use-hydrated';

/** Link from the public library to the learner's private, generated texts. */
export function MyTextsTeaser() {
  const hydrated = useHydrated();
  const { data: user } = useCurrentUser();
  if (!hydrated || !user) return null;
  return (
    <Link
      href="/my-texts"
      className="flex flex-col gap-1 rounded-xl border border-primary/40 bg-surface p-4 hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="font-semibold text-primary">{t.myTexts.libraryLink}</span>
      <span className="text-sm text-muted">{t.myTexts.generate}</span>
    </Link>
  );
}
