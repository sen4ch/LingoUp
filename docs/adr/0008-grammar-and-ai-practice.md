# ADR-0008: Grammar Module, Personal AI Texts and AI Dictionary Exercises

- Status: Accepted
- Date: 2026-10-27

## Context

After the 'Reading + Dictionary' slice, the following are needed:

1. Grammar by CEFR levels: rule with examples and exercises with automatic checking.
2. Reading texts composed by AI from words the user is learning.
3. Dictionary exercises: sentences with gaps written by AI.

For texts, the user selects all words from the dictionary or manually marks the needed ones (minimum 3). For exercises, the system selects the words: first those that are due for repetition according to FSRS.

## Solution

### Grammar — a separate module with its own schema

- Schema `grammar`: `topics` (rule as structured blocks `jsonb`), `exercises` (`choice` | `gap`, allowed answers), `attempts` (user's attempt history).
- Topics — Markdown files in `content/grammar/` with YAML-frontmatter; import is idempotent, by content hash, like texts. The rule is stored not as HTML, but as blocks (`heading`, `paragraph`, `list`, `example`) with emphasis `**…**`. Web renders them as React elements, so an HTML sanitizer is not needed.
- Rules and exercises are public; correct answers are **not sent** to the client. Checking — `POST /v1/grammar/exercises/:id/attempts`, response is normalized (case, spaces, apostrophes).
- Each attempt publishes `ExerciseCompleted` through outbox; Progress counts `exercisesDone`.

### Personal AI Texts — in the Content module

- Generated text is regular text for a screen reader, so it is stored in `content.texts` with `owner_user_id`. Public directory excludes such texts, and only the owner can see them by slug (others get 404, not 403, to avoid revealing existence).
- Generation is orchestrated by Learning (`TextGenerationService`): words are taken from Vocabulary, level is taken from Identity settings, AI Gateway is called, and the text is saved through the public `PrivateTextsService` module of Content. The Content module knows nothing about AI.
  `provenance = ai-generated`, license `CC0-1.0`, author — «AI-generated for you (no human author)»: AI-generated text has no human author and no copyright (see `content/README.md`).
- Words that the model did not use (taking into account common forms: improve → improved), are returned in `missingTerms` and shown to the user.

### AI Vocabulary Exercises — in the Vocabulary module

- `POST /v1/vocabulary/practice` selects up to 8 words (minimum 3), asks AI to write sentences with a missing `___`, and checks each one (exactly one blank, the word is not left in the text). Invalid sentences are discarded.
- If AI is unavailable or disabled, the exercise is built from saved sentence-contexts of words (`source: "context"`). An error occurs only if neither is available.
- This is self-check: the correct answer comes with the exercise, and the result is sent to `POST /v1/vocabulary/practice/complete` and publishes `ExerciseCompleted`. Faking the result only affects the user's own statistics.
- ai-service automatically inserts the blank if the model leaves a word in the sentence, and discards only the invalid items, not the entire set: small local models often forget about `___`.

### Synchronous Generation

Generation is performed in an HTTP request, not in a background task:

- for generation, an individual timeout `AI_GENERATION_TIMEOUT_MS` (default 120 seconds) instead of interactive `AI_TIMEOUT_MS`; the web proxy waits for these routes up to 150 seconds;
- individual rate limit: 10 texts and 20 exercises per minute per user, plus a daily AI quota;
- generation tasks are not retried on error (non-idempotent).

On qwen3:8b through local Ollama, text is created in 4–6 seconds, exercise — in ~4 seconds, so the queue and status polling are not yet justified.

## Alternatives

- **Generation in worker via BullMQ** with status polling or SSE. Correct for slow models and high load, but requires storing the task status and complicates the UI. Deferred (see tech-debt).
- **Grammar inside Content.** Exercises with checking and attempt history — another data model and lifecycle than texts; a separate module is simpler to remove or extract.
- **Personal texts in a separate Learning schema.** The reader, tokenization, and saving words from the text would have to be duplicated.

## Consequences

- A new `grammar` module and `grammar` schema; migration `0001_grammar-and-private-texts`.
- `content.texts` has received `provenance`, `owner_user_id` (FK to `identity.users`, cascading deletion) and `focus_terms`; content format hash — `v2`, so upon first import after an update, all texts are marked as updated.
- `ExerciseCompleted` is now published (Grammar and Vocabulary), `progress.daily_activity.exercises_done`.
- Export of personal data includes sections `grammar` and `privateTexts`.
- A long HTTP request holds the connection; when load increases, generation needs to be moved to a worker.
