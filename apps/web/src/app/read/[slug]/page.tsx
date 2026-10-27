import { SlugSchema, TextDetailSchema } from '@lingoup/contracts';
import { Badge, LevelBadge } from '@lingoup/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Reader } from '@/components/reader/reader';
import { t } from '@/i18n';
import { serverApi, ServerApiError } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

async function loadText(slug: string) {
  if (!SlugSchema.safeParse(slug).success) notFound();
  try {
    return await serverApi(`/v1/texts/${slug}`, TextDetailSchema, { withSession: true });
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const text = await loadText((await params).slug);
  return { title: text.title, description: text.summary };
}

export default async function ReadPage({ params }: { params: Promise<{ slug: string }> }) {
  const text = await loadText((await params).slug);
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href={text.isPrivate ? '/my-texts' : `/library?level=${text.level}`}
          className="text-sm text-muted hover:text-text"
        >
          {text.isPrivate ? `← ${t.myTexts.title}` : t.reader.back}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <LevelBadge level={text.level} />
          <span>
            {t.levels.names[text.level]} · {t.common.words(text.wordCount)} ·{' '}
            {t.common.minutes(text.estimatedMinutes)}
          </span>
          {text.isPrivate ? <Badge tone="info">{t.myTexts.privateBadge}</Badge> : null}
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{text.title}</h1>
        <p className="text-muted">{text.summary}</p>
        {text.focusTerms.length > 0 ? (
          <p className="text-sm text-muted">
            <span className="reader-focus">{t.myTexts.focusLegend}</span>:{' '}
            {text.focusTerms.join(', ')}
          </p>
        ) : null}
      </header>
      <Reader text={text} />
      <footer className="border-t border-border pt-4 text-xs text-muted">
        {t.reader.licence(text.author, text.license)}
      </footer>
    </article>
  );
}
