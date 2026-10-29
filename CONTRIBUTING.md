# Participation in the Project

Thank you for wanting to help! The project needs developers, English teachers, text authors, designers, and interface translators.

## How to Start

1. Read [ARCHITECTURE.md](ARCHITECTURE.md) and [docs/development.md](docs/development.md).
2. Set up the environment according to the instructions in [README.md](README.md).
3. Choose a task from issues (label `good first issue`) or from [technical debt](docs/architecture/tech-debt.md). For major changes, first open an issue for discussion.

## Process

1. Fork the repository and create a branch: `feat/…`, `fix/…`, `docs/…`, `content/…`.
2. Make small PRs, preferably one vertical slice per PR.
3. Before submitting a PR, do the following:
   ```bash
   pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration
   ```
4. Commit messages — in the style of [Conventional Commits](https://www.conventionalcommits.org/): `feat(vocabulary): …`, `fix(web): …`.
5. Fill out the checklist in the PR template.

## Architectural Rules

- A module changes only its own tables and interacts with other modules through their `index.ts`; this is checked by the architectural test.
- Side effects — through events and Transactional Outbox, handlers are idempotent.
- Significant architectural decisions are documented in ADR (`docs/adr`).
- No stubs pretending to be complete implementations: unimplemented items are explicitly documented.
- New dependencies — only with justification. Packages with install scripts require explicit approval in `pnpm-workspace.yaml`.

## Educational Content

Add only texts for which you have the rights, with indication of the author and license. The format is described in [content/README.md](content/README.md).

## Licensing Contributions

The project code is distributed under the AGPL-3.0-only license ([LICENSE](LICENSE)). By opening a PR, you agree that your contribution is distributed under the same terms (inbound = outbound). A CLA is not required. Attribute authorship honestly: do not add code for which you do not have the rights, and do not copy code with incompatible licenses.

## Behavior

By participating in the project, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
