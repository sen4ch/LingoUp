# Operations

## Deployment on a single server

```bash
cp .env.example .env    # set strong secrets: openssl rand -hex 32
docker compose up -d --build --wait
```

Mandatory for production:

1. **Reverse proxy with HTTPS** (Caddy, nginx, Traefik) in front of `web:3000`. Only it is published outside; ports PostgreSQL, Valkey, API and web in Compose are bound to `127.0.0.1`.
2. The proxy must **rewrite** `X-Forwarded-For` (not append to the client's value). Next.js passes this header to the API without changes, and the API trusts the internal network (`TRUST_PROXY=uniquelocal`). Without such a proxy, a client may spoof an IP and bypass IP limits.
3. `COOKIE_SECURE=true` and `ALLOWED_ORIGINS=https://example.com`.
4. `SWAGGER_ENABLED=false` if public API documentation is not needed.
5. Regular PostgreSQL backups (see below).

Example Caddyfile:

```caddyfile
learn.example.org {
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-For {remote_host}
    }
}
```

## Secrets

| Variable                    | Where used                     | How to set                                              |
| --------------------------- | ------------------------------ | ------------------------------------------------------- |
| `POSTGRES_PASSWORD`         | postgres, api, worker, migrate | `openssl rand -hex 32`                                  |
| `VALKEY_PASSWORD`           | valkey, api, worker            | `openssl rand -hex 32`                                  |
| `AI_SERVICE_TOKEN`          | api ↔ ai-service               | `openssl rand -hex 32` (not shorter than 32 characters) |
| `OPENAI_COMPATIBLE_API_KEY` | ai-service                     | provider key if needed                                  |

`node scripts/init-env.mjs` (or `pnpm setup:env`) creates `.env` with random secrets. In production (`NODE_ENV=production`), API, worker and ai-service refuse to start if a placeholder `change-me` remains in the secrets.

Secrets are passed only through environment variables. File `.env` in `.gitignore`; Compose refuses to start without required variables (`${VAR:?}`).

## Scaling

| Component  | How to scale                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| web, api   | Horizontally: `docker compose up -d --scale api=3` + load balancer. Sessions in PostgreSQL, limits in Valkey |
| worker     | Horizontally: relay uses `FOR UPDATE SKIP LOCKED`, BullMQ tasks are distributed among replicas               |
| ai-service | Separately from API; for GPU — vLLM/Ollama on dedicated nodes                                                |
| PostgreSQL | Pool per process is set by `DATABASE_POOL_MAX`: make sure that `replicas × pool < max_connections`           |

## Health checks and stopping

- `GET /health/live` — process is alive (does not check dependencies).
- `GET /health/ready` — PostgreSQL and Valkey are available; used in Compose healthcheck.
- ai-service: `GET /health/live`.
- On `SIGTERM` API waits for current requests (`enableShutdownHooks`); worker stops taking events, waits for handlers and closes connections (timeout 25 s, `stop_grace_period: 30s`).
- After restart PostgreSQL API and worker reconnect without restart (verified).

## Backup and restoration

The source of truth is only PostgreSQL. Valkey stores queues, limits, and quotas; its loss does not result in the loss of business data: unprocessed events remain in `platform.outbox_events` and will be resent.

### Backup

```bash
mkdir -p backups
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > backups/lingoup-$(date +%F-%H%M).dump
```

Recommendations: daily via cron, store copies off-server, encrypt (backup contains personal data and password hashes). Regularly verify recovery.

### Recovery

```bash
docker compose stop api worker web
docker compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' < backups/lingoup-YYYY-MM-DD-HHMM.dump
docker compose up -d --wait   # migrate applies migrations that appeared after the backup
```

Accounts deleted after the backup will reappear. If a user requested data deletion, repeat the deletion after recovery: maintain a log of deletion requests outside the database.

## Personal Data

- Export: `GET /v1/me/export` (button in profile) — JSON with all user data by modules.
- Deletion: `DELETE /v1/me` with password. Cascade deletion through `identity.users`, plus cleaning user events from outbox.
- Logs do not contain request bodies, cookies, authorization headers, and email (pino `redact`).
- Data to external AI providers goes only when `AI_ALLOW_EXTERNAL=true` **and** user consent in the profile.
- Speech (`SPEECH_PROVIDER=edge` or `azure`, both — Microsoft servers): individual words are sent without user consent, context-based suggestions — only with consent. The choice of provider is an administrator's decision, `AI_ALLOW_EXTERNAL` does not affect speech.

## AI Connection

By default `AI_PROVIDER=mock`: responses are explicitly marked as a mock. Options:

**Local model via Ollama (data does not leave the server):**

```bash
# .env
AI_PROVIDER=ai-service
AI_BACKEND=ollama
OLLAMA_MODEL=qwen3:4b          # check model license

docker compose --profile ollama up -d --wait
docker compose exec ollama ollama pull qwen3:4b
```

CPU is sufficient for small models; for GPU uncomment the `deploy` block in the `ollama` service.

**Ollama, already installed on the computer** (convenient for development: models and GPU are already configured):

```bash
# .env
AI_PROVIDER=ai-service
AI_BACKEND=ollama
OLLAMA_URL=http://host.docker.internal:11434   # Ollama on host, not in container
OLLAMA_MODEL=qwen3:8b                          # any model from `ollama list`
OLLAMA_THINK=false
OLLAMA_KEEP_ALIVE=30m

docker compose --profile ai up -d --wait        # ollama profile is not needed
```

- `OLLAMA_THINK=false` disables the reasoning mode for qwen3 and deepseek-r1. With it, the response takes dozens of seconds and does not fit into `AI_TIMEOUT_MS` (20 s), without it — about 2 s on GPU (measurement: qwen3:8b, warmed-up model).
- `OLLAMA_KEEP_ALIVE` keeps the model in memory; ai-service also loads it on startup. Cold loading an 8B model may take minutes, and the first request during this time will return «AI is unavailable».
- The model runs on your computer, so data is considered local and user consent is not required.

**vLLM or another OpenAI-compatible server on your infrastructure:**

```bash
AI_PROVIDER=ai-service
AI_BACKEND=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=http://vllm:8000/v1
OPENAI_COMPATIBLE_MODEL=...
OPENAI_COMPATIBLE_DATA_LOCALITY=local
```

**External API (data leaves to a third party):**

```bash
AI_PROVIDER=ai-service
AI_BACKEND=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://api.provider.example/v1
OPENAI_COMPATIBLE_API_KEY=...
OPENAI_COMPATIBLE_MODEL=...
OPENAI_COMPATIBLE_DATA_LOCALITY=external
AI_ALLOW_EXTERNAL=true         # and each user enables consent in their profile
```

Limits: `AI_TIMEOUT_MS` (word hint), `AI_GENERATION_TIMEOUT_MS` (personal text and word exercise, default 120 sec; proxy web waits for these routes up to 150 sec, so do not set higher), `AI_MAX_CONCURRENCY` (per API instance), `AI_MAX_RETRIES` (only for idempotent tasks — generation is not retried), `AI_DAILY_QUOTA_PER_USER`.

Measurement on qwen3:8b (`OLLAMA_THINK=false`, warmed-up model): personal text — 4–6 sec, word exercise — about 4 sec.

## Listening

In `/listening` there are two sections: audio generation for 3–5 minutes with questions by CEFR level and watching movies / series. For generation you need APIs, ai-service with a working LLM and Valkey. Piper TTS is local, without Microsoft keys and text transmission; voice `en_US-lessac-medium` is downloaded during the first exercise and cached in `/models/piper` of the existing models volume. Internet is needed for download, subsequent synthesis is performed on CPU. Update: `docker compose --profile ai up -d --build --wait api web ai-service`.

Audio and private answers are stored for 24 hours. The user can download MP3. When load increases, control Valkey memory: one record usually takes 1–2 MB. Original text and answers appear after question checks. Details — [ADR-0012](adr/0012-listening.md).

Movies are played through the YouTube publisher player or locally from the user's file. Local videos and SRT/VTT subtitles are not sent to the server. For YouTube, access to its domains and publisher permission for embedding is required; an alternative is to open the original by link. Browser codecs may limit the formats of local files.

## Conversation with an AI Teacher

Page `/speaking`: call with automatic sending of replies after a pause, English answers, transcription, pause, and call termination. A working AI provider and local recognition are needed:

```env
SPEAKING_ENABLED=true
WHISPER_MODEL=base
```

Run `docker compose --profile ai up -d --build --wait api web ai-service`. On the first run, `faster-whisper` downloads a multilingual model into the `whisper-models`; further recognition is performed on CPU without sending recordings to external services. `HF_HOME` and `HF_XET_CACHE` are directed to this same writable volume. For the browser, HTTPS or localhost and microphone permission are needed. English voice is taken from existing Speech settings or from local browser voices; sending text to an external service requires consent in the profile.

The response comes after processing the reply; this is a turn-based dialogue. Call data is not written to the database. Architecture and limitations — [ADR-0011](adr/0011-speaking-tutor.md).

## Pictures to Words

The user selects an image for the word (in the dictionary or in repetition): from the search for freely licensed images or uploads their own. In repetition, the «Add Image» button is available immediately, and the saved image is displayed together with the answer. Upload works always, search is activated like this:

```env
IMAGE_SEARCH_PROVIDER=wikimedia   # Wikimedia Commons: free, no key required
# IMAGE_SEARCH_PROVIDER=openverse # Openverse: more sources, but the public API can be overloaded
```

Only the search phrase is sent out; the images are downloaded by the API and saved in PostgreSQL as WebP ≤ 640 px without metadata (~30–60 KB per word). Below the image, the author, license, and source link are displayed — this is required by CC licenses. Wikimedia Commons does not filter adult content. Details — [ADR-0010](adr/0010-word-pictures.md).

## Word Pronunciation

In the word card, there are buttons 🔊 for the word and for the sentence-context. Without settings, it reads out the built-in browser voice (on Windows — Microsoft David/Zira). Natural Microsoft voices are activated in one of two ways.

### Edge (free, no key)

Voices of the Microsoft Edge «Read Aloud» function through the [edge-tts](https://github.com/rany2/edge-tts) library in ai-service. A running ai-service (`--profile ai`) and internet access are needed.

```env
SPEECH_PROVIDER=edge
EDGE_SPEECH_VOICE=en-US-AndrewMultilingualNeural   # see edge-tts --list-voices
```

This is an unofficial interface: Microsoft may change or close it, then the browser's voice will be used. The set of voices is smaller than in Azure (for example, `en-US-DerekMultilingualNeural` is not available in it). Measurement: word — about 1.6 seconds, sentence — about 4 seconds, from cache — ~15 ms.

### Azure AI Speech (official, has a free tier)

1. In the Azure portal, create a resource **Speech service** (tier Free F0 — 0.5 million characters per month).
2. On the **Keys and Endpoint** page, take the key and region.
3. Write in `.env` (not in Git):

```env
SPEECH_PROVIDER=azure
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=westeurope
AZURE_SPEECH_VOICE=en-US-DerekMultilingualNeural   # any Azure neural voice
```

4. Restart the API: `docker compose --profile ai up -d api`.

Audio is cached in Valkey on `SPEECH_CACHE_TTL_DAYS` (30 days) by voice and text, so each word is sent to Microsoft once for all accounts. Cache hit does not consume the AI daily quota, service call does. If the service does not respond, the browser will speak itself and will not contact the server for five minutes.
