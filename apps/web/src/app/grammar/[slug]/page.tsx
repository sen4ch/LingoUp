import { GrammarTopicDetailSchema, SlugSchema } from '@lingoup/contracts';
import { Badge, LevelBadge, buttonClasses } from '@lingoup/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GrammarExercises } from '@/components/grammar/grammar-exercises';
import { RuleBlocks } from '@/components/grammar/rule-blocks';
import { PracticeTimer } from '@/components/practice-timer';
import { VocabularyIcon as Icon } from '@/components/vocabulary-icon';
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
    <article className="grammar-lesson">
      <header className="grammar-lesson-header">
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
        <p className="eyebrow">A LITTLE CLARITY. A LOT MORE CONFIDENCE.</p>
        <h1>{topic.title}</h1>
        <p className="text-muted">{topic.summary}</p>
        <div className="grammar-lesson-actions">
          <a href="#lesson-rule" className={buttonClasses('secondary')}>
            <Icon name="book" width="16" height="16" />
            Read the rule
          </a>
          <a href="#exercises" className={buttonClasses('primary')}>
            Try the exercises
            <Icon name="arrow" width="16" height="16" />
          </a>
        </div>
      </header>
      <div className="grammar-lesson-layout">
        <div className="grammar-lesson-content">
          <section id="lesson-rule" className="grammar-rule-panel" aria-label="Grammar explanation">
            <p className="eyebrow">
              <Icon name="book" width="14" height="14" /> UNDERSTAND THE PATTERN
            </p>
            <RuleBlocks blocks={topic.blocks} />
          </section>
          <section
            aria-labelledby="exercises"
            className="grammar-exercises-section flex flex-col gap-4"
          >
            <p className="eyebrow">// YOUR TURN</p>
            <h2 id="exercises" className="text-2xl font-semibold">
              {t.grammar.practice}
            </h2>
            <p className="text-sm text-muted">
              Try it out. Get feedback. Let the pattern settle in.
            </p>
            <GrammarExercises exercises={topic.exercises} />
          </section>
          <footer className="border-t border-border pt-4 text-xs text-muted">
            {t.reader.licence(topic.author, topic.license)}
          </footer>
        </div>
        <aside className="grammar-lesson-sidebar" aria-label="Lesson tools">
          <div className="grammar-lesson-guide">
            <p className="eyebrow">YOUR LEARNING PATH</p>
            <a href="#lesson-rule">
              <span>01</span>
              <div>
                <strong>Understand the rule</strong>
                <p>Clear explanations & examples</p>
              </div>
              <Icon name="chevron" width="14" height="14" />
            </a>
            <a href="#exercises">
              <span>02</span>
              <div>
                <strong>Make it click</strong>
                <p>{t.grammar.exercises(topic.exerciseCount)}</p>
              </div>
              <Icon name="chevron" width="14" height="14" />
            </a>
            <Link href={`/grammar?level=${topic.level}`}>
              <span>03</span>
              <div>
                <strong>Keep exploring</strong>
                <p>More topics at {topic.level}</p>
              </div>
              <Icon name="chevron" width="14" height="14" />
            </Link>
          </div>
          <div className="grammar-focus">
            <p className="eyebrow">
              <Icon name="clock" width="14" height="14" /> A MOMENT FOR YOUR ENGLISH
            </p>
            <PracticeTimer skill="grammar" />
          </div>
          <p className="grammar-lesson-reassurance">
            You don’t have to get it right the first time. Every attempt helps it click.
          </p>
        </aside>
      </div>
    </article>
  );
}
