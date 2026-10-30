# Roadmap

Development follows vertical slices: each stage delivers a complete user workflow.

## Foundation and reading — complete

- [x] Architecture, ADRs and diagrams.
- [x] pnpm/Turborepo monorepo, strict TypeScript, ESLint, Prettier and CI.
- [x] Docker Compose with PostgreSQL, Valkey, API, worker, web, optional AI service and Ollama.
- [x] Registration, login, sessions, settings, data export and deletion.
- [x] A1–C2 reading library, glossary and content import.
- [x] Vocabulary lookup, saved words, FSRS reviews and review history.
- [x] Transactional Outbox, BullMQ and progress projections.
- [x] AI Gateway with mock, Ollama and OpenAI-compatible adapters.
- [x] English interface, documentation, grammar explanations and bundled glossaries.

## Grammar and personalized practice — available

- [x] A1–C2 grammar topics, structured rules, server-checked exercises and topic progress.
- [x] `ExerciseCompleted` events update progress.
- [x] Vocabulary gap exercises with validated AI output and saved-example fallback.
- [x] Private texts from all saved words or a selected subset ([ADR-0008](docs/adr/0008-grammar-and-ai-practice.md)).
- [x] Vocabulary pictures, image uploads and pronunciation.
- [ ] Learning sessions and `LessonStarted` events.
- [ ] Background generation with progress for slow models.
- [ ] AI grammar error explanations, output moderation and a topic editor.

## Listening and speaking — available

- [x] Voice calls with an English-only AI teacher and conversation context.
- [x] Local Whisper speech recognition, voice playback, microphone controls and browser policy checks.
- [x] Generated listening exercises with measured 3–5 minute local narration.
- [x] CEFR-dependent question counts, difficulty, grading, evidence and transcripts.
- [x] Publisher-hosted films and series, YouTube links and local videos with SRT/VTT subtitles.
- [ ] Long-term listening history and richer media discovery.
- [ ] Streaming teacher responses and lower-latency voice interaction.
- [x] Level-aware email writing practice with highlighted errors and explanations.
- [ ] Saved writing exchanges and long-term writing progress.

## MVP hardening

- [ ] OpenTelemetry traces across web, API, worker and AI service.
- [ ] Prometheus metrics and Grafana dashboards in `infra/monitoring`.
- [ ] Email verification and password recovery through an optional SMTP adapter.
- [ ] Session caching in Valkey.
- [ ] PWA, offline reviews and synchronization.
- [ ] A bundled open dictionary after checking source licenses.
- [ ] CSV / Anki vocabulary import and export.
- [ ] Content publishing administration.

## Assessment and planning

- [ ] Adaptive tests for reading, listening, vocabulary and grammar.
- [ ] Level estimates with confidence intervals.
- [ ] `AssessmentCompleted` and `SkillLevelUpdated` events.
- [ ] Goals, available study time and a calendar.
- [ ] Adaptive plans based on progress and weaker skills.
- [ ] Learning recommendations and `LearningPlanUpdated` events.

## Scaling when needed

- PostgreSQL read replicas and pgvector for semantic content search.
- Dedicated GPU nodes for AI workloads, for example with vLLM.
- Extract modules when an independent team or workload justifies a service boundary.
- Replace BullMQ with an event broker if many independent consumers need fan-out.
