# API

Reviewed: 2026-11-01. Routes below are API paths. Browser clients use the same-origin `/api` prefix, for example `/api/v1/me`. Installation administration uses a separate operator login; a learner session is not installation authorization.

- **Swagger UI:** http://localhost:4000/docs (when `SWAGGER_ENABLED=true`)
- **OpenAPI JSON:** http://localhost:4000/docs/openapi.json, copy in the repository — [openapi.json](openapi.json)
- Update the copy after changing the API: `pnpm build && pnpm openapi:export`

Declared request/response schemas come from the API's Zod contract bindings; frontend calls validate declared response contracts. The generated document includes current controller routes, but handlers without response decorators can have incomplete response schemas, particularly setup/media helpers. Consult controllers and `packages/contracts` for those details. Regenerate the snapshot after route/contract changes; do not hand-edit the JSON.

## Agreements

|                |                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Versioning     | Prefix `/v1`. Incompatible changes — new version of the route                                                              |
| Authentication | Cookie `lingoup_session` (HttpOnly, SameSite=Lax) after `POST /v1/auth/login` or `/register`                               |
| CSRF           | Changing requests from the browser must come with Origin from `ALLOWED_ORIGINS`                                            |
| Errors         | `{ "error": { "code", "message", "details?", "requestId" } }`; codes — `ERROR_CODES` in `packages/contracts/src/errors.ts` |
| Pagination     | Keyset: `?limit=20&cursor=<last item ID>`, response `{ items, nextCursor }`                                                |
| Idempotency    | `POST /v1/vocabulary/reviews` accepts `clientReviewId` (UUID); repeat returns the original result with `duplicate: true`   |
| Limits         | 300 requests/min per IP, login and registration — 10/min, lookup — 60/min, export and deletion — 5/min; `429 RATE_LIMITED` |
| Body size      | Up to 64 KB (`BODY_LIMIT_BYTES`)                                                                                           |

## Routes

| Method and path                                                                              | Access  | Purpose                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health/live`, `GET /health/ready`                                                      | public  | Health checks                                                                                                                                                                         |
| `POST /v1/auth/register`, `POST /v1/auth/login`                                              | public  | Registration and login, set cookie                                                                                                                                                    |
| `POST /v1/auth/logout`                                                                       | session | Logout, revoke session                                                                                                                                                                |
| `GET /v1/me`, `PATCH /v1/me/settings`                                                        | session | Profile and settings                                                                                                                                                                  |
| `GET /v1/me/export`, `DELETE /v1/me`                                                         | session | Export and deletion of personal data                                                                                                                                                  |
| `GET /v1/texts?level=B1`, `GET /v1/texts/:slug`                                              | public  | Text library (personal text by slug — only for owner)                                                                                                                                 |
| `GET /v1/texts/mine`, `DELETE /v1/texts/mine/:slug`                                          | session | Personal AI texts                                                                                                                                                                     |
| `GET /v1/grammar/topics?level=A1`, `GET /v1/grammar/topics/:slug`                            | public  | Grammar; with session — progress on the topic                                                                                                                                         |
| `POST /v1/grammar/exercises/:id/attempts`                                                    | session | Checking the answer to an exercise                                                                                                                                                    |
| `POST /v1/vocabulary/lookup`                                                                 | session | Word card: glossary and AI                                                                                                                                                            |
| `GET/POST /v1/vocabulary/words`, `GET/PATCH/DELETE /v1/vocabulary/words/:id`                 | session | Personal dictionary                                                                                                                                                                   |
| `GET /v1/vocabulary/reviews/due`, `POST /v1/vocabulary/reviews`                              | session | FSRS repetitions                                                                                                                                                                      |
| `POST /v1/vocabulary/practice`, `POST /v1/vocabulary/practice/complete`                      | session | Practice with skipping by your own words (AI or saved examples)                                                                                                                       |
| `GET /v1/vocabulary/images/search?q=…&page=1`, `GET /v1/vocabulary/images/:imageId/thumb`    | session | Search for free images (thumbnails are proxied by API)                                                                                                                                |
| `GET/PUT/DELETE /v1/vocabulary/words/:id/image`, `PUT /v1/vocabulary/words/:id/image/upload` | session | Word image: choose from search (`{ imageId }`) or upload (`Content-Type: image/*`, up to 5 MB)                                                                                        |
| `GET /v1/vocabulary/pronunciation?text=…&kind=term\|sentence`                                | session | Audio pronunciation (`audio/mpeg`); 503 with `details.aiStatus`, if speech is disabled or consent needed                                                                              |
| `POST /v1/learning/generated-texts`                                                          | session | Personal text from all words or selected `wordIds` (minimum 3; synchronously, up to `AI_GENERATION_TIMEOUT_MS`)                                                                       |
| `GET /v1/learning/reading/completions`, `POST /v1/learning/reading/:slug/complete`           | session | Read texts                                                                                                                                                                            |
| `GET /v1/learning/reading/:slug/check`                                                       | session | Existing comprehension check and latest saved result for the current text version; returns `{ check: null }` before creation                                                          |
| `POST /v1/learning/reading/:slug/check`                                                      | session | Prepare or reuse a personal comprehension check; answers stay on the server until submission                                                                                          |
| `POST /v1/learning/reading/:slug/check/:id/answers`                                          | session | Grade `{ answers: number[] }`, save the result, return explanations and evidence; passing at 60% completes reading once                                                               |
| `GET /v1/progress/summary`                                                                   | session | Progress summary                                                                                                                                                                      |
| `GET /v1/learning/next-practice`                                                             | session | Read-only next available unfinished daily-plan activity; includes level, destination, timer minutes, skipped-material explanations and explicit setup/complete states                 |
| `GET /v1/progress/weekly?offset=0`                                                           | session | Kyiv Monday–Sunday report; offsets 0–52, prior-week comparisons, skill XP, timer totals, saved corrections and a suggested goal                                                       |
| `POST /v1/progress/focus-time`                                                               | session | Sync `{ accountId, entries: [{ id, skill, day, milliseconds }] }`; up to 20 cumulative sessions per request, past 90 days only; retries retain the maximum total, without awarding XP |
| `GET /v1/progress/mistakes?status=open&source=writing&category=grammar`                      | session | Personal mistake journal; optional source/category/status filters, UUID cursor pagination and global open/understood counts                                                           |
| `PATCH /v1/progress/mistakes/:id`                                                            | session | Mark an owned entry as understood or reopen it with `{ resolved: boolean }`                                                                                                           |
| `POST /v1/learning/speaking/turn`                                                            | session | AI teacher's response in English: `{ messages, level?, topic? }`, last 20 messages                                                                                                    |
| `POST /v1/learning/speaking/transcribe`                                                      | session | Local transcription: `audio/wav`, mono PCM16 16 kHz, up to 30 seconds / 1 MB; `{ text }`                                                                                              |
| `POST /v1/learning/listening`                                                                | session | Audio generation for 3–5 minutes and questions according to CEFR; `{ level, topic? }`                                                                                                 |
| `GET /v1/learning/listening/:id/audio`                                                       | session | Owner's MP3, available 24 hours                                                                                                                                                       |
| `POST /v1/learning/listening/:id/answers`                                                    | session | Check `{ answers }`, explanations, quotes and recording text                                                                                                                          |
| `GET /v1/vocabulary/pronunciation/settings`                                                  | session | Non-secret voice capability/revision metadata; `enabled`, `local`, `prefetchAllowed`, `revision`; private/no-store                                                                    |
| `GET /v1/vocabulary/categories`                                                              | session | Category counts for the current learner's saved words                                                                                                                                 |
| `GET /v1/progress/development`                                                               | session | Six-skill XP/player development, daily time-budgeted plan and activity state                                                                                                          |
| `POST /v1/learning/writing/turn`                                                             | session | Level-aware email reply and assessment; bounded exchange context supplied by the client                                                                                               |
| `POST /v1/learning/exams`                                                                    | session | Start original four-section IELTS-style practice                                                                                                                                      |
| `GET /v1/learning/exams/:id`                                                                 | session | Owned temporary exam session/results                                                                                                                                                  |
| `GET /v1/learning/exams/:id/audio/:part`                                                     | session | Owned exam audio, part 0–3, `audio/mpeg`                                                                                                                                              |
| `POST /v1/learning/exams/:id/answers`                                                        | session | Grade answers and return retry-safe practice results; sessions/results expire after 24 hours                                                                                          |

## Installation API

These routes are available when browser setup is enabled. The controller is exempt from learner authentication but protects configuration actions with its own installation cookie. Mutating browser requests still require an allowed Origin. Claiming the first installation password must be done locally before exposure.

| Method and path                             | Access        | Purpose                                                              |
| ------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| `GET /v1/setup/status`                      | public        | Setup availability/completion and current installation login state   |
| `POST /v1/setup/owner`                      | initial claim | Set the first installation password; minimum 12 characters           |
| `POST /v1/setup/login`                      | public        | Authenticate the installation operator; 30-minute signed cookie      |
| `POST /v1/setup/logout`                     | installation  | End the installation login                                           |
| `GET /v1/setup/settings`                    | installation  | Read shared settings with saved keys redacted                        |
| `PUT /v1/setup/settings`                    | installation  | Save settings and return a revision; API/AI restart to apply         |
| `GET /v1/setup/hardware`                    | installation  | Server/container CPU, memory, storage and observable NVIDIA capacity |
| `POST /v1/setup/test`                       | installation  | Test the submitted provider connection/model listing                 |
| `POST /v1/setup/pull`, `GET /v1/setup/pull` | installation  | Start an Ollama download and poll its status                         |
| `POST /v1/setup/voice-preview`              | installation  | Fixed-text Edge/Piper preview, `audio/mpeg`, no-store                |

Setup settings are shared infrastructure configuration, not learner profile settings. API keys are write-only; connection tests do not imply model-generation quality or hardware capacity. See [operations](../operations.md#browser-installation).

## Persistence, retries and media

Reviews use `clientReviewId`; focus-time synchronization retains cumulative totals and does not award XP by time alone. Reading completion and activity rewards avoid duplicate completion rewards. Writing exchanges and speaking context are supplied from the current page rather than loaded as durable conversation history.

Listening and exam sessions live in Valkey for 24 hours. Binary image uploads and recognition requests have route-specific limits above the default JSON body limit. Media/helper endpoints can return buffers rather than JSON; check content type before decoding.

Speech privacy checks run before cache access. Explicit external term playback and external sentence playback have different consent requirements. Server audio is cached per provider/voice/normalized text; simultaneous identical requests share synthesis. Automatic external preparation is consent-gated and excludes paid Azure. See [pronunciation behavior](../operations.md#pronunciation-latency).
