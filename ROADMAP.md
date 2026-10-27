# Roadmap

Развитие идёт **вертикальными срезами**: каждый этап даёт законченный пользовательский сценарий, а не слой инфраструктуры «на будущее».

## Этап 0 — Фундамент и первый срез ✅ (текущий)

- [x] Архитектура, ADR, диаграммы
- [x] Monorepo (pnpm + Turborepo), ESLint, Prettier, TypeScript strict, CI
- [x] Docker Compose: PostgreSQL, Valkey, API, worker, web, ai-service, Ollama (опционально)
- [x] Identity: регистрация, вход, сессии, настройки, экспорт и удаление данных
- [x] Content: библиотека текстов A1–C2 и глоссарий, импорт из `content/`
- [x] Vocabulary: lookup, словарь, FSRS-повторения, история повторений
- [x] Transactional Outbox → BullMQ → проекция прогресса
- [x] AI Gateway + MockAIProvider + ai-service (mock / Ollama / OpenAI-совместимый)

## Этап 1 — Укрепление MVP

- [ ] OpenTelemetry: трейсы web → api → worker → ai-service
- [ ] Метрики Prometheus (`/metrics`), дашборды Grafana в `infra/monitoring`
- [ ] Подтверждение email и восстановление пароля (нужен SMTP-адаптер, опциональный)
- [ ] Кэш сессий в Valkey
- [ ] PWA: manifest, service worker, офлайн-повторения с синхронизацией
- [ ] Встроенный открытый словарь (например, Wiktionary-дамп — после проверки лицензии) для lookup без AI
- [ ] Импорт/экспорт словаря в CSV / Anki
- [ ] Админ-интерфейс публикации контента

## Этап 2 — Grammar + Exercises

- [x] Модуль Grammar: темы A1–C2, правила (структурированные блоки без HTML), упражнения с проверкой на сервере, прогресс по теме
- [x] Событие `ExerciseCompleted` → проекция прогресса
- [x] AI: `ExerciseGeneration` — упражнения с пропуском по словам пользователя (валидация вывода, запасной вариант без AI)
- [x] AI: `ReadingTextGeneration` — личные тексты из слов, которые учит пользователь ([ADR-0008](docs/adr/0008-grammar-and-ai-practice.md))
- [ ] Learning: учебные сессии, событие `LessonStarted`
- [ ] Генерация в worker с прогрессом (для медленных моделей)
- [ ] AI: `GrammarExplanation` — объяснение ошибки в упражнении
- [ ] Модерация AI-вывода; редактор грамматических тем

## Этап 3 — Assessment

- [ ] Адаптивный тест по навыкам (reading, listening, vocabulary, grammar)
- [ ] Оценка уровня с доверительным интервалом
- [ ] События `AssessmentCompleted`, `SkillLevelUpdated`

## Этап 4 — Planner + AI Tutor

- [ ] Цели, доступное время, календарь
- [ ] Адаптивный план на основе прогресса и слабых мест
- [ ] `LearningRecommendation`, событие `LearningPlanUpdated`
- [ ] Streaming-ответы AI Tutor (SSE)

## Этап 5 — Listening, Speaking, Writing

- [ ] Media: видео/аудио, субтитры, интеграции с внешними источниками (с проверкой лицензий)
- [ ] Speaking: `SpeechRecognition` (Whisper-совместимые модели), `SpeechSynthesis`
- [ ] Writing: `WritingAssessment` с объяснением ошибок

## Масштабирование (по мере необходимости, а не заранее)

- Реплики чтения PostgreSQL; pgvector для семантического поиска контента
- Выделение AI-нагрузки на GPU-узлы (vLLM)
- Вынос модуля в отдельный сервис, когда появится независимая команда или профиль нагрузки
- Брокер событий вместо BullMQ, если понадобится fan-out на много независимых потребителей
