import { describe, expect, it } from 'vitest';
import { findMissingTerms } from './text-generation.service.js';

describe('findMissingTerms', () => {
  it('reports terms the generated text does not contain as whole words', () => {
    const paragraphs = ['The market was Crowded.', "I can't give up now, what a bargain!"];
    expect(
      findMissingTerms(paragraphs, ['crowded', 'give up', 'bargain', 'stall', 'mark']),
    ).toEqual(['stall', 'mark']);
  });

  it('accepts regular inflections of the requested terms', () => {
    const paragraphs = ['She improved her cooking and found two bargains. He gave up.'];
    expect(findMissingTerms(paragraphs, ['improve', 'bargain', 'give up'])).toEqual(['give up']);
  });
});
