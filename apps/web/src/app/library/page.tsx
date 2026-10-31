import { CefrLevelSchema, ListTextsResponseSchema } from '@lingoup/contracts';
import { Badge, Card, EmptyState, LevelBadge } from '@lingoup/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CompletionMark } from '@/components/completion-mark';
import { ContinueLearning } from '@/components/continue-learning';
import { LevelFilter } from '@/components/level-filter';
import { MyTextsTeaser } from '@/components/my-texts-teaser';
import { t } from '@/i18n';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: t.library.title };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const requested = CefrLevelSchema.safeParse((await searchParams).level);
  const level = requested.success ? requested.data : undefined;
  const { items } = await serverApi(
    `/v1/texts${level ? `?level=${level}` : ''}`,
    ListTextsResponseSchema,
  );

  return (
    <div className="library-page flex flex-col gap-6">
      <MyTextsTeaser />
      <ContinueLearning />
      <header
        id="text-library"
        className="library-section-heading flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="eyebrow mb-3">// READ SOMETHING WORTH LEARNING</p>
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
            {t.library.title}
            <span className="text-primary">.</span>
          </h1>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-muted">{t.library.intro}</p>
      </header>
      <LevelFilter basePath="/library" active={level} />

      {items.length === 0 ? (
        <EmptyState title={t.library.empty} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((text, index) => (
            <li key={text.id}>
              <Card className="reading-card relative flex h-full flex-col gap-4 transition-colors hover:border-primary/50 focus-within:border-primary/50">
                <div className={`reading-card-art art-${index % 4}`} aria-hidden="true">
                  <span className="art-label">LINGOUP / READING</span>
                  <span className="art-symbol">{['Aa', '↗', '“ ”', 'a—z'][index % 4]}</span>
                  <span className="art-index">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <LevelBadge level={text.level} />
                  <span className="text-xs text-muted">
                    {t.common.words(text.wordCount)} · {t.common.minutes(text.estimatedMinutes)}
                  </span>
                  <CompletionMark slug={text.slug} />
                </div>
                <h2 className="text-xl font-medium tracking-tight">
                  <Link
                    href={`/read/${text.slug}`}
                    className="after:absolute after:inset-0 hover:underline"
                  >
                    {text.title}
                  </Link>
                </h2>
                <p className="text-sm text-muted">{text.summary}</p>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {text.topics.map((topic) => (
                    <Badge key={topic}>{topic}</Badge>
                  ))}
                </div>
                <div
                  className="flex items-center justify-between border-t border-border pt-3 text-xs font-medium text-primary"
                  aria-hidden="true"
                >
                  <span>Start reading</span>
                  <span className="text-lg">↗</span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
