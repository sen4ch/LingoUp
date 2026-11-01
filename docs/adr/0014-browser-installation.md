# ADR-0014: Browser installation and shared AI configuration

- Status: Accepted (records the implemented design)
- Reviewed: 2026-11-01

## Context

Self-hosted learners need to start with Docker and choose AI/voice services without installing Node.js or editing an environment file. Existing installations must keep their databases, credentials and environment-managed startup. Hardware guidance must distinguish the application server from a remote model endpoint or a browser visitor's device.

## Decision

Provide an optional browser wizard at `/setup`, backed by a separate Installation module. The easy Compose preset enables it and generates initial service credentials in a one-shot bootstrap job. The original Compose preset keeps browser administration disabled unless explicitly enabled.

The operator creates a separate installation password. It is not a learner account, cannot access learner data and is not a learner-password recovery mechanism. Shared-settings actions require its signed, HttpOnly, SameSite=Strict session cookie, which expires after 30 minutes. Browser mutations also pass origin checks.

Store installation login/signing state in `owner.json` and runtime settings in `runtime.json` in a private mounted volume. Runtime provider keys are write-only through HTTP responses but readable by the API/AI service. Preserve a blank submitted key only for the same provider and exact endpoint; provider/address changes must not silently forward the old credential.

Save configuration atomically. Apply it through graceful API shutdown and the Docker restart policy, plus an AI-service configuration watcher/restart. The wizard polls the active revision. This avoids a Docker socket mount or general container-control endpoint, but does not implement coordinated multi-replica rollout.

Support core-only learning, local Ollama and hosted/custom API configuration. Named presets include OpenAI/GPT, native Anthropic/Claude and DeepSeek. External model processing needs both the operator's permission and each learner's consent. Choosing a provider does not prove structured-output quality for every task.

Offer browser voices, local Piper medium/high and Edge, with operator-only fixed-text previews for server voices. Azure remains environment-configured. Voice privacy and caching follow [ADR-0009](0009-pronunciation-azure-speech.md).

Detect CPU availability, memory/cgroup constraints, application-volume free storage and observable NVIDIA information on the server. Explain unknown/unobservable readings and allow manual remote-server estimates. Recommendations do not allocate resources, enable GPU access or inspect the visitor's PC. The optional GPU override grants access to Ollama; the API's detector may still report GPU unknown.

## Consequences

- The easy preset uses its own Compose project and credential/data volumes. Switching from the original preset is not an automatic migration.
- Backups must preserve installation configuration and the matching credential set alongside the database. Model caches can be downloaded again unless offline recovery is required.
- First setup must be claimed locally before public exposure. Installation-password recovery is a trusted host-operator action described in operations.
- Model downloads and first voice/recognition loads can take time and disk space. Hardware recommendations are planning estimates, not latency guarantees.
- Configuration changes can briefly interrupt requests. Multiple API/AI replicas need an explicit shared-configuration/reload design.
- Installation browser tests use a disposable deployment and explicit opt-in because they change shared settings.

## References

- [Browser installation and recovery](../operations.md#browser-installation)
- [Model/voice budgets and detection limits](../setup-hardware.md)
- [Installation API](../api/README.md#installation-api)
