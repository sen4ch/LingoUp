# Models, voices and hardware

Open `/setup`, unlock installation settings and use **Hardware & compatibility** in step 2. The check runs on the application server. It reports RAM visible to Docker, CPU availability, free application storage and an NVIDIA GPU only when `nvidia-smi` is accessible in that container. It does not inspect the browser visitor's computer. GPU unknown means unobservable, not absent. CPU quotas and memory limits from Linux cgroup v1/v2 are respected.

For host-installed Ollama or a separate model server, enter that machine's specifications. Automatic app-server readings do not establish the capacity of a different endpoint. Manual values are estimates used for recommendations; they do not allocate RAM or enable a GPU. The API never sends hardware information to a model provider.

## Practical local LLM budgets

These are conservative LingoUp planning estimates for a Q4 model, approximately 4K context and one active learner, including application headroom. They are not vendor minimums, measured performance guarantees or requirements for all models. CPU-only inference is supported and may be substantially slower. Model quality and structured-output reliability should be evaluated on your own learning tasks.

| Profile  | Model       | RAM budget / preferred | CPU      | GPU VRAM for acceleration | Free model storage |
| -------- | ----------- | ---------------------- | -------- | ------------------------- | ------------------ |
| Compact  | `qwen3:4b`  | 12 / 16 GiB            | 4+ cores | 4+ GiB                    | 4+ GiB             |
| Balanced | `qwen3:8b`  | 20 / 24 GiB            | 6+ cores | 8+ GiB                    | 7+ GiB             |
| Larger   | `qwen3:14b` | 28 / 32 GiB            | 8+ cores | 12+ GiB                   | 12+ GiB            |

Model downloads are about [2.5 GB](https://ollama.com/library/qwen3:4b), [5.2 GB](https://ollama.com/library/qwen3:8b) and [9.3 GB](https://ollama.com/library/qwen3:14b). A model's download size is not its total runtime memory requirement. App-volume free disk space may differ from model-server storage. For other model names, consult their own model cards; the presets do not establish compatibility with arbitrary models.

Below 12 GiB RAM or four available CPU cores, the wizard suggests an API and browser voices. Larger budgets suggest a local model and local voice. Unknown GPU memory is never treated as confirmed acceleration. Recommendations remain editable. Multiple simultaneous learners, more context and concurrent speech/recognition need additional memory and capacity. The easy preset keeps one Ollama model loaded and one request running at a time; the Ollama adapter uses a 4096-token context budget.

### Optional NVIDIA acceleration

On a host with supported NVIDIA hardware and a working NVIDIA Container Toolkit:

```bash
docker compose -f compose.easy.yml -f compose.easy.gpu.yml up -d --build --wait
```

GPU access is granted to Ollama, not automatically to every container. The app's hardware check can still show GPU unknown while Ollama uses a GPU. Native host Ollama is another option, including platforms where native GPU support differs from Docker. See [Ollama Docker instructions](https://docs.ollama.com/docker). No Docker socket or host filesystem scan is exposed to the web application.

## API providers

The wizard offers OpenAI/GPT, Anthropic/Claude, DeepSeek and Other/OpenAI-compatible. Each preset fills its base address and an editable model name. Add a provider API key, enable external processing, and test the connection. The check reads the provider's model list; available names can be selected in the form. It does not make a paid generation request. Chat subscription access does not imply API credentials or credits. Account/model availability and billing remain with the provider.

OpenAI, DeepSeek and compatible servers use Chat Completions with JSON mode. Claude uses the native Messages API with a schema instruction and validates the returned JSON through the same task schemas. It does not send OpenAI's incompatible `json_object` option to Claude. Claude keys that are not workspace-scoped can require the optional workspace ID. Hosted named providers remain external; choose Other for a server you operate.

Keys stay write-only in the interface and are retained only for the same provider and exact endpoint. Changing provider does not silently forward its saved key to a different provider. External AI also requires each learner's consent, independently of the operator's installation permission.

Provider references: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [Claude Messages](https://platform.claude.com/docs/en/api/messages/create), [Claude model IDs](https://platform.claude.com/docs/en/models/overview), [DeepSeek setup](https://api-docs.deepseek.com/quick_start/), [DeepSeek JSON mode](https://api-docs.deepseek.com/guides/json_mode/).

## Voice choices

| Option            | Generation location                     | Practical server budget without a local LLM | Voice model download |
| ----------------- | --------------------------------------- | ------------------------------------------- | -------------------- |
| Browser voices    | Learner's device; installed voices vary | Minimal additional server load              | None                 |
| Local lightweight | Piper LJ Speech medium, CPU             | 4+ GiB RAM, 2+ CPU cores                    | About 61 MiB         |
| Local enhanced    | Piper LJ Speech high, CPU               | 8+ GiB RAM, 4+ CPU cores                    | About 109 MiB        |
| Online natural    | Microsoft Edge service                  | 2+ GiB RAM, 1+ CPU core for the app         | None                 |

Voice budgets are planning estimates, including core application headroom and excluding a local LLM. Add capacity for LLM inference and optional recognition. Local voices need no GPU. “Enhanced” identifies the larger high profile, not a guarantee of personal preference: use the fixed-text preview to compare. Edge sends pronunciation text to Microsoft and requires internet access. Local speech never falls back to Edge on the server. Browser fallback continues to respect the learner's external-sharing preference.

The first local preview downloads weights/configuration, then synthesis can run entirely offline from the model cache. The setup preview is operator-only and uses fixed public sample text. Voice files are cached in the AI service's model volume. The renderer serializes local voice jobs to limit CPU pressure. Server audio caching separates voice profiles; browser playback revalidates so a voice change takes effect. New listening recordings use the chosen local quality; medium is used when pronunciation is set to browser or Edge. Existing saved lesson recordings are retained.

Local voices use [Piper](https://github.com/OHF-Voice/piper1-gpl) and the [LJ Speech medium/high models](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/ljspeech), whose model cards identify the dataset as public domain. Piper's engine has its own GPL-3.0 license. The project does not bundle the training dataset or voice weights into its source tree.
