# ADR-0007: Software License — MIT or AGPL-3.0

- Status: **adopted** (2026-10-27): **AGPL-3.0-only** for source code. Project owner's decision.

> The identifier `AGPL-3.0-only` was chosen, not `-or-later`: the wording of the decision is «AGPL-3.0», and the rights to future versions of the license from FSF are not provided in advance. Switching to `-or-later` is possible in the future, as long as all copyright holders agree.

- Date: 2026-10-26

Full license text — in `LICENSE` (unchanged, from gnu.org).

## Comparison

| Criterion                                    | MIT                                                                    | AGPL-3.0                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Entry barrier for contributors and companies | Minimal                                                                | Higher: many companies prohibit AGPL internally                |
| Protection against closed SaaS fork          | No: you can take the code, improve it, and sell it closed as a service | Yes: modified version accessible over the network must be open |
| Compatibility with dependencies              | Compatible with all stacks                                             | Compatible (all current dependencies are MIT/Apache/BSD)       |
| Possibility of dual licensing                | Not needed                                                             | Possible (AGPL + commercial), but will require a CLA           |
| Typical examples                             | Most libraries                                                         | Mastodon, Plausible, Grafana (since 2021)                      |

## Recommendation

- If the priority is **platform community and protection against closed SaaS clones** (product, not library): **AGPL-3.0** for `apps/*`.
- If the priority is **maximum distribution and embedding**: **MIT**.
- A hybrid is possible: `packages/*` (contracts, learning-engine, ui) under MIT, applications `apps/*` under AGPL-3.0.

## Separately licensed

- **Educational content** (`content/`): owner's decision (2026-10-27) — CC BY 4.0 for content for which the project has rights; fully AI-generated materials are published under CC0-1.0 without claiming exclusive rights. The rule is checked during import (field `provenance`), details — in `content/README.md`.
- **AI models**: model licenses from Ollama/vLLM are checked separately (for example, Llama Community License limits usage). The project does not distribute model weights.
