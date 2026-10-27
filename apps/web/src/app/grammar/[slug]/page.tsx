import { GrammarTopicDetailSchema, SlugSchema } from '@lingoup/contracts';
import { Badge, LevelBadge } from '@lingoup/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GrammarExercises } from '@/components/grammar/grammar-exercises';
import { RuleBlocks } from '@/components/grammar/rule-blocks';
import { t } from '@/i18n';
import { serverApi, ServerApiError } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

async function loadTopic(slug: string) {
  if (!SlugSchema.safeParse(slug).success) notFound();
  try {
    return await serverApi(`/v1/grammar/topics/${slug}`, GrammarTopicDetailSchema, {
      withSession: true,
    });
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
  const topic = await loadTopic((await params).slug);
  return { title: topic.title, description: topic.summary };
}

export default async function GrammarTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const topic = await loadTopic((await params).slug);
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href={`/grammar?level=${topic.level}`} className="text-sm text-muted hover:text-text">
          {t.grammar.back}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <LevelBadge level={topic.level} />
          <span>
            {t.levels.names[topic.level]} · {t.grammar.exercises(topic.exerciseCount)}
          </span>
          {topic.progress && topic.progress.attempted > 0 ? (
            <Badge tone="info">
              {t.grammar.progress(topic.progress.correct, topic.exerciseCount)}
            </Badge>
          ) : null}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{topic.title}</h1>
        <p className="text-muted">{topic.summary}</p>
      </header>
      <RuleBlocks blocks={topic.blocks} />
      <section aria-labelledby="exercises" className="flex flex-col gap-4">
        <h2 id="exercises" className="text-2xl font-semibold">
          {t.grammar.practice}
        </h2>
        <GrammarExercises exercises={topic.exercises} />
      </section>
      <footer className="border-t border-border pt-4 text-xs text-muted">
        {t.reader.licence(topic.author, topic.license)}
      </footer>
    </article>
  );
}
