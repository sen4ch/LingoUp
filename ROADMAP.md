# Roadmap

Last reviewed: 2026-11-01. This describes the current checkout, including local changes; it is not a release announcement. See [project status](docs/project-status.md) for scope and release criteria.

## Available: core learning

- [x] Registration, login, session cookies, learner settings, export and account deletion.
- [x] English interface and responsive learning pages.
- [x] Six bundled A1-C2 reading texts, glossaries and private generated texts.
- [x] Reading comprehension checks, saved results and one-time reading completion rewards.
- [x] Contextual word/phrase lookup in the reader and across site pages, with explicit selection in writing fields.
- [x] Manual vocabulary creation and editing, categories, pictures, search and pronunciation.
- [x] Configurable card fronts/backs, including translation-first practice.
- [x] FSRS reviews, persistent review history, keyboard ratings and retry-safe submissions.
- [x] Vocabulary gap exercises with AI generation or saved-example fallback.
- [x] Grammar reference: 100 topics, 420 exercises, A1-C2 filters and saved attempts.

## Available: speaking, writing and listening

- [x] Turn-based AI teacher calls, local Whisper recognition, pause and interrupt controls.
- [x] Level-aware writing exchanges, corrected text and linked explanations.
- [x] Generated listening lessons with local narration, grading, evidence and transcripts.
- [x] Publisher video links, YouTube embeds and local video/subtitle playback.
- [x] Short original IELTS-style practice across four sections, with a practice score and explicit assessment limits.
- [x] Account-saved mistake journal for grammar, writing and speaking corrections.
- [ ] Persistent writing exchanges and speaking transcripts across page sessions.
- [ ] Long-term listening and exam history; current sessions expire after 24 hours.
- [ ] Streaming teacher responses and end-to-end voice latency improvements.

## Available: progress and daily guidance

- [x] Six skill XP tracks, player levels and completion rewards.
- [x] Saved daily study-time goal and a time-budgeted six-skill plan.
- [x] Continue learning: recheck the plan and select the next available unfinished activity.
- [x] Skill timers and retry-safe cumulative focus-time synchronization.
- [x] Kyiv Monday-Sunday weekly reports, previous-week comparisons and suggested goals.
- [x] Mark saved mistakes understood or reopen them.
- [ ] Adaptive plans driven by measured weaknesses and learning outcomes.
- [ ] User-selectable study timezone and calendar-based planning.
- [ ] Adaptive proficiency assessment with confidence intervals. XP levels do not establish CEFR proficiency.
- [ ] Producers for the reserved LessonStarted, AssessmentCompleted, SkillLevelUpdated and LearningPlanUpdated events.

## Available: installation and AI configuration

- [x] Docker-only local startup without manually editing .env or installing Node.js.
- [x] Separate browser installation login and learner accounts.
- [x] Core-only, local Ollama and hosted/custom API modes.
- [x] OpenAI/GPT, native Anthropic/Claude, DeepSeek and other compatible API presets.
- [x] Write-only provider keys, connection checks and explicit operator/learner external-processing permissions.
- [x] Docker-aware hardware detection, editable capacity estimates and model recommendations.
- [x] Optional NVIDIA Compose override for Ollama.
- [x] Browser voices, Piper medium/high, Edge, and environment-configured Azure speech.
- [x] Local/Edge fixed-text previews and automatic application of saved installation settings.
- [x] Server speech cache, identical-request coalescing and bounded browser replay cache.
- [x] Selected-word audio preparation subject to privacy/provider policy.
- [ ] Background lesson/text generation with durable jobs, status and cancellation.
- [ ] Built-in licensed dictionary for arbitrary lookup without AI.
- [ ] CSV/Anki vocabulary import and export.
- [ ] Content editing/publishing administration.

## Before a public launch

- [ ] Complete full-stack regression testing on a clean installation and an upgraded existing installation.
- [ ] Test model/provider failures, consent changes, network loss and service restarts.
- [ ] Add learner email verification and password recovery.
- [ ] Review public deployment configuration, proxy trust, CSP and installation access.
- [ ] Automate encrypted backups and demonstrate restoration of database, configuration and credentials.
- [ ] Provide queue failure alerts, resource monitoring and operational dashboards.
- [ ] Run representative concurrent-user and AI workload tests.
- [ ] Have learning materials and AI feedback reviewed by English teachers.
- [ ] Conduct usability and accessibility testing with learners on desktop and mobile.
- [ ] Keep documentation and generated API specifications synchronized with release code.

See [known limitations](docs/architecture/tech-debt.md) for implementation details. PWA/offline synchronization, personalized FSRS optimization, database scaling and dedicated inference nodes remain later work.
