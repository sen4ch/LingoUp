# API

- **Swagger UI:** http://localhost:4000/docs (when `SWAGGER_ENABLED=true`)
- **OpenAPI JSON:** http://localhost:4000/docs/openapi.json, copy in the repository — [openapi.json](openapi.json)
- Update the copy after changing the API: `pnpm build && pnpm openapi:export`

Request and response schemas are generated from the same Zod schemas (`packages/contracts`), which the API uses to validate requests, and the frontend uses to validate responses. Documentation and validations are consistent.

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

| Method and path                                                                              | Access  | Purpose                                                                                                         |
| -------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `GET /health/live`, `GET /health/ready`                                                      | public  | Health checks                                                                                                   |
| `POST /v1/auth/register`, `POST /v1/auth/login`                                              | public  | Registration and login, set cookie                                                                              |
| `POST /v1/auth/logout`                                                                       | session | Logout, revoke session                                                                                          |
| `GET /v1/me`, `PATCH /v1/me/settings`                                                        | session | Profile and settings                                                                                            |
| `GET /v1/me/export`, `DELETE /v1/me`                                                         | session | Export and deletion of personal data                                                                            |
| `GET /v1/texts?level=B1`, `GET /v1/texts/:slug`                                              | public  | Text library (personal text by slug — only for owner)                                                           |
| `GET /v1/texts/mine`, `DELETE /v1/texts/mine/:slug`                                          | session | Personal AI texts                                                                                               |
| `GET /v1/grammar/topics?level=A1`, `GET /v1/grammar/topics/:slug`                            | public  | Grammar; with session — progress on the topic                                                                   |
| `POST /v1/grammar/exercises/:id/attempts`                                                    | session | Checking the answer to an exercise                                                                              |
| `POST /v1/vocabulary/lookup`                                                                 | session | Word card: glossary and AI                                                                                      |
| `GET/POST /v1/vocabulary/words`, `GET/PATCH/DELETE /v1/vocabulary/words/:id`                 | session | Personal dictionary                                                                                             |
| `GET /v1/vocabulary/reviews/due`, `POST /v1/vocabulary/reviews`                              | session | FSRS repetitions                                                                                                |
| `POST /v1/vocabulary/practice`, `POST /v1/vocabulary/practice/complete`                      | session | Practice with skipping by your own words (AI or saved examples)                                                 |
| `GET /v1/vocabulary/images/search?q=…&page=1`, `GET /v1/vocabulary/images/:imageId/thumb`    | session | Search for free images (thumbnails are proxied by API)                                                          |
| `GET/PUT/DELETE /v1/vocabulary/words/:id/image`, `PUT /v1/vocabulary/words/:id/image/upload` | session | Word image: choose from search (`{ imageId }`) or upload (`Content-Type: image/*`, up to 5 MB)                  |
| `GET /v1/vocabulary/pronunciation?text=…&kind=term\|sentence`                                | session | Audio pronunciation (`audio/mpeg`); 503 with `details.aiStatus`, if speech is disabled or consent needed        |
| `POST /v1/learning/generated-texts`                                                          | session | Personal text from all words or selected `wordIds` (minimum 3; synchronously, up to `AI_GENERATION_TIMEOUT_MS`) |
| `GET /v1/learning/reading/completions`, `POST /v1/learning/reading/:slug/complete`           | session | Read texts                                                                                                      |
| `GET /v1/progress/summary`                                                                   | session | Progress summary                                                                                                |
| `POST /v1/learning/speaking/turn`                                                            | session | AI teacher's response in English: `{ messages, level?, topic? }`, last 20 messages                              |
| `POST /v1/learning/speaking/transcribe`                                                      | session | Local transcription: `audio/wav`, mono PCM16 16 kHz, up to 30 seconds / 1 MB; `{ text }`                        |
| `POST /v1/learning/listening`                                                                | session | Audio generation for 3–5 minutes and questions according to CEFR; `{ level, topic? }`                           |
| `GET /v1/learning/listening/:id/audio`                                                       | session | Owner's MP3, available 24 hours                                                                                 |
| `POST /v1/learning/listening/:id/answers`                                                    | session | Check `{ answers }`, explanations, quotes and recording text                                                    |
