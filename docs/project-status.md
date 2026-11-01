# Project status

Reviewed: 2026-11-01. This page describes the current working tree, including changes that may not yet be committed or released.

LingoUp is a functional self-hosted learning MVP. Its core workflows are available for personal use and a controlled learner pilot. Public launch readiness still requires operational, security, content-quality and workload validation. No percentage here is a measured completion metric.

## Available scope

| Area              | Available                                                                                    | Important boundary                                                         |
| ----------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Reading           | Six A1-C2 texts, glossary lookup, private generated texts and comprehension checks           | Small bundled library; new AI content needs a provider                     |
| Vocabulary/review | Manual add/edit, categories, images, pronunciation, card templates and FSRS                  | No general offline dictionary or CSV/Anki workflow                         |
| Grammar           | 100 topics, 420 exercises, structured rules and saved attempts                               | Broad reference coverage does not establish a complete reviewed curriculum |
| Speaking/writing  | AI teacher calls, local recognition, corrected writing and feedback                          | Conversation/exchange history is not durable across page sessions          |
| Listening/exams   | Local narration, questions, video/subtitles and four-section IELTS-style practice            | Temporary sessions expire after 24 hours; scores are practice estimates    |
| Progress          | Six skill tracks, daily time goal, timers, next activity, weekly reports and mistake journal | XP is not CEFR certification; the plan is not a calibrated adaptive tutor  |
| Installation      | Docker-only wizard, provider/key configuration, voice previews and hardware guidance         | Hardware detection sees the server/container, not every visitor's PC       |
| Translation       | Shared word/phrase cards across pages and explicit selection in writing fields               | AI/glossary availability and consent rules still apply                     |

## Verification and its limits

The repository includes TypeScript unit/architecture tests, API integration tests, Python service tests and desktop/mobile Playwright scenarios. GitHub Actions defines quality, integration, Python and Docker E2E jobs.

Recent focused work verified Docker web/API builds, site-wide translation on desktop/mobile, installation options and pronunciation replay/caching. Pronunciation work passed 21 focused unit tests and two real-audio browser scenarios. These are scoped checks, not evidence that the entire current checkout or every real model/provider has passed a fresh regression run.

Browser replay measurements were in the single-digit/tens-of-milliseconds range on the local test machine. First external synthesis varied into seconds. These observations are not performance guarantees for other hardware, providers or network conditions.

## Public-launch exit criteria

- [ ] Fresh full regression run with recorded environment and results.
- [ ] Clean Docker installation and upgrade with existing learner data.
- [ ] Email verification and learner password recovery.
- [ ] Public HTTPS/proxy/cookie/installation-access configuration review.
- [ ] Automated encrypted backups and a demonstrated full restore.
- [ ] Queue/resource/error alerts and an incident recovery procedure.
- [ ] Representative concurrency, model latency and memory testing.
- [ ] Teacher review of core lessons, exercises and generated feedback.
- [ ] Learner usability/accessibility testing and resolution of blocking issues.

The [roadmap](../ROADMAP.md) tracks feature work; [known limitations](architecture/tech-debt.md) records current behavior. Neither substitutes for an independent security audit or educational validation.
