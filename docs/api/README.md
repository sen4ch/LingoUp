# API

- **Swagger UI:** http://localhost:4000/docs (при `SWAGGER_ENABLED=true`)
- **OpenAPI JSON:** http://localhost:4000/docs/openapi.json, копия в репозитории — [openapi.json](openapi.json)
- Обновить копию после изменения API: `pnpm build && pnpm openapi:export`

Схемы запросов и ответов генерируются из тех же Zod-схем (`packages/contracts`), которыми API валидирует запросы, а frontend — ответы. Документация и проверки не расходятся.

## Соглашения

|                 |                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Версионирование | Префикс `/v1`. Несовместимые изменения — новая версия маршрута                                                            |
| Аутентификация  | Cookie `lingoup_session` (HttpOnly, SameSite=Lax) после `POST /v1/auth/login` или `/register`                             |
| CSRF            | Изменяющие запросы из браузера должны приходить с Origin из `ALLOWED_ORIGINS`                                             |
| Ошибки          | `{ "error": { "code", "message", "details?", "requestId" } }`; коды — `ERROR_CODES` в `packages/contracts/src/errors.ts`  |
| Пагинация       | Keyset: `?limit=20&cursor=<id последнего элемента>`, ответ `{ items, nextCursor }`                                        |
| Идемпотентность | `POST /v1/vocabulary/reviews` принимает `clientReviewId` (UUID); повтор возвращает исходный результат с `duplicate: true` |
| Лимиты          | 300 запросов/мин на IP, вход и регистрация — 10/мин, lookup — 60/мин, экспорт и удаление — 5/мин; `429 RATE_LIMITED`      |
| Размер тела     | До 64 КБ (`BODY_LIMIT_BYTES`)                                                                                             |

## Маршруты

| Метод и путь                                                                       | Доступ   | Назначение                                                            |
| ---------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| `GET /health/live`, `GET /health/ready`                                            | публично | Health checks                                                         |
| `POST /v1/auth/register`, `POST /v1/auth/login`                                    | публично | Регистрация и вход, устанавливают cookie                              |
| `POST /v1/auth/logout`                                                             | сессия   | Выход, отзыв сессии                                                   |
| `GET /v1/me`, `PATCH /v1/me/settings`                                              | сессия   | Профиль и настройки                                                   |
| `GET /v1/me/export`, `DELETE /v1/me`                                               | сессия   | Экспорт и удаление персональных данных                                |
| `GET /v1/texts?level=B1`, `GET /v1/texts/:slug`                                    | публично | Библиотека текстов (личный текст по slug — только владельцу)          |
| `GET /v1/texts/mine`, `DELETE /v1/texts/mine/:slug`                                | сессия   | Личные AI-тексты                                                      |
| `GET /v1/grammar/topics?level=A1`, `GET /v1/grammar/topics/:slug`                  | публично | Грамматика; с сессией — прогресс по теме                              |
| `POST /v1/grammar/exercises/:id/attempts`                                          | сессия   | Проверка ответа на упражнение                                         |
| `POST /v1/vocabulary/lookup`                                                       | сессия   | Карточка слова: глоссарий и AI                                        |
| `GET/POST /v1/vocabulary/words`, `GET/PATCH/DELETE /v1/vocabulary/words/:id`       | сессия   | Персональный словарь                                                  |
| `GET /v1/vocabulary/reviews/due`, `POST /v1/vocabulary/reviews`                    | сессия   | FSRS-повторения                                                       |
| `POST /v1/vocabulary/practice`, `POST /v1/vocabulary/practice/complete`            | сессия   | Упражнение с пропуском по своим словам (AI или сохранённые примеры)   |
| `POST /v1/learning/generated-texts`                                                | сессия   | Личный текст из своих слов (синхронно, до `AI_GENERATION_TIMEOUT_MS`) |
| `GET /v1/learning/reading/completions`, `POST /v1/learning/reading/:slug/complete` | сессия   | Прочитанные тексты                                                    |
| `GET /v1/progress/summary`                                                         | сессия   | Сводка прогресса                                                      |
