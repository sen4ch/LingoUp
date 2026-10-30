import { Injectable } from '@nestjs/common';
import type { NextPractice } from '@lingoup/contracts';
import { ContentQuery } from '../../content/index.js';
import { GrammarService } from '../../grammar/index.js';
import { ProgressService } from '../../progress/index.js';
import { VocabularyStatsQuery } from '../../vocabulary/index.js';
import { ReadingService } from './reading.service.js';

@Injectable()
export class NextPracticeService {
  constructor(
    private readonly progress: ProgressService,
    private readonly content: ContentQuery,
    private readonly grammar: GrammarService,
    private readonly vocabulary: VocabularyStatsQuery,
    private readonly reading: ReadingService,
  ) {}

  /** Read-only: selecting a next step never completes work or generates paid AI content. */
  async next(userId: string): Promise<NextPractice> {
    const development = await this.progress.development(userId);
    const level = development.plan.cefrLevel;
    const pending = development.plan.activities.filter(
      (activity) => activity.completed < activity.target,
    );
    const base = { accountId: userId, day: development.day, level };
    if (!pending.length)
      return {
        ...base,
        state: 'complete',
        title: 'Today’s plan is complete',
        message:
          'You have completed all activities in today’s plan. You can return tomorrow or choose extra practice below.',
        href: '/profile',
        notes: [],
        activity: null,
      };
    const notes: string[] = [];
    let vocabulary: Awaited<ReturnType<VocabularyStatsQuery['forUser']>> | undefined;
    const words = async () => {
      vocabulary ??= await this.vocabulary.forUser(userId);
      return vocabulary;
    };
    for (const activity of pending) {
      let href = activity.href;
      let title = activity.title;
      let message = activity.instruction;
      if (activity.skill === 'reading') {
        const [library, owned, completions] = await Promise.all([
          this.content.listTexts(level),
          this.content.listMyTexts(userId),
          this.reading.completions(userId),
        ]);
        const completed = new Set(completions.items.map((item) => item.textSlug));
        const text = [...library, ...owned.filter((item) => item.level === level)].find(
          (item) => !completed.has(item.slug),
        );
        if (text) {
          href = `/read/${text.slug}`;
          title = text.title;
          message = `Read this ${level} text and check your understanding. Your reading timer will continue from its remaining time.`;
        } else if ((await words()).total >= 3) {
          href = '/my-texts';
          title = `Create another ${level} reading text`;
          message =
            'You have read the available texts at this level. Choose words to create another text; the timer starts when you open it.';
        } else {
          notes.push(
            `Reading: the available ${level} texts are already read. Save at least 3 words to create another text.`,
          );
          continue;
        }
      } else if (activity.skill === 'grammar') {
        const topics = (await this.grammar.listTopics(level, userId)).filter(
          (topic) =>
            topic.exerciseCount > 0 && (topic.progress?.correct ?? 0) < topic.exerciseCount,
        );
        const topic = topics.find((item) => (item.progress?.attempted ?? 0) > 0) ?? topics[0];
        if (!topic) {
          notes.push(
            `Grammar: the available ${level} topics are complete. You can review them or choose another level manually.`,
          );
          continue;
        }
        href = `/grammar/${topic.slug}#exercises`;
        title = topic.title;
        message = `Continue this ${level} topic and answer the remaining exercises. Your grammar timer will start automatically.`;
      } else if (activity.skill === 'vocabulary') {
        const stats = await words();
        if (stats.dueNow > 0) {
          href = '/review';
          title = `Review ${stats.dueNow} due ${stats.dueNow === 1 ? 'card' : 'cards'}`;
          message =
            'Your saved words are ready for review. Recall each answer before revealing it.';
        } else if (stats.total >= 3) {
          href = '/vocabulary/practice';
          title = 'Practise your saved words';
          message = 'No reviews are due right now. Make a practice set with your saved words.';
        } else {
          notes.push(
            'Vocabulary: no cards are due, and at least 3 saved words are needed for a practice set.',
          );
          continue;
        }
      }
      return {
        ...base,
        state: 'ready',
        title,
        message,
        href,
        notes,
        activity: {
          skill: activity.skill,
          title: activity.title,
          minutes: activity.minutes,
          target: activity.target,
          completed: activity.completed,
        },
      };
    }
    return {
      ...base,
      state: 'setup',
      title: 'Add material for your next practice',
      message:
        'The remaining activities need new material. Save useful words from a text to create more practice, or choose another level in Profile.',
      href: `/library?level=${level}`,
      notes,
      activity: null,
    };
  }
}
