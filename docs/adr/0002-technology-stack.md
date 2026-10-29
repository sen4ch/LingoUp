# ADR-0002: Technology Stack and Version Selection

- Status: accepted
- Date: 2026-10-26

## Context

Up-to-date stable and **compatible with each other** versions are needed. Peer dependencies in npm registry were checked before fixing.

## Solution

| Component        | Version                                                      | Why                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js          | 24 LTS (Krypton)                                             | Active LTS; requires Vitest 5 and NestJS 12                                                                                                                                  |
| pnpm / Turborepo | 12 / 2                                                       | Workspaces, task cache, `turbo prune` for Docker                                                                                                                             |
| TypeScript       | **6.0**                                                      | TypeScript 7 (native compiler) is not supported by `typescript-eslint` (`<6.1`) and `@nestjs/swagger` (`^5.5 \|\| ^6`). Migration is a separate task                         |
| NestJS           | 12 (ESM-only)                                                | Current stable branch; Fastify adapter                                                                                                                                       |
| Validation       | Zod 4 + own `ZodValidationPipe`                              | `nestjs-zod` does not support NestJS 12. The pipe takes up ~20 lines; JSON Schema for OpenAPI is built through `z.toJSONSchema()`. The same schemas are used in the frontend |
| ORM              | Drizzle ORM 0.45 + drizzle-kit 0.31                          | Drizzle 1.0 is currently in beta. SQL migrations are generated and stored in git                                                                                             |
| DB               | PostgreSQL 18, image `pgvector/pgvector`                     | pgvector is available without changing the image                                                                                                                             |
| Queues           | BullMQ 6 + Valkey 9                                          | Open-source fork of Redis (BSD)                                                                                                                                              |
| Frontend         | Next.js 16, React 19, Tailwind 4, TanStack Query 5           | Caching requests, loading states and errors without custom code                                                                                                              |
| FSRS             | `ts-fsrs` 5 (MIT)                                            | Reference implementation of FSRS for JS/TS                                                                                                                                   |
| Passwords        | `@node-rs/argon2` (Argon2id)                                 | Ready binary builds, without node-gyp                                                                                                                                        |
| AI-service       | Python 3.14, FastAPI, Pydantic 2, httpx                      | Standard ML ecosystem                                                                                                                                                        |
| Tests            | Vitest 5 (+ SWC for metadata decorators), Playwright, Pytest |                                                                                                                                                                              |
| Linter           | ESLint 9 + typescript-eslint 8                               | ESLint 10 has been released, but `eslint-config-next` 16 pulls plugins react, jsx-a11y and import, which officially support only ESLint ≤ 9                                  |

## Consequences

- NestJS 12 works only in ESM: relative imports in `apps/api` are written with the `.js` extension (`module: NodeNext`).
- Vitest does not generate metadata for decorators through esbuild, so `unplugin-swc` is used in API tests.
