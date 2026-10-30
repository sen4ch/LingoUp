# CEFR Writing feedback and IELTS-style practice

## Behavior

Writing uses the profile's target level unless the learner selects another level for the exchange. One structured review produces the complete corrected text and teaching corrections together; a separate generation continues the email conversation. The previous separate grammar and spelling model calls have been consolidated.

The complete corrected text is independent of the explanation limit. Initially visible explanations: A1 up to 3, A2 up to 4, B1 up to 5, B2 up to 6, C1/C2 all available corrections. Additional explanations remain accessible through **Show more corrections**. Selecting a highlight opens its explanation, including a hidden one.

A1 prioritizes missing verbs, complete sentences, agreement, basic verb forms and questions. Prompts request short common English and simple examples. More advanced levels receive more detailed grammar guidance. No mistake-history store was added: existing grammar exercise progress does not provide writing-error history. The prioritization helper accepts optional focus types for future integration.

The server removes unchanged corrections, duplicate source spans and unmatched quotations, and calculates UTF-16 positions against the original text. The browser checks positions before using them and preserves the source text. Optional suggestions stay separate from errors. Ambiguous `wont` is clarified rather than silently turned into refusal; explicit contextual evidence can resolve it. A full corrected version is withheld when the meaning still needs clarification.

Exams contains an original **short IELTS Academic-style practice set**, following the four-skill structure described in the [official IELTS Academic format](https://ielts.org/take-a-test/test-types/ielts-academic-test). It has four short listening parts with ten questions, three short reading passages with ten questions, two Academic writing tasks and three speaking parts. Speaking supports bounded microphone segments using the existing local transcription endpoint, or typed transcripts.

Reading and Listening use server-side keys. Writing and Speaking language receive AI estimates out of 9. Writing Task 2 has twice the weight of Task 1. The overall **practice score out of 100** averages the normalized four section results; it is not an official IELTS overall band. No overall score is fabricated in mock mode. Answer keys and listening transcripts are revealed only after completion. Attempts are user-scoped, results are idempotent on retry, and sessions expire after 24 hours.

Exam recordings are generated once with local Piper and bundled in `content/exams/audio`, with filenames derived from the exact transcript hash. They do not depend on Edge TTS or consume AI quota during playback. `scripts/generate-exam-audio.mjs` regenerates them after content edits. The browser loads the authenticated MP3 into a blob before presenting the player, with loading/error/retry states. Browser tests use a real bundled MP3 and check that playback time advances.

## Files changed for this update

- `apps/ai-service/app/writing.py`: consolidated correction/review prompts, CEFR guidance, source grounding, deduplication, ambiguity handling and full corrected text.
- `apps/ai-service/app/providers.py`, `app/main.py`: revised writing orchestration and exam assessment integration.
- `apps/ai-service/app/exams.py`: structured AI exam assessment and explicit transcript-only speaking policy.
- `packages/contracts/src/writing.ts`, `packages/ai-sdk/src/tasks.ts`: backward-compatible optional correction fields, validated positions and exam task contracts.
- `packages/contracts/src/exams.ts`, `src/index.ts`: exam session, submission and result contracts.
- `apps/web/src/components/writing-feedback.tsx`: level-adapted explanation display, complete corrected text, expansion and highlight navigation.
- `apps/web/src/lib/writing.ts`, `src/app/writing/page.tsx`: priorities, limits, validated source locations and existing writing-flow integration.
- `apps/api/src/modules/learning/domain/ielts-practice.ts`: original question bank, answer keys and scoring functions.
- `apps/api/src/modules/learning/application/exams.service.ts`, `http/exams.controller.ts`, `learning.module.ts`: authenticated exam sessions, audio, assessment and result retrieval.
- `apps/api/src/modules/ai-gateway/infrastructure/mock-ai-provider.ts`: explicitly labelled exam mock.
- `apps/web/src/app/exams/page.tsx`, `src/components/exam-recorder.tsx`: four-section exam, bounded recording, submission, score and answer review.
- `apps/web/src/components/site-header.tsx`, `src/i18n/en.ts`, `src/app/api/[...path]/route.ts`: navigation and long-running assessment proxy support.
- `README.md`: updated feature descriptions.
- Tests: `apps/ai-service/tests/test_writing.py`, `tests/test_exams.py`, `apps/web/src/lib/writing.test.ts`, `apps/web/e2e/writing.spec.ts`, `e2e/exams.spec.ts`, `apps/api/src/modules/learning/domain/ielts-practice.test.ts`.

## Verification and limits

Passed: web unit tests (45), contracts tests (6), exam service/scoring tests (2), Python AI-service tests (41), desktop/mobile writing and exam browser scenarios (6). TypeScript checks, production web/API builds, ESLint for changed TypeScript and Ruff for changed Python passed. Real local Ollama also returned a full corrected version of the supplied A1-style example, including `Did you learn?`.

AI feedback and estimated bands remain model-dependent. This is a shortened practice exam, not a calibrated or official IELTS test. Pronunciation and real-time fluency are not inferred from transcripts. Browser forms are not durable drafts; refreshing clears them. No new dependencies or database migration were needed.
