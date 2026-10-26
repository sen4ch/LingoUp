# Разработка

## Окружение

| Инструмент | Версия                                 | Примечание                                           |
| ---------- | -------------------------------------- | ---------------------------------------------------- |
| Node.js    | 24 LTS (`.nvmrc`)                      | `engine-strict` включён                              |
| pnpm       | 12 (`packageManager` в `package.json`) | `npm i -g pnpm@12`                                   |
| Docker     | с Compose v2                           | PostgreSQL, Valkey, сборка образов, тесты ai-service |
| Python     | 3.13+ (опционально)                    | только для разработки ai-service вне Docker          |

pnpm в этом проекте:

- блокирует install-скрипты зависимостей. Разрешённые и запрещённые перечислены в `allowBuilds` в `pnpm-workspace.yaml`. Новая зависимость с install-скриптом потребует явного решения;
- отклоняет версии пакетов, опубликованные менее суток назад (`minimumReleaseAge`). Не добавляйте исключения без причины — лучше выберите предыдущую версию.

## Первый запуск

```bash
cp .env.example .env          # замените change-me
docker compose up -d postgres valkey
pnpm install
pnpm build
pnpm db:migrate
pnpm content:import
pnpm dev
```

`pnpm dev` запускает через Turborepo:

- `apps/web` — `next dev` на :3000;
- `apps/api` — инкрементальный `tsc --watch` и автоматический перезапуск на :4000;
- `apps/worker` — то же для worker;
- `packages/*` — `tsc --watch`.

Почему API собирается через `tsc`, а не через esbuild/tsx: внедрение зависимостей в NestJS опирается на метаданные декораторов (`emitDecoratorMetadata`), а esbuild их не генерирует.

## Тесты

| Уровень            | Команда                                      | Что нужно                                                            |
| ------------------ | -------------------------------------------- | -------------------------------------------------------------------- |
| Unit + архитектура | `pnpm test`                                  | ничего                                                               |
| Интеграционные     | `pnpm test:integration`                      | PostgreSQL и Valkey из `.env`                                        |
| API smoke          | `pnpm smoke:api`                             | запущенный API (`API_URL`, по умолчанию http://localhost:4000)       |
| E2E (Playwright)   | `pnpm test:e2e`                              | запущенный стек (`E2E_BASE_URL`, по умолчанию http://localhost:3000) |
| ai-service         | `docker build --target test apps/ai-service` | Docker                                                               |

Интеграционные тесты **пересоздают** базу из `TEST_DATABASE_URL` (имя должно оканчиваться на `_test`, иначе хелпер откажется работать), применяют миграции и импортируют демо-контент. Ключи Valkey тестов API пишутся в логическую БД 15.

Браузеры для Playwright: `pnpm --filter @lingoup/web exec playwright install chromium`.

### Архитектурный тест

`apps/api/test/architecture.test.ts` запрещает:

- импортировать из другого модуля что-либо, кроме его `index.ts`;
- использовать таблицы чужой PostgreSQL-схемы;
- импортировать модули из `platform`;
- циклические зависимости между модулями.

Новый модуль нужно добавить в `OWNED_SCHEMA` в этом тесте.

## Как добавить…

### …таблицу

1. Опишите её в `packages/database/src/schema/<module>.ts` (в схеме своего модуля).
2. `pnpm db:generate` — drizzle-kit создаст SQL-миграцию в `packages/database/migrations`. Проверьте SQL глазами и закоммитьте его.
3. `pnpm db:migrate`.

Не редактируйте уже применённые миграции — добавляйте новые.

### …доменное событие

1. Контракт — в `packages/contracts/src/events/index.ts` (`defineEvent(type, version, payload)`), добавьте его в `DomainEventSchema`.
2. Публикация — `OutboxWriter.append(tx, event)` **в той же транзакции**, что и изменение данных.
3. Обработчик — класс с `EventHandler` в `apps/worker/src/handlers`, идемпотентный через `platform.processed_events`; зарегистрируйте его в `apps/worker/src/main.ts`.
4. Изменение payload несовместимым образом = новая версия события.

### …AI-задачу

1. Схемы входа и выхода — в `packages/ai-sdk/src/tasks.ts` (`AI_TASKS`), там же флаг идемпотентности.
2. Реализация — в провайдерах API (`modules/ai-gateway/infrastructure`) и в `apps/ai-service` (эндпоинт + Pydantic-схемы, которые должны совпадать с TS-контрактом).
3. Вызов — только через `AiGateway.run()`: политика приватности, квоты и таймауты применяются там.

### …учебный текст

См. [content/README.md](../content/README.md).

## Стиль кода

- TypeScript strict + `noUncheckedIndexedAccess`; ESLint `strictTypeChecked`; Prettier.
- Имена, комментарии и идентификаторы — на английском; документация для владельца — на русском.
- Строки интерфейса — только в `apps/web/src/i18n`.
- Модули API: `domain` (чистые правила), `application` (use cases), `infrastructure` (БД и адаптеры), `http` (контроллеры). Интерфейс-репозиторий заводите только при реальной необходимости.
