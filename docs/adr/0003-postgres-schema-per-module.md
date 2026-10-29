# ADR-0003: One PostgreSQL database, separate schema per module

- Status: Accepted
- Date: 2026-10-26

## Context

Modules should not read other tables, but a separate DB per module complicates transactions, backups, and local startup.

## Solution

- One database, one PostgreSQL schema per module (`identity`, `content`, `vocabulary`, `learning`, `progress`, `platform`).
- Drizzle schemas are exported from `@lingoup/database` via separate subpaths (`@lingoup/database/schema/vocabulary`). A module imports only its own schema — this is checked by an architectural test.
- Cross-schema FKs are allowed only on `identity.users(id)` with `ON DELETE CASCADE`. This ensures deletion of an account guarantees deletion of all personal data.
- Links to content are stored without FK (`source_text_id` + context snapshot).
- Migrations — one common sequence (`packages/database/migrations`): drizzle-kit does not support independent chains, and when a module is separated, its schema can be moved along with migrations.

## Consequences

- \+ Atomic transactions "change + outbox event".
- \+ Module separation = moving one schema.
- − Cascade from `identity.users` links modules to Identity. This is an intentional compromise for correct deletion of personal data; when a service is separated, it will be replaced by the `UserDeleted` event.
