# LingoUp

An open, self-hosted platform for learning English at CEFR levels A1–C2. Reading, grammar, vocabulary and spaced repetition work without AI. Optional models add personalized texts, exercises, voice conversations and listening lessons through Ollama or an OpenAI-compatible service.

The interface, bundled learning materials and project documentation are in English. You can choose a native language for AI vocabulary translations in your profile.

## Features

- **Reading:** six original demo texts, level filters, and word or phrase selection with mouse, touch or keyboard.
- **Vocabulary:** contextual word cards, a built-in glossary, optional AI explanations, saved examples, search, pictures and pronunciation.
- **Review:** FSRS scheduling, persistent review history, keyboard controls and safe retry of ratings.
- **Grammar:** ten topics across A1–C2, explanations, examples, exercises and saved progress.
- **Reading comprehension:** optional 3–5 question checks after a text, saved account results, explanations and exact supporting quotes. The six bundled texts have prepared checks; new/private texts use the configured AI provider and its sharing/usage policy. Passing at 60% marks the text read through the existing one-time Reading XP flow. An optional ungraded retelling draft is kept in the current browser tab.
- **My texts:** private AI texts using all your saved words or selected words; vocabulary gap exercises with a fallback to saved examples.
- **Speaking:** voice calls with an English-only AI teacher, local speech recognition, pause and interrupt controls, and conversation context.
- **Writing:** email exchanges with an AI pen pal at A1–C2, a full corrected text and level-adapted teaching feedback. A1/A2/B1/B2 initially show up to 3/4/5/6 explanations; further corrections expand on demand. Red spelling, yellow grammar and blue optional suggestions link to explanations. Exchanges last for the current page session.
- **Exams:** original short IELTS Academic-style Listening, Reading, Writing and Speaking practice. Completion shows a practice score out of 100, objective question results and AI writing/language estimates. It is not an official IELTS result; pronunciation and live fluency are not scored from transcripts. Exam sessions and results expire after 24 hours.
- **Listening:** measured 3–5 minute audio with level-appropriate questions and feedback; a separate section for films and series through publisher videos, YouTube links or local files with subtitles.
- **Profile:** a daily study plan matched to a saved 5–240 minute goal, six skills with earned XP, skill/player levels, 30-day activity, settings, personal data export and account deletion. Game levels reward practice independently of CEFR proficiency.
- **Continue learning:** a button in Profile, the library and reading pages rechecks the current daily plan before opening its next unfinished activity. It chooses unread level-appropriate public/owned texts, unfinished grammar topics, due reviews or vocabulary practice, and starts the skill timer while preserving remaining time. Activities without materials are skipped with explanations; completed plans and setup needs are shown explicitly. Selecting a step does not generate AI content or complete activities.
- **Weekly summary:** Monday–Sunday reports in Kyiv time, with earlier-week navigation, skill/player XP gains, active days, timer-recorded time, saved words, completed reading, common saved errors and a concrete next goal. Timer totals sync to the account cumulatively, so retries do not duplicate time; time alone grants no XP. Unrecorded time before this update cannot be recovered. Historical reports compare against the current daily time goal, and mistake review status reflects the journal now.
- **Mistake journal:** account-saved Writing, Grammar and Speaking corrections with source/type/status filters, rules and examples, optional hidden answers, and understood/reopen actions. Existing grammar mistakes are imported; new AI corrections are captured after assessment, excluding demo feedback. Entries are included in personal data export and account deletion.

AI features need a configured provider. `MockAIProvider` produces explicitly labeled demonstration output. Speaking also needs speech recognition and an English voice; listening narration uses local Piper. See [operations](docs/operations.md) for setup and limits.

| Library                                       | Word card                                                  | FSRS review                                       |
| --------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| ![Text library](docs/screenshots/library.png) | ![Word card while reading](docs/screenshots/word-card.png) | ![Vocabulary review](docs/screenshots/review.png) |

On phones, word cards open as a bottom sheet: [mobile screenshot](docs/screenshots/mobile-word-card.png).

See the [roadmap](ROADMAP.md) and [known limitations](docs/architecture/tech-debt.md) for unfinished work.

## Quick start with Docker

Install Docker with Compose v2: Docker Desktop on Windows/macOS or Docker Engine on Linux. Paid services and a GPU are optional.

```bash
git clone https://github.com/sen4ch/LingoUp.git
cd LingoUp

# Create .env with random secrets; requires Node.js 18 or later.
node scripts/init-env.mjs

# Build and start the stack. The first build takes several minutes.
docker compose up -d --build --wait
```

Without Node.js, copy `.env.example` to `.env` and replace every `change-me-…` value with a random secret, for example from `openssl rand -hex 24`. Use the same value wherever the same placeholder appears. Production services reject unchanged placeholders.

Open http://localhost:3000. The `migrate` service applies database migrations and imports demo content before application services start.

| Address                            | Purpose                              |
| ---------------------------------- | ------------------------------------ |
| http://localhost:3000              | Web application                      |
| http://localhost:4000/docs         | Swagger UI                           |
| http://localhost:4000/health/ready | API readiness, PostgreSQL and Valkey |

Optional profiles:

```bash
docker compose --profile ai up -d      # Python AI service; its default backend is also mock
docker compose --profile ollama up -d  # Adds local Ollama
```

To use a real local model, configure `AI_PROVIDER=ai-service` and `AI_BACKEND=ollama`, download the model and set its name. Full instructions, including host-installed Ollama, are in [operations](docs/operations.md).

## Local development

Requirements: **Node.js 24 LTS** (`.nvmrc`), **pnpm 12.15.0** (`packageManager`) and Docker.

```bash
npm install --global pnpm@12.15.0
pnpm setup:env
docker compose up -d postgres valkey
pnpm install
pnpm build
pnpm db:migrate
pnpm content:import
pnpm dev
```

This starts the web app on port 3000, the API on port 4000 and the background worker. See [development](docs/development.md) for test setup and contribution workflows.

## Commands

| Command                                | Purpose                                               |
| -------------------------------------- | ----------------------------------------------------- |
| `pnpm dev`                             | Start development applications                        |
| `pnpm build`                           | Build all packages and applications through Turborepo |
| `pnpm lint` / `pnpm typecheck`         | Run ESLint and TypeScript checks                      |
| `pnpm test`                            | Unit and architecture tests                           |
| `pnpm test:integration`                | Integration tests with PostgreSQL and Valkey          |
| `pnpm test:e2e`                        | Playwright tests against the running stack            |
| `pnpm smoke:api`                       | End-to-end API smoke test                             |
| `pnpm db:generate` / `pnpm db:migrate` | Generate and apply migrations                         |
| `pnpm content:import`                  | Idempotently import bundled texts and grammar         |
| `pnpm openapi:export`                  | Export `docs/api/openapi.json`                        |

## Repository layout

```text
apps/
  web/              Next.js 16 UI and same-origin API proxy
  api/              NestJS 12 + Fastify modular REST API
  worker/           BullMQ outbox relay and event handlers
  ai-service/       FastAPI model adapters, recognition and narration
packages/
  contracts/        Zod API schemas and versioned event contracts
  database/         Drizzle schemas and migrations
  learning-engine/  Pure FSRS and text-processing logic
  ai-sdk/           AI task contracts and service client
  ui/               Tailwind 4 design system
  shared/           Environment configuration and logging rules
content/            Separately licensed learning materials
infra/              Dockerfiles and reserved monitoring configuration
docs/               Architecture, ADRs, API and operations
```

## Documentation

- [Architecture](ARCHITECTURE.md): module boundaries, events, security and diagrams.
- [Architecture decisions](docs/adr/README.md).
- [Development and testing](docs/development.md).
- [Operations](docs/operations.md): deployment, secrets, backups, recovery and AI.
- [API reference](docs/api/README.md) and [OpenAPI](docs/api/openapi.json).
- [Technical debt](docs/architecture/tech-debt.md).
- [Contributing](CONTRIBUTING.md), [security](SECURITY.md) and [code of conduct](CODE_OF_CONDUCT.md).
- [Learning content format and licensing](content/README.md).

## License

Source code is licensed under **GNU Affero General Public License v3.0** (`AGPL-3.0-only`); see [LICENSE](LICENSE) and [ADR-0007](docs/adr/0007-license-proposal.md).

If you deploy a modified version for users over a network, AGPL requires access to the corresponding source code. Set `SOURCE_CODE_URL` to your repository so the application's **Source code** link points to your version.

Learning content is licensed separately in each file. Human-authored or substantially human-edited content uses CC BY 4.0 under project policy; fully AI-generated demo materials use CC0-1.0 without claiming human authorship or exclusive rights. See [content/README.md](content/README.md).

Dependencies retain their own licenses. These include MIT, Apache-2.0, BSD, ISC, MPL-2.0, LGPL-3.0 for libvips in `sharp` and `edge-tts`, and GPL-3.0 for Piper. Model weights are not included in this repository; check each model and voice license separately.
