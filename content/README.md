# Учебный контент

Контент лицензируется **отдельно от исходного кода**.

## Демонстрационные тексты

Тексты в `reading/` — оригинальные материалы, написанные для этого проекта. Каждый файл указывает автора и SPDX-идентификатор лицензии во frontmatter. Предлагаемая лицензия — **CC BY 4.0**; окончательное решение за владельцем проекта (см. [ADR-0007](../docs/adr/0007-license-proposal.md)).

Не добавляйте тексты, на которые у вас нет прав: статьи из СМИ, отрывки книг, тексты из учебников. Для заимствованного материала укажите источник и совместимую лицензию (например, CC BY-SA 4.0 или public domain).

## Формат текста

```markdown
---
slug: b1-example-text # уникальный, kebab-case
title: Example Text
level: B1 # A1 | A2 | B1 | B2 | C1 | C2
summary: One or two sentences for the library card.
topics: [travel, culture]
author: Your Name
license: CC-BY-4.0 # SPDX-идентификатор, обязателен
glossary: # необязательно; работает без AI
  - term: look forward to
    partOfSpeech: phrasal verb
    definition: to feel happy about something that is going to happen
    translation: с нетерпением ждать
    example: I'm looking forward to the trip.
---

Первый абзац. Строки внутри абзаца склеиваются.

Абзацы разделяются пустой строкой. HTML запрещён.
```

## Импорт

```bash
pnpm content:import
```

Импорт идемпотентен: неизменённые файлы пропускаются (сравнивается SHA-256), изменённые обновляются вместе с глоссарием в одной транзакции. Удалённые файлы **не** удаляются из базы, потому что на тексты ссылаются сохранённые слова.

Каталоги `grammar/` и `exercises/` зарезервированы для следующих этапов (см. [ROADMAP.md](../ROADMAP.md)).
