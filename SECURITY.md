# Security Policy

## How to Report a Vulnerability

**Do not create a public issue.** Use a private GitHub channel: tab **Security → Report a vulnerability** in the repository (GitHub Private Vulnerability Reporting; the owner needs to enable it in the repository settings).

Describe:

- affected component and version (commit);
- reproduction steps or proof of concept;
- impact assessment.

We will try to confirm receipt within 3 working days and agree on a fix timeline. After the fix is released, the information will be published with thanks to the author (if you don't mind).

## Supported Versions

Fixes are only made in the `main` branch until the first release.

## What Has Already Been Done

See [Security](ARCHITECTURE.md#9-security) in the architecture document and the [known limitations](docs/architecture/tech-debt.md).

## Recommendations for Those Deploying the Platform

See [docs/operations.md](docs/operations.md): HTTPS proxy, `X-Forwarded-For` rewrite, `COOKIE_SECURE=true`, strong secrets, encrypted backups.

Browser installation administration has a separate password/session from learner accounts. Claim it locally before exposing `/setup`. Saved provider keys are write-only through the interface but present in private runtime configuration; include those files and the matching credential volumes in protected backups. Do not enable setup on an unclaimed public installation.

Learner email verification and forgotten-password recovery are not implemented. Installation-password reset does not reset learner passwords. Current status and public-launch criteria are documented in [project status](docs/project-status.md); targeted functional tests are not a substitute for a security audit.

Logs redact known credential fields, but request URLs may include pronunciation text in query parameters. Limit log access and retention accordingly.
