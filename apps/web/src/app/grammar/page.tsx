import { CefrLevelSchema, ListGrammarTopicsResponseSchema } from '@lingoup/contracts';
import { Badge, Card, EmptyState, LevelBadge } from '@lingoup/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LevelFilter } from '@/components/level-filter';
import { t } from '@/i18n';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: t.grammar.title };

export default async function GrammarPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const requested = CefrLevelSchema.safeParse((await searchParams).level);
  const level = requested.success ? requested.data : undefined;
  const { items } = await serverApi(
    `/v1/grammar/topics${level ? `?level=${level}` : ''}`,
    ListGrammarTopicsResponseSchema,
    { withSession: true },
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t.grammar.title}</h1>
        <p className="max-w-2xl text-muted">{t.grammar.intro}</p>
      </header>
      <LevelFilter basePath="/grammar" active={level} />
      {items.length === 0 ? (
        <EmptyState title={t.grammar.empty} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((topic) => (
            <li key={topic.id}>
              <Card className="relative flex h-full flex-col gap-3 transition-shadow focus-within:shadow-md hover:shadow-md">
                <div className="flex items-center gap-2">
                  <LevelBadge level={topic.level} />
                  <span className="text-xs text-muted">
                    {t.grammar.exercises(topic.exerciseCount)}
                  </span>
                  {topic.progress && topic.progress.attempted > 0 ? (
                    <Badge
                      tone={topic.progress.correct === topic.exerciseCount ? 'success' : 'info'}
                      className="ml-auto"
                    >
                      {t.grammar.progress(topic.progress.correct, topic.exerciseCount)}
                    </Badge>
                  ) : null}
                </div>
                <h2 className="text-lg font-semibold">
                  <Link
                    href={`/grammar/${topic.slug}`}
                    className="after:absolute after:inset-0 hover:underline"
                  >
                    {topic.title}
                  </Link>
                </h2>
                <p className="text-sm text-muted">{topic.summary}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
