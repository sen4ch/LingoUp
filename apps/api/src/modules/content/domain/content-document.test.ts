import { describe, expect, it } from 'vitest';
import { ContentFormatError, parseContentDocument } from './content-document.js';

const doc = (body: string, extra = '') => `---
slug: test-text
title: Test
level: A2
summary: A short test.
author: Tester
provenance: human
license: CC-BY-4.0
${extra}
---
${body}`;

describe('parseContentDocument', () => {
  it('splits paragraphs on blank lines and joins wrapped lines', () => {
    const parsed = parseContentDocument(doc('First line\nstill first.\n\nSecond one.'), 't.md');
    expect(parsed.paragraphs).toEqual(['First line still first.', 'Second one.']);
    expect(parsed.wordCount).toBe(6);
    expect(parsed.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('normalizes glossary terms', () => {
    const parsed = parseContentDocument(
      doc('Body.', 'glossary:\n  - term: Wake Up\n    definition: stop sleeping'),
      't.md',
    );
    expect(parsed.glossary[0]).toMatchObject({ normalizedTerm: 'wake up', translation: null });
  });

  it('rejects HTML in the body', () => {
    expect(() => parseContentDocument(doc('Hello <script>alert(1)</script>'), 't.md')).toThrow(
      ContentFormatError,
    );
  });

  it('rejects invalid metadata and duplicate glossary terms', () => {
    expect(() => parseContentDocument(doc('Body.').replace('A2', 'Z9'), 't.md')).toThrow(/level/);
    expect(() =>
      parseContentDocument(
        doc(
          'Body.',
          'glossary:\n  - term: run\n    definition: a\n  - term: Run\n    definition: b',
        ),
        't.md',
      ),
    ).toThrow(/duplicate/);
  });

  it('requires a provenance and forbids attribution licences for AI-generated texts', () => {
    expect(() =>
      parseContentDocument(doc('Body.').replace('provenance: human\n', ''), 't.md'),
    ).toThrow(/provenance/);
    expect(() =>
      parseContentDocument(
        doc('Body.').replace('provenance: human', 'provenance: ai-generated'),
        't.md',
      ),
    ).toThrow(/CC0-1.0/);
    const ok = parseContentDocument(
      doc('Body.')
        .replace('provenance: human', 'provenance: ai-generated')
        .replace('CC-BY-4.0', 'CC0-1.0'),
      't.md',
    );
    expect(ok.license).toBe('CC0-1.0');
  });

  it('requires frontmatter', () => {
    expect(() => parseContentDocument('Just text', 't.md')).toThrow(/frontmatter/);
  });
});
