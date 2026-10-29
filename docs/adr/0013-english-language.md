# ADR-0013: English interface, documentation and bundled lessons

- Status: accepted
- Date: 2026-10-28

## Context

The project owner requested a fully English website and documentation before merging the current feature work into `main`. The existing UI dictionary, grammar explanations, glossary translations and screenshots were partly or entirely Russian.

## Decision

- English is the single interface language. `apps/web/src/i18n/en.ts` supplies UI text, HTML declares `lang="en"`, and dates and compact review intervals use `en-US` formatting.
- Documentation, bundled grammar explanations, exercise feedback and screenshots are English. Reading glossaries retain English definitions and examples; the previously fixed Russian translations are omitted.
- New accounts default to English for vocabulary explanations. A new migration changes only the database default; existing native-language preferences remain intact. Users can still request AI translations in another supported native language through their profile.
- Personal vocabulary, notes, generated texts and conversation input remain user content. Changing the interface language does not rewrite those records.
- Grammar imports preserve exercise IDs and learner attempts when only titles, rules or explanations change. If prompts, kinds, answer options or accepted answers change, the importer retains the previous replacement behavior, since old attempts no longer describe the same exercise.

## Validation and consequences

Browser tests use English accessible labels and check the document language. Integration tests cover the new-account default and preservation of grammar progress during explanatory edits. Content import validates the translated YAML and lesson structure.

There is no locale selector or automatic translation of existing private records. Adding another interface language later requires a dictionary and an explicit locale-selection design.
