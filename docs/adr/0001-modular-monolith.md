# ADR-0001: Modular Monolith with Events and Separate AI Services

- Status: Accepted
- Date: 2026-10-26

## Context

The platform should evolve over years by the power of the open-source community, be launched locally by one team, and scale as it grows. The team starts small, and domain boundaries are still being refined.

## Solution

1. Business logic lives in one application `apps/api` (NestJS), divided into modules with an explicit public API.
2. Background processing — a separate process `apps/worker` (BullMQ), receiving events through Transactional Outbox.
3. AI inference — a separate service `apps/ai-service` (Python/FastAPI), because it has a different runtime, ecosystem, and resource profile (GPU, memory).
4. Kubernetes, Kafka, and microservices are not used until there is measurable need.

## Consequences

- \+ One deployment, one database, simple transactions, and debugging.
- \+ Modules can be separated one by one: boundaries and events are already in place.
- − Discipline of boundaries needs to be checked automatically (architectural test), otherwise the monolith degrades into a "big ball of mud".
- − All API modules scale together; heavy operations are therefore moved out to worker and ai-service.
