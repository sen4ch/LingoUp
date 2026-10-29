## Changes

<!-- Explain the problem and the resulting behavior. -->

## Validation

<!-- Include commands, UI steps, and screenshots for interface changes. -->

## Checklist

- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [ ] Integration tests cover changes to API behavior.
- [ ] New tables belong to the owning module schema, with generated migrations (`pnpm db:generate`).
- [ ] New events have versioned contracts in `packages/contracts/src/events`.
- [ ] No secrets, personal data in logs, or unvalidated HTML are introduced.
- [ ] Architecture documentation, ADRs and technical debt are updated where relevant.
- [ ] Added learning content has a compatible license and accurate provenance.
- [ ] Interface text, documentation and bundled lesson explanations are written in English.
