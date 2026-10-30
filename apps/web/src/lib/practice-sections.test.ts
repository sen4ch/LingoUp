import { describe, expect, it } from 'vitest';
import { practiceSkillForPath } from './practice-sections';

describe('practice timer sections', () => {
  it.each([
    ['/read/a1-morning-routine', 'reading'],
    ['/grammar', 'grammar'],
    ['/grammar/present-simple', 'grammar'],
    ['/listening', 'listening'],
    ['/speaking', 'speaking'],
    ['/writing', 'writing'],
    ['/review', 'vocabulary'],
    ['/vocabulary', 'vocabulary'],
    ['/vocabulary/practice', 'vocabulary'],
    ['/profile', null],
    ['/library', null],
    ['/exams', null],
    ['/grammar-other', null],
  ])('counts %s only toward %s', (path, skill) => {
    expect(practiceSkillForPath(path)).toBe(skill);
  });
});
