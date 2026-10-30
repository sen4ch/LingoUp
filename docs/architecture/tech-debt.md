# Technical debt and MVP limitations

Honest list: everything listed is **not implemented** or implemented in a simplified manner. Priority: 🔴 important until public launch, 🟡 desirable, ⚪ as the project grows.

## Security and privacy

|     | Item                                                                          | Comment                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴  | No email confirmation and password recovery                                   | An optional SMTP adapter is needed. For now, forgotten password = lost account                                                                                             |
| 🔴  | Registration reveals that email is already taken (409)                        | Acceptable without email confirmation; respond the same way after it appears                                                                                               |
| 🔴  | IP limits depend on correct `X-Forwarded-For`                                 | Next.js does not overwrite the client header. In production, a reverse proxy that overwrites it is needed (see operations.md). Additional account-based limits are applied |
| 🟡  | Account login blocking can be used for temporarily blocking a foreign account | 15 minutes after 10 failed attempts; requires CAPTCHA or email confirmation                                                                                                |
| 🟡  | Valkey password is passed as the `--requirepass` argument                     | Visible in `docker inspect` and container process list; better to use a config file or Docker secrets                                                                      |
| 🟡  | Base images are pinned by tag, not by digest                                  | For reproducibility and protection against tag substitution, pin to `@sha256:…`                                                                                            |
| 🟡  | CSP allows `'unsafe-inline'` for scripts                                      | Needs nonce-based CSP in Next.js (middleware/proxy)                                                                                                                        |
| 🟡  | No audit log (logins, account deletion, export)                               |                                                                                                                                                                            |
| 🟡  | Token rotation and device list in UI are not used                             | Table stores data; no UI "Logout from all devices"                                                                                                                         |
| ⚪  | Swagger UI is enabled by default                                              | Disable in production: `SWAGGER_ENABLED=false`                                                                                                                             |

## Functionality

|     | Item                                                                                                                                     | Comment                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 🟡  | Lookup without AI works only for words from the text glossary                                                                            | Need built-in open dictionary (license check for Wiktionary/WordNet)                                                           |
| 🟡  | Saved words are not highlighted in public texts                                                                                          | In personal AI texts, words under which the text was created are underlined; API returns `savedWordId` only during lookup      |
| 🟡  | There is no UI for editing a word                                                                                                        | `PATCH /v1/vocabulary/words/:id` is implemented                                                                                |
| 🟡  | Activity day is counted in UTC                                                                                                           | Time zone is needed in settings and in event payload                                                                           |
| 🟡  | FSRS parameters — default, without personal optimization                                                                                 | Full repetition history is stored; optimizer can be added later                                                                |
| ⚪  | One interface language (English)                                                                                                         | Strings are moved to `apps/web/src/i18n`, language switching is not implemented                                                |
| ⚪  | PWA is not implemented                                                                                                                   | No manifest and service worker                                                                                                 |
| ⚪  | Streaming AI responses is not implemented                                                                                                | Not needed for `WordExplanation`                                                                                               |
| ⚪  | Declared but not implemented AI tasks: GrammarExplanation, SpeechRecognition, SpeechSynthesis, LearningRecommendation | Gateway responds `not_supported`                                                                                               |
| 🟡  | AI-generated text and exercises in sync                                                                                                  | The request stays until `AI_GENERATION_TIMEOUT_MS` (120 sec). For slow models, move to worker with status polling (ADR-0008)   |
| 🟡  | Text-to-speech depends on Microsoft servers                                                                                              | `edge` mode is unofficial and may stop working; for pronunciation, a fallback is the browser voice; listening uses local Piper |
| 🟡  | Image search in Wikimedia Commons without adult content filter                                                                           | The search is initiated by the user itself; Openverse has a filter, but the API is unstable                                    |
| ⚪  | No image generation                                                                                                                      | Local Stable Diffusion requires ~7 GB and shares video memory with LLM; can be added as another source                         |
| ⚪  | Images are stored in PostgreSQL                                                                                                          | ~30–60 KB per word; when growing — object storage (S3-compatible)                                                              |
| ⚪  | Audio cache in Valkey is not limited in size                                                                                             | Word ~10 KB, sentence up to ~150 KB; when growing requires `maxmemory-policy` or file storage                                  |
| 🟡  | No moderation of AI output                                                                                                               | Structure and presence of words are checked; personal text is visible only to its owner                                        |
| 🟡  | Word exercise — self-check                                                                                                               | Answers are sent to the client; fabricating results affects only personal statistics                                           |
| ⚪  | Word forms are recognized only for regular endings                                                                                       | improve → improved is recognized, buy → bought — no                                                                            |
| ⚪  | Grammar errors are not returned for repetition                                                                                           | No connection between exercises and FSRS                                                                                       |
| ⚪  | Events LessonStarted, AssessmentCompleted, SkillLevelUpdated, LearningPlanUpdated — only contracts                                       | No producers                                                                                                                   |
| ⚪  | Modules Assessment, Planner, Media are not implemented                                                                                   | See ROADMAP.md                                                                                                                 |

## Infrastructure and Observability

|     | Item                                                      | Comment                                                                           |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 🟡  | No OpenTelemetry and Prometheus metrics                   | Structured logs with request id and health checks are present                     |
| 🟡  | No monitoring for failed BullMQ tasks                     | Tasks with exhausted attempts are stored for 7 days; an alert/dashboard is needed |
| 🟡  | PostgreSQL pool is set manually by the process            | PgBouncer is needed when scaling                                                  |
| ⚪  | Session cache in Valkey is not implemented                | Currently, one index query in PostgreSQL per request                              |
| ⚪  | AI response cache is not implemented                      | Identical lookups repeatedly call the model                                       |
| ⚪  | Migrations are run by a separate service without blocking | Do not run `migrate` in parallel on multiple hosts                                |

## Quality

|     | Item                                                           | Comment                                                                                         |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 🟡  | No unit-tests for React components                             | Logic for selection is extracted into `selection.ts` and covered by tests; UI is covered by E2E |
| 🟡  | Pydantic schemas of ai-service manually duplicate TS contracts | Can be generated from JSON Schema (`z.toJSONSchema`)                                            |
| ⚪  | TypeScript 6 instead of 7                                      | TS 7 is not supported by typescript-eslint and @nestjs/swagger (ADR-0002)                       |
| ⚪  | ESLint 9 instead of 10                                         | eslint-config-next plugins are not yet supporting ESLint 10                                     |
| ⚪  | `fastapi.testclient` emits DeprecationWarning (httpx → httpx2) | Warning in dependency, not in our code                                                          |
| ⚪  | Code license is not selected                                   | Owner's solution, ADR-0007                                                                      |
