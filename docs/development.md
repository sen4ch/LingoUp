# Development

## Environment

| Tool    | Version                                      | Note                                                 |
| ------- | -------------------------------------------- | ---------------------------------------------------- |
| Node.js | 24 LTS (`.nvmrc`)                            | `engine-strict` is enabled                           |
| pnpm    | 12.15.0 (`packageManager` in `package.json`) | `npm i -g pnpm@12.15.0` or `corepack enable`         |
| Docker  | with Compose v2                              | PostgreSQL, Valkey, image building, tests ai-service |
| Python  | 3.13+ (optional)                             | only for development of ai-service outside Docker    |

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

| Level               | Command                                      | What is needed                                                |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Unit + architecture | `pnpm test`                                  | nothing                                                       |
| Integration         | `pnpm test:integration`                      | PostgreSQL and Valkey from `.env`                             |
| API smoke           | `pnpm smoke:api`                             | running API (`API_URL`, default http://localhost:4000)        |
| E2E (Playwright)    | `pnpm test:e2e`                              | running stack (`E2E_BASE_URL`, default http://localhost:3000) |
| ai-service          | `docker build --target test apps/ai-service` | Docker                                                        |

Integration tests **recreate** the database from `TEST_DATABASE_URL` (the name must end with `_test`, otherwise the helper will refuse to work), apply migrations, and import demo content. API Valkey test keys are written to logical DB 15.

Browsers for Playwright: `pnpm --filter @lingoup/web exec playwright install chromium`.

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
