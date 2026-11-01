import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isAcceptedAnswer, parseGrammarDocument } from './grammar-document.js';

const directory = new URL('../../../../../../content/grammar/', import.meta.url);
const lessons = readdirSync(directory)
  .filter((name) => name.endsWith('.md') && name !== 'README.md')
  .map((name) => parseGrammarDocument(readFileSync(new URL(name, directory), 'utf8'), name));

describe('published grammar reference content', () => {
  it('covers all six study levels with substantial explanations, examples and graded practice', () => {
    expect(lessons).toHaveLength(100);
    expect(new Set(lessons.map((lesson) => lesson.slug)).size).toBe(100);
    expect(new Set(lessons.map((lesson) => lesson.level))).toEqual(
      new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
    );
    expect(lessons.reduce((sum, lesson) => sum + lesson.exercises.length, 0)).toBe(420);
    for (const lesson of lessons) {
      expect(lesson.exercises.length, lesson.slug).toBeGreaterThanOrEqual(4);
      expect(
        lesson.blocks.filter((block) => block.type === 'heading').length,
        lesson.slug,
      ).toBeGreaterThanOrEqual(4);
      expect(
        lesson.blocks.filter((block) => block.type === 'example').length,
        lesson.slug,
      ).toBeGreaterThanOrEqual(3);
      expect(lesson.license, lesson.slug).toBe('CC0-1.0');
      expect(JSON.stringify(lesson), lesson.slug).not.toMatch(/[\u0400-\u04ff]/);
    }
  });
  it('has exactly one accepted option under the real grading normalisation for every choice', () => {
    for (const lesson of lessons)
      for (const exercise of lesson.exercises) {
        if (exercise.kind === 'choice')
          expect(
            exercise.options.filter((option) => isAcceptedAnswer(option, exercise.answers)),
            `${lesson.slug}: ${exercise.prompt}`,
          ).toHaveLength(1);
        expect(exercise.explanation, lesson.slug).toBeTruthy();
      }
  });
});
