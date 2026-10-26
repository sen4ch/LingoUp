# Эксплуатация

## Развёртывание на одном сервере

```bash
cp .env.example .env    # задайте сильные секреты: openssl rand -hex 32
docker compose up -d --build --wait
```

Обязательно для production:

1. **Reverse proxy с HTTPS** (Caddy, nginx, Traefik) перед `web:3000`. Наружу публикуется только он; порты PostgreSQL, Valkey, API и web в Compose привязаны к `127.0.0.1`.
2. Прокси должен **перезаписывать** `X-Forwarded-For` (а не дописывать к клиентскому значению). Next.js передаёт этот заголовок в API без изменений, а API доверяет внутренней сети (`TRUST_PROXY=uniquelocal`). Без такого прокси клиент может подменить IP и обойти лимиты по IP.
3. `COOKIE_SECURE=true` и `ALLOWED_ORIGINS=https://ваш-домен`.
4. `SWAGGER_ENABLED=false`, если публичная документация API не нужна.
5. Регулярные бэкапы PostgreSQL (см. ниже).

Пример Caddyfile:

```caddyfile
learn.example.org {
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-For {remote_host}
    }
}
```

## Секреты

| Переменная                  | Где используется               | Как задать                                     |
| --------------------------- | ------------------------------ | ---------------------------------------------- |
| `POSTGRES_PASSWORD`         | postgres, api, worker, migrate | `openssl rand -hex 32`                         |
| `VALKEY_PASSWORD`           | valkey, api, worker            | `openssl rand -hex 32`                         |
| `AI_SERVICE_TOKEN`          | api ↔ ai-service               | `openssl rand -hex 32` (не короче 32 символов) |
| `OPENAI_COMPATIBLE_API_KEY` | ai-service                     | ключ провайдера, если он нужен                 |

Секреты передаются только через переменные окружения. Файл `.env` в `.gitignore`; Compose отказывается стартовать без обязательных переменных (`${VAR:?}`).

## Масштабирование

| Компонент  | Как масштабировать                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| web, api   | Горизонтально: `docker compose up -d --scale api=3` + балансировщик. Сессии в PostgreSQL, лимиты в Valkey |
| worker     | Горизонтально: relay использует `FOR UPDATE SKIP LOCKED`, задачи BullMQ распределяются между репликами    |
| ai-service | Отдельно от API; для GPU — vLLM/Ollama на выделенных узлах                                                |
| PostgreSQL | Пул на процесс задаётся `DATABASE_POOL_MAX`: следите, чтобы `реплики × пул < max_connections`             |

## Health checks и остановка

- `GET /health/live` — процесс жив (не проверяет зависимости).
- `GET /health/ready` — PostgreSQL и Valkey доступны; используется в healthcheck Compose.
- ai-service: `GET /health/live`.
- При `SIGTERM` API дожидается текущих запросов (`enableShutdownHooks`); worker перестаёт забирать события, дожидается обработчиков и закрывает соединения (таймаут 25 с, `stop_grace_period: 30s`).
- После перезапуска PostgreSQL API и worker переподключаются без рестарта (проверено).

## Резервное копирование и восстановление

Источник истины — только PostgreSQL. Valkey хранит очереди, лимиты и квоты; его потеря не приводит к потере бизнес-данных: неопубликованные события остаются в `platform.outbox_events` и будут отправлены повторно.

### Бэкап

```bash
mkdir -p backups
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > backups/lingoup-$(date +%F-%H%M).dump
```

Рекомендации: ежедневно по cron, хранить копии вне сервера, шифровать (бэкап содержит персональные данные и хеши паролей). Регулярно проверяйте восстановление.

### Восстановление

```bash
docker compose stop api worker web
docker compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' < backups/lingoup-YYYY-MM-DD-HHMM.dump
docker compose up -d --wait   # migrate применит миграции, появившиеся после бэкапа
```

Удалённые после бэкапа аккаунты появятся снова. Если пользователь требовал удаления данных, повторите удаление после восстановления: ведите журнал запросов на удаление вне БД.

## Персональные данные

- Экспорт: `GET /v1/me/export` (кнопка в профиле) — JSON со всеми данными пользователя по модулям.
- Удаление: `DELETE /v1/me` с паролем. Каскадное удаление через `identity.users`, плюс очистка событий пользователя из outbox.
- Логи не содержат тел запросов, cookie, заголовков авторизации и email (pino `redact`).
- Данные во внешние AI-провайдеры уходят только при `AI_ALLOW_EXTERNAL=true` **и** согласии пользователя в профиле.

## Подключение AI

По умолчанию `AI_PROVIDER=mock`: ответы явно помечены как заглушка. Варианты:

**Локальная модель через Ollama (данные не покидают сервер):**

```bash
# .env
AI_PROVIDER=ai-service
AI_BACKEND=ollama
OLLAMA_MODEL=qwen3:4b          # проверьте лицензию модели

docker compose --profile ollama up -d --wait
docker compose exec ollama ollama pull qwen3:4b
```

CPU достаточно для небольших моделей; для GPU раскомментируйте блок `deploy` у сервиса `ollama`.

**vLLM или другой OpenAI-совместимый сервер на вашей инфраструктуре:**

```bash
AI_PROVIDER=ai-service
AI_BACKEND=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=http://vllm:8000/v1
OPENAI_COMPATIBLE_MODEL=...
OPENAI_COMPATIBLE_DATA_LOCALITY=local
```

**Внешний API (данные уходят третьей стороне):**

```bash
AI_PROVIDER=ai-service
AI_BACKEND=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://api.provider.example/v1
OPENAI_COMPATIBLE_API_KEY=...
OPENAI_COMPATIBLE_MODEL=...
OPENAI_COMPATIBLE_DATA_LOCALITY=external
AI_ALLOW_EXTERNAL=true         # и каждый пользователь включает согласие в профиле
```

Лимиты: `AI_TIMEOUT_MS`, `AI_MAX_CONCURRENCY` (на экземпляр API), `AI_MAX_RETRIES` (только для идемпотентных задач), `AI_DAILY_QUOTA_PER_USER`.
