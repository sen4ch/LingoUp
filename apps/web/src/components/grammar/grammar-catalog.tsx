'use client';

import { CEFR_LEVELS, type CefrLevel, type GrammarTopicSummary } from '@lingoup/contracts';
import { Button, EmptyState, LevelBadge, SelectField, buttonClasses } from '@lingoup/ui';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { LevelFilter } from '@/components/level-filter';
import { PracticeTimer } from '@/components/practice-timer';
import { VocabularyIcon as Icon } from '@/components/vocabulary-icon';
import { t } from '@/i18n';
import {
  GRAMMAR_AREAS,
  GRAMMAR_INDEX,
  GRAMMAR_SOURCES,
  grammarAreaLabel,
} from '@/lib/grammar-reference';

const isComplete = (topic: GrammarTopicSummary) =>
  topic.exerciseCount > 0 && (topic.progress?.correct ?? 0) >= topic.exerciseCount;

export function GrammarCatalog({
  topics,
  level,
}: {
  topics: GrammarTopicSummary[];
  level: CefrLevel | undefined;
}) {
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [filter, setFilter] = useState<'all' | 'started' | 'complete'>('all');
  const query = useDeferredValue(search.trim().toLowerCase());
  const ordered = [...topics].sort(
    (a, b) =>
      CEFR_LEVELS.indexOf(a.level) - CEFR_LEVELS.indexOf(b.level) ||
      (GRAMMAR_INDEX[a.slug]?.order ?? 999) - (GRAMMAR_INDEX[b.slug]?.order ?? 999),
  );
  const completed = topics.filter(isComplete).length;
  const started = topics.filter(
    (topic) => (topic.progress?.attempted ?? 0) > 0 && !isComplete(topic),
  ).length;
  const exercises = topics.reduce((total, topic) => total + topic.exerciseCount, 0);
  const correct = topics.reduce((total, topic) => total + (topic.progress?.correct ?? 0), 0);
  const next =
    ordered.find((topic) => (topic.progress?.attempted ?? 0) > 0 && !isComplete(topic)) ??
    ordered.find((topic) => !isComplete(topic));
  const tracked = topics.some((topic) => topic.progress !== null);
  const visible = ordered.filter(
    (topic) =>
      (!query ||
        `${topic.title} ${topic.summary} ${grammarAreaLabel(topic.slug)}`
          .toLowerCase()
          .includes(query)) &&
      (!area || GRAMMAR_INDEX[topic.slug]?.area === area) &&
      (filter === 'all' ||
        (filter === 'complete'
          ? isComplete(topic)
          : (topic.progress?.attempted ?? 0) > 0 && !isComplete(topic))),
  );

  return (
    <div className="grammar-workspace">
      <header className="grammar-hero">
        <div>
          <p className="eyebrow">
            <Icon name="spark" width="14" height="14" /> SMALL RULES. BIG POSSIBILITIES.
          </p>
          <h1>
            Grammar, <span>made clear.</span>
          </h1>
          <p>
            Find the pattern. Make it click. Build the confidence to put your own words together.
          </p>
          <div className="grammar-hero-note">
            <Icon name="check" width="15" height="15" /> Clear explanations <span>·</span> Real
            examples <span>·</span> Practice that stays
          </div>
        </div>
        <div className="grammar-sentence-art" aria-hidden="true">
          <span className="grammar-art-label">THE BUILDING BLOCKS OF ENGLISH</span>
          <div>
            <span>I</span>
            <strong>am</strong>
            <span>learning.</span>
          </div>
          <div>
            <span>You</span>
            <strong>are</strong>
            <span>growing.</span>
          </div>
          <div>
            <span>We</span>
            <strong>are</strong>
            <span>getting there.</span>
          </div>
          <span className="grammar-art-caption">
            <span className="status-dot" /> ONE PATTERN. ENDLESS POSSIBILITIES.
          </span>
        </div>
      </header>
      <div
        className="grammar-overview"
        aria-label={level ? `Overview for ${level}` : 'Overview for all levels'}
      >
        <div>
          <Icon name="book" />
          <strong>{topics.length}</strong>
          <span>{level ? `${level} topics to explore` : 'Topics to explore'}</span>
        </div>
        <div>
          <Icon name="edit" />
          <strong>{exercises}</strong>
          <span>Practice exercises</span>
        </div>
        <div>
          <Icon name="check" />
          <strong>{tracked ? completed : '—'}</strong>
          <span>{tracked ? 'Lessons completed' : 'Sign in to track progress'}</span>
        </div>
      </div>
      <div className="grammar-layout">
        <section className="grammar-topic-section" aria-labelledby="grammar-topics-title">
          <div className="grammar-section-heading">
            <div>
              <h2 id="grammar-topics-title">
                Find your next lesson<span className="text-primary">.</span>
              </h2>
              <p>Start where you are. Take it one pattern at a time.</p>
            </div>
            <span>{level ? t.levels.names[level] : 'Every level welcome'}</span>
          </div>
          <div className="grammar-levels">
            <p>CHOOSE YOUR LEVEL</p>
            <LevelFilter basePath="/grammar" active={level} />
          </div>
          <div className="grammar-search">
            <Icon name="search" width="18" height="18" />
            <label htmlFor="grammar-search" className="sr-only">
              Search grammar topics
            </label>
            <input
              id="grammar-search"
              type="search"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a topic, rule or a little clarity…"
            />
          </div>
          <div className="grammar-area-filter">
            <SelectField
              label="Grammar area"
              value={area}
              onChange={(event) => setArea(event.target.value)}
              options={[
                { value: '', label: 'All grammar areas' },
                ...GRAMMAR_AREAS.map((item) => ({
                  ...item,
                  count: topics.filter((topic) => GRAMMAR_INDEX[topic.slug]?.area === item.id)
                    .length,
                })).map((item) => ({ value: item.id, label: `${item.label} (${item.count})` })),
              ]}
            />
            <p>
              {visible.length} {visible.length === 1 ? 'lesson' : 'lessons'} shown · A1–C2 study
              guide
            </p>
          </div>
          <div className="grammar-tabs" role="group" aria-label="Filter lessons by progress">
            {(
              [
                ['all', 'All lessons', topics.length],
                ['started', 'In progress', started],
                ['complete', 'Completed', completed],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>
          <p className="sr-only" role="status">
            {visible.length} lessons found
          </p>
          {visible.length === 0 ? (
            <div className="grammar-empty">
              <Icon name="search" width="30" height="30" />
              <EmptyState
                title={
                  topics.length === 0 ? t.grammar.empty : 'A little room for your next discovery.'
                }
                action={
                  search || area || filter !== 'all' ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch('');
                        setFilter('all');
                        setArea('');
                      }}
                    >
                      Show all lessons
                    </Button>
                  ) : (
                    <Link href="/grammar" className={buttonClasses('secondary')}>
                      Explore all levels
                    </Link>
                  )
                }
              >
                {filter === 'complete'
                  ? 'Completed lessons will appear here as you practise.'
                  : filter === 'started'
                    ? 'Open a lesson and try an exercise to get started.'
                    : 'Try another topic or choose a different level.'}
              </EmptyState>
            </div>
          ) : (
            <ul className="grammar-topic-grid">
              {visible.map((topic) => {
                const done = isComplete(topic);
                const attempted = (topic.progress?.attempted ?? 0) > 0;
                const progress = topic.exerciseCount
                  ? Math.min(100, ((topic.progress?.correct ?? 0) / topic.exerciseCount) * 100)
                  : 0;
                return (
                  <li key={topic.id}>
                    <article
                      className={`grammar-topic-card grammar-level-${topic.level[0]?.toLowerCase()}`}
                    >
                      <div className="grammar-topic-top">
                        <span className="grammar-topic-symbol" aria-hidden="true">
                          {done ? <Icon name="check" /> : 'Aa'}
                        </span>
                        <LevelBadge level={topic.level} />
                        <span className="grammar-topic-status">
                          {done ? 'Completed' : attempted ? 'In progress' : 'Ready to explore'}
                        </span>
                      </div>
                      <h3>
                        <Link href={`/grammar/${topic.slug}`}>{topic.title}</Link>
                      </h3>
                      <span className="grammar-area-label">{grammarAreaLabel(topic.slug)}</span>
                      <p>{topic.summary}</p>
                      <div className="grammar-topic-progress">
                        <div>
                          <span>
                            <Icon name="edit" width="12" height="12" />
                            {t.grammar.exercises(topic.exerciseCount)}
                          </span>
                          <span>
                            {attempted
                              ? t.grammar.progress(topic.progress!.correct, topic.exerciseCount)
                              : t.levels.names[topic.level]}
                          </span>
                        </div>
                        <progress
                          value={progress}
                          max={100}
                          aria-label={`Correct answers for ${topic.title}`}
                        />
                      </div>
                      <div className="grammar-topic-footer" aria-hidden="true">
                        <span>
                          {done
                            ? 'Revisit lesson'
                            : attempted
                              ? 'Continue learning'
                              : 'Start lesson'}
                        </span>
                        <Icon name="arrow" width="17" height="17" />
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <aside className="grammar-sidebar" aria-label="Your grammar practice">
          <details className="grammar-reference-info">
            <summary>
              <Icon name="book" width="14" height="14" />
              About this reference
              <Icon name="chevron" width="12" height="12" />
            </summary>
            <p>
              Explore core learner grammar across A1–C2. Level labels are study guidance: many
              structures overlap levels. Explanations, examples and practice questions are original
              and written in English.
            </p>
            <h3>Further reading</h3>
            {GRAMMAR_SOURCES.filter((source) => source.areas.length === 0).map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
                <Icon name="arrow" width="12" height="12" />
              </a>
            ))}
            <p>
              Includes verb-form and tense references, punctuation, irregular verbs, and a grammar
              glossary.
            </p>
          </details>
          <div className="grammar-next-card">
            <p className="eyebrow">
              <Icon name="spark" width="13" height="13" /> YOUR NEXT SMALL STEP
            </p>
            <span className="grammar-next-symbol" aria-hidden="true">
              a<span>→</span>A
            </span>
            <h2>
              {next
                ? 'Make a little progress.'
                : topics.length
                  ? 'Look how far you’ve come.'
                  : 'Find your starting point.'}
            </h2>
            <p>
              {next
                ? next.title
                : topics.length
                  ? 'Every lesson at this level is complete. Revisit a favourite or explore another level.'
                  : 'Explore the other levels to find a lesson for today.'}
            </p>
            {next ? (
              <Link
                href={`/grammar/${next.slug}`}
                className={buttonClasses('primary', 'md', 'w-full')}
              >
                {next.progress?.attempted ? 'Continue lesson' : 'Start learning'}
                <Icon name="arrow" width="16" height="16" />
              </Link>
            ) : (
              <Link href="/grammar" className={buttonClasses('secondary', 'md', 'w-full')}>
                Explore all levels
                <Icon name="arrow" width="16" height="16" />
              </Link>
            )}
            <span className="grammar-next-note">
              One rule. A few examples. A little more confidence.
            </span>
          </div>
          <div className="grammar-focus">
            <p className="eyebrow">
              <Icon name="clock" width="14" height="14" /> MAKE A LITTLE TIME
            </p>
            <PracticeTimer skill="grammar" />
          </div>
          {tracked ? (
            <div className="grammar-progress-note">
              <Icon name="check" />
              <h3>Every answer is a step.</h3>
              <p>
                {correct} of {exercises} exercises answered correctly
                {level ? ` at ${level}` : ' across all levels'}. Your progress is saved as you
                practise.
              </p>
            </div>
          ) : (
            <div className="grammar-progress-note">
              <Icon name="book" />
              <h3>Make your progress yours.</h3>
              <p>
                Read every rule freely. Sign in to check your answers and pick up where you left
                off.
              </p>
              <Link href="/login?next=%2Fgrammar">
                Log in to practise <Icon name="arrow" width="14" height="14" />
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
