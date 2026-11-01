# Known limitations and technical debt

Last reviewed: 2026-11-01 against the current checkout. Implemented features belong in the [roadmap](../../ROADMAP.md); this page records remaining limits. Priorities describe work to assess, not a claim that a public security audit has been completed.

## Before a public launch

| Area                 | Current limit                                                                                                                                          | Remaining work                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Account recovery     | Learner email confirmation and forgotten-password recovery are absent. Installation-password reset is separate and does not recover learner passwords. | Add an optional SMTP flow and expiring single-use tokens.                                        |
| Authentication abuse | Registration returns 409 for an existing email; account lockout can temporarily block another learner after failed attempts.                           | Review enumeration and abuse controls alongside email verification.                              |
| Proxy trust          | The Next.js proxy forwards X-Forwarded-For. Client IP limits rely on a trusted outer proxy replacing untrusted values.                                 | Validate the actual deployment's proxy chain; see operations.                                    |
| Script policy        | The web CSP permits inline scripts for hydration.                                                                                                      | Assess nonce-based CSP and regression-test production pages.                                     |
| Backup and recovery  | Documentation describes manual backup; there is no bundled scheduled backup/restore service.                                                           | Automate encrypted copies and run restore drills, including installation and credential volumes. |
| Observability        | JSON logs and health endpoints exist; OpenTelemetry, Prometheus/Grafana and failed-job alerts are absent.                                              | Add tracing, dashboards, queue alerts and resource monitoring.                                   |
| Capacity             | Functional tests do not establish supported concurrent-user counts.                                                                                    | Benchmark representative models, audio jobs, database/Valkey use and mixed learner workloads.    |
| Learning quality     | Bundled lessons and short exam tasks are original generated materials, not a teacher-certified curriculum.                                             | Review accuracy, level placement, exercise coverage and AI feedback with teachers.               |

## Learning behavior

| Area                   | Current behavior / limit                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reading coverage       | Six bundled texts cover A1-C2, with optional private generation. This is a small starting library.                                                                                                                                           |
| Lookup without AI      | The reader can use its source glossary. Arbitrary site-wide terms need a configured working AI provider for a new explanation/translation; there is no general bundled dictionary.                                                           |
| Persistence            | Vocabulary, reviews, grammar attempts, reading results, rewards, focus time and captured mistakes are account-saved. Writing exchanges and speaking context are page-session state. Listening/exam sessions expire after 24 hours in Valkey. |
| Study calendar         | Weekly reports and daily-plan logic use Europe/Kyiv. The older activity projection uses UTC day buckets. There is no learner timezone setting.                                                                                               |
| Proficiency            | XP and player/skill levels reward activity. They do not measure CEFR proficiency. IELTS-style scores are practice estimates; live pronunciation/fluency are not assessed from transcripts.                                                   |
| Adaptation             | A time-budgeted daily plan and next-activity selection exist. A weakness-driven adaptive curriculum and calibrated proficiency testing do not.                                                                                               |
| Mistake review         | Corrections can be saved, filtered and marked understood. They are not automatically scheduled as FSRS grammar cards.                                                                                                                        |
| FSRS                   | Scheduling uses default parameters without per-learner optimization. Review history is stored for potential future optimization.                                                                                                             |
| Vocabulary practice    | Gap-fill practice includes self-check behavior. Client-visible answers are suitable for personal practice, not secure examination.                                                                                                           |
| Word matching          | Inflection matching is limited; irregular forms are not a comprehensive lemmatization dictionary.                                                                                                                                            |
| Content administration | Markdown import is supported; no browser topic/publishing editor exists.                                                                                                                                                                     |
| Offline use            | No installable PWA, offline review queue or synchronization exists.                                                                                                                                                                          |
| Interface language     | English is the intended current interface language. Native-language selection controls vocabulary translations, not UI localization.                                                                                                         |

## AI, voice and media

| Area               | Current behavior / limit                                                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generation latency | Text, lesson and exercise generation are synchronous HTTP operations. Model cold starts and proxy deadlines can still cause failures. No durable background generation/status queue exists.                                                                                    |
| Voice latency      | Speech is cached and identical in-flight requests are combined. Browser clips are bounded and can be prepared in advance. A first uncached external call still depends on provider/network latency.                                                                            |
| Edge               | Edge speech uses an unofficial external interface and may stop working. Piper and browser voices provide alternatives; local server speech does not silently switch to Edge.                                                                                                   |
| Local model setup  | Initial LLM, Whisper and voice downloads need internet and storage. Hardware recommendations are estimates, not guarantees or client-PC measurements.                                                                                                                          |
| External data      | LLM calls require operator permission and learner consent. External speech has its own policy: explicit term playback does not require sentence-sharing consent; external sentences do. Automatic external audio preparation requires learner consent and excludes paid Azure. |
| AI output          | Structured schemas and task-specific validation exist. They do not guarantee educational correctness or provide general content moderation.                                                                                                                                    |
| Streaming          | Teacher/model responses are not streamed. GrammarExplanation and LearningRecommendation remain reserved unsupported AI task contracts; speech/recognition use dedicated implementations.                                                                                       |
| Images             | User-initiated Wikimedia searches have no adult-content filter. Uploaded/selected word images are stored in PostgreSQL; large installations may need object storage.                                                                                                           |
| Browser media      | Microphones need localhost/HTTPS and permission. Video formats depend on browser codecs; YouTube availability depends on the publisher and embedding policy.                                                                                                                   |

## Operations and maintainability

- API instances share sessions and limits through PostgreSQL/Valkey, but browser-managed installation changes use filesystem state and restart the local API/AI service. Multi-replica rollout and configuration coordination need a deployment design.
- Valkey holds BullMQ jobs, quotas, speech cache and temporary listening/exam data. It has no separate audio-cache memory budget. Avoid indiscriminate eviction of shared queue state.
- Losing Valkey can discard published-but-unprocessed jobs. The relay automatically republishes only outbox rows whose published_at is null; no automatic full reconciliation tool exists.
- Migrations are a single startup job; multi-host migration coordination needs explicit deployment control.
- Database pools are per process; connection budgeting and possibly a pooler are needed when scaling.
- Learner sessions are not cached in Valkey. There is no device/session management UI or security audit trail.
- Some container images use tags rather than immutable digests. Valkey authentication is passed as a process argument in the current Compose commands.
- Frontend logic has unit tests and browser E2E coverage; there is no comprehensive isolated React component test suite.
- Python task schemas and TypeScript contracts are maintained separately and can drift.
- CI defines quality, integration, Python and browser jobs. Its presence does not mean every job has passed for this checkout. The real-audio pronunciation E2E scenario assumes an Edge-enabled target, while the default mock/core CI stack does not provide it; suite filtering or a separate provider-enabled job still needs alignment. Installation tests already require explicit disposable-stack opt-in.

See [operations](../operations.md), [development](../development.md) and [project status](../project-status.md).
