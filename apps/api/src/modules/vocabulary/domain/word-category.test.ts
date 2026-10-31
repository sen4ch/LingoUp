import { describe, expect, it } from 'vitest';
import { inferWordCategory } from './word-category.js';

describe('word categories', () => {
  it.each([
    ['dressed', 'clothes'],
    ['get dressed', 'clothes'],
    ['T-shirt', 'clothes'],
    ['APPLE', 'food'],
    ['coffee', 'food'],
    ['journey', 'travel'],
    ['deadline', 'work'],
    ['flat', 'home'],
    ['bargain', 'shopping'],
    ['friendship', 'people'],
    ['forest', 'nature'],
    ['headache', 'health'],
    ['homework', 'education'],
    ['laptop', 'technology'],
    ['wake up', 'daily-life'],
  ])('recognises %s as %s', (term, category) => {
    expect(inferWordCategory(term)).toBe(category);
  });
  it.each(['stop', 'apple of my eye', 'work of art', 'a sentence about food', 'unfamiliar', ''])(
    'leaves uncertain phrase %s for manual organisation',
    (term) => {
      expect(inferWordCategory(term)).toBe('other');
    },
  );
});
