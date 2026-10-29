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
