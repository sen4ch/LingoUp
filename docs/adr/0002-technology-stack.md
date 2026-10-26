# ADR-0002: Технологический стек и выбор версий

- Статус: принято
- Дата: 2026-10-26

## Контекст

Нужны актуальные стабильные и **совместимые между собой** версии. Перед фиксацией проверены peer-зависимости в npm registry.

## Решение

| Компонент        | Версия                                                          | Почему                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js          | 24 LTS (Krypton)                                                | Active LTS; требуется Vitest 5 и NestJS 12                                                                                                                       |
| pnpm / Turborepo | 12 / 2                                                          | Workspaces, кэш задач, `turbo prune` для Docker                                                                                                                  |
| TypeScript       | **6.0**                                                         | TypeScript 7 (нативный компилятор) пока не поддерживается `typescript-eslint` (`<6.1`) и `@nestjs/swagger` (`^5.5 \|\| ^6`). Переход — отдельной задачей         |
| NestJS           | 12 (ESM-only)                                                   | Актуальная стабильная ветка; Fastify-адаптер                                                                                                                     |
| Валидация        | Zod 4 + собственный `ZodValidationPipe`                         | `nestjs-zod` не поддерживает NestJS 12. Пайп занимает ~20 строк; JSON Schema для OpenAPI строится через `z.toJSONSchema()`. Те же схемы используются во frontend |
| ORM              | Drizzle ORM 0.45 + drizzle-kit 0.31                             | Drizzle 1.0 пока в beta. SQL-миграции генерируются и хранятся в git                                                                                              |
| БД               | PostgreSQL 18, образ `pgvector/pgvector`                        | pgvector доступен без смены образа                                                                                                                               |
| Очереди          | BullMQ 6 + Valkey 9                                             | Open-source форк Redis (BSD)                                                                                                                                     |
| Frontend         | Next.js 16, React 19, Tailwind 4, TanStack Query 5              | Кэширование запросов, состояния загрузки и ошибок без самописного кода                                                                                           |
| FSRS             | `ts-fsrs` 5 (MIT)                                               | Эталонная реализация FSRS для JS/TS                                                                                                                              |
| Пароли           | `@node-rs/argon2` (Argon2id)                                    | Готовые бинарные сборки, без node-gyp                                                                                                                            |
| AI-сервис        | Python 3.14, FastAPI, Pydantic 2, httpx                         | Стандарт экосистемы ML                                                                                                                                           |
| Тесты            | Vitest 5 (+ SWC для метаданных декораторов), Playwright, Pytest |                                                                                                                                                                  |
| Линтер           | ESLint 9 + typescript-eslint 8                                  | ESLint 10 вышел, но `eslint-config-next` 16 тянет плагины react, jsx-a11y и import, которые официально поддерживают только ESLint ≤ 9                            |

## Последствия

- NestJS 12 работает только в ESM: относительные импорты в `apps/api` пишутся с расширением `.js` (`module: NodeNext`).
- Vitest не генерирует метаданные декораторов через esbuild, поэтому в тестах API используется `unplugin-swc`.
