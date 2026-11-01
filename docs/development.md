# Development

## Environment

| Tool    | Version                                      | Note                                                          |
| ------- | -------------------------------------------- | ------------------------------------------------------------- |
| Node.js | 24 LTS (`.nvmrc`)                            | `engine-strict` is enabled                                    |
| pnpm    | 12.15.0 (`packageManager` in `package.json`) | `npm i -g pnpm@12.15.0` or `corepack enable`                  |
| Docker  | with Compose v2                              | PostgreSQL, Valkey, image building, tests ai-service          |
| Python  | 3.14 container reference (optional on host)  | Dockerfile/requirements define the tested service environment |

pnpm in this project:

- blocks install scripts of dependencies. Allowed and disallowed are listed in `allowBuilds` in `pnpm-workspace.yaml`. A new dependency with an install script will require an explicit decision;
- rejects package versions published less than a day ago (`minimumReleaseAge`). Do not add exceptions without reason — better choose the previous version.

## First Run

```bash
pnpm setup:env                # .env with random secrets (does not overwrite existing one)
docker compose up -d postgres valkey
pnpm install
pnpm build
pnpm db:migrate
pnpm content:import
pnpm dev
```

`pnpm dev` runs through Turborepo:

- `apps/web` — `next dev` on :3000;
- `apps/api` — incremental `tsc --watch` and automatic restart on :4000;
- `apps/worker` — same for worker;
- `packages/*` — `tsc --watch`.

Why API is built through `tsc`, not through esbuild/tsx: dependency injection in NestJS relies on decorator metadata (`emitDecoratorMetadata`), and esbuild does not generate them.

## Tests

| Level               | Command                                      | What is needed                                                                |
| ------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| Unit + architecture | `pnpm test`                                  | installed dependencies; build workspace packages first for dist-based imports |
| Integration         | `pnpm test:integration`                      | PostgreSQL and Valkey from `.env`                                             |
| API smoke           | `pnpm smoke:api`                             | running API (`API_URL`, default http://localhost:4000)                        |
| E2E (Playwright)    | `pnpm test:e2e`                              | running stack (`E2E_BASE_URL`, default http://localhost:3000)                 |
| ai-service          | `docker build --target test apps/ai-service` | Docker                                                                        |

Integration tests **recreate** the database from `TEST_DATABASE_URL` (the name must end with `_test`, otherwise the helper will refuse to work), apply migrations, and import demo content. API Valkey test keys are written to logical DB 15.

Browsers for Playwright: `pnpm --filter @lingoup/web exec playwright install chromium`.

### Focused scenarios and test environments

Playwright defines desktop Chromium and Pixel 7 mobile projects. Most feature tests can use deterministic route/provider fixtures, but some scenarios need additional services:

- `site-translation.spec.ts`: real temporary learner accounts and database saves, with lookup responses stubbed to avoid model cost.
- `pronunciation-cache.spec.ts`: a real enabled Edge speech provider, internet access and disposable learner accounts. It verifies network-free replay and external-consent-gated preparation. Its current assertions assume an external Edge voice; local Piper has different consent behavior and Azure does not prefetch. The default mock/core CI stack does not satisfy these prerequisites: exclude this file from that target or provide a separate Edge-enabled job before expecting the full browser suite to pass.
- `installation.spec.ts` and `installation-options.spec.ts`: a dedicated disposable browser-setup deployment, `E2E_INSTALLATION=1` and the test model fixture. These tests change shared installation settings; never point them at your everyday installation. The options scenario also downloads/uses real local Piper voices and needs first-download access.

Read each test's environment prerequisites before selecting a suite. The presence of a GitHub Actions job does not establish that every real-provider scenario is supported by its default mock configuration. Keep CI jobs/filters and provider fixtures aligned when adding environment-dependent tests.

Example focused commands from the repository root:

```bash
pnpm --filter @lingoup/web exec vitest run src/lib/pronunciation.test.ts
pnpm --filter @lingoup/api exec vitest run --project unit src/modules/ai-gateway/application/speech-gateway.test.ts
pnpm --filter @lingoup/web exec playwright test e2e/site-translation.spec.ts --workers 1
```

Use randomized `@example.test` accounts and clean up only those accounts in teardown. Browser setup tests need their own project/volumes and port. `E2E_BASE_URL` selects a browser target; it does not change the Compose project's identity. Keep service credentials and real learner data out of fixtures, traces and shared reports.

### Documentation changes

Keep README feature summaries, ROADMAP, architecture, API documentation and known limitations consistent. Separate durable records from browser-only/expiring state. Record a review date and the scope of actual verification; do not claim a full regression run from focused tests. Update generated OpenAPI after controller changes using `pnpm build && pnpm openapi:export`.

Check Markdown/JSON formatting and local links for documentation-only edits. Application tests are needed when behavior changes, not to revalidate unchanged code after a prose edit. ADRs retain their historical context; append dated implementation updates for subsequent decisions. Current scope and public-launch criteria are in [project status](project-status.md).

### Architecture Test

`apps/api/test/architecture.test.ts` prohibits:

- importing anything from another module except its `index.ts`;
- using tables from another PostgreSQL schema;
- importing modules from `platform`;
- cyclic dependencies between modules.

A new module must be added to `OWNED_SCHEMA` in this test.

## How to Add…

### …a table

1. Describe it in `packages/database/src/schema/<module>.ts` (in your module's schema).
2. `pnpm db:generate` — drizzle-kit will create an SQL migration in `packages/database/migrations`. Check the SQL with your eyes and commit it.
3. `pnpm db:migrate`.

Do not edit already applied migrations — add new ones.

### …a domain event

1. Contract — in `packages/contracts/src/events/index.ts` (`defineEvent(type, version, payload)`), add it to `DomainEventSchema`.
2. Publication — `OutboxWriter.append(tx, event)` **in the same transaction** as the data change.
3. Handler — class with `EventHandler` in `apps/worker/src/handlers`, idempotent through `platform.processed_events`; register it in `apps/worker/src/main.ts`.
4. Incompatible payload change = new version of the event.

### …AI-task

1. Input and output schemas — in `packages/ai-sdk/src/tasks.ts` (`AI_TASKS`), the same place the idempotency flag.
2. Implementation — in API providers (`modules/ai-gateway/infrastructure`) and in `apps/ai-service` (endpoint + Pydantic schemas, which should match the TS contract).
3. Call — only through `AiGateway.run()`: privacy policy, quotas and timeouts are applied there.

### …sample text

See [content/README.md](../content/README.md).

## Code Style

- TypeScript strict + `noUncheckedIndexedAccess`; ESLint `strictTypeChecked`; Prettier.
- Names, comments, identifiers and documentation are written in English.
- Interface strings — only in `apps/web/src/i18n`.
- API modules use `domain` for pure rules, `application` for use cases, `infrastructure` for databases and adapters, and `http` for controllers. Introduce repository interfaces only when they serve a concrete need.
