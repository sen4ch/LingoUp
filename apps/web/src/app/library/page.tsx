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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t.library.title}</h1>
        <p className="max-w-2xl text-muted">{t.library.intro}</p>
      </header>

      <MyTextsTeaser />
      <ContinueLearning />
      <LevelFilter basePath="/library" active={level} />

      {items.length === 0 ? (
        <EmptyState title={t.library.empty} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((text) => (
            <li key={text.id}>
              <Card className="relative flex h-full flex-col gap-3 transition-shadow focus-within:shadow-md hover:shadow-md">
                <div className="flex items-center gap-2">
                  <LevelBadge level={text.level} />
                  <span className="text-xs text-muted">
                    {t.common.words(text.wordCount)} · {t.common.minutes(text.estimatedMinutes)}
                  </span>
                  <CompletionMark slug={text.slug} />
                </div>
                <h2 className="text-lg font-semibold">
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
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
