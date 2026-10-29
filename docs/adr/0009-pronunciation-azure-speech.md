# ADR-0009: Text-to-Speech with Microsoft Voices (Edge and Azure AI Speech)

- Status: Accepted
- Date: 2026-10-27

## Context

In the word card, the user should hear how a word and the sentence in which it appears sound. The user selected Azure AI Speech, male American voice `en-US-DerekMultilingualNeural`. Azure is an external paid service, and the default project is self-hosted and does not send user content outside without consent (ADR-0005).

## Solution

- The AI Gateway module has been added with the `SpeechProvider` port, the `AzureSpeechProvider` adapter (REST, no SDK), and `SpeechGateway`. The API directly calls Azure without ai-service: this is a single HTTP request without models, and text-to-speech should work for any `AI_PROVIDER`.
- `SPEECH_PROVIDER=none | azure` (default is `none`). Choosing `azure` with a key is an explicit administrator decision; `AI_ALLOW_EXTERNAL` does not affect text-to-speech.
- **Privacy:** A single word (≤ 80 characters) is a dictionary unit, not personal data, and is sent without user consent. The sentence context may come from personal text, so it is sent to Azure only when the `ai_data_sharing` consent is enabled. Text is never written to logs.
- **Cost:** audio is cached in Valkey by voice and SHA-256 text hash for `SPEECH_CACHE_TTL_DAYS` (30 days) — each word is synthesized once for all accounts. A call to Azure consumes one unit of daily AI quota, while cache hit does not. Rate limit — 60 requests per minute per user.
- The route `GET /v1/vocabulary/pronunciation?text=&kind=term|sentence` returns `audio/mpeg`, so that the element `<audio>` plays it directly and the browser caches the response (`Cache-Control: private`). Errors — 503 `AI_UNAVAILABLE` with `details.aiStatus`.
- SSML is built with text escaping: the user cannot insert tags (pauses, other voices).
- **Fallback option** — built-in text-to-speech synthesis in the browser (Web Speech API). If the server does not respond, the client does not make requests to it for five minutes. For a sentence without consent, only voices that work on the device (`localService`) are selected: browser-based voices (e.g., Google in Chrome) themselves send the text to an external service.

### Additional information: free mode Edge

The user requested a free option without a key following the pattern of their AnkiTTS script (edge-tts). Added `SPEECH_PROVIDER=edge`:

- ai-service received a task `POST /v1/tasks/speech-synthesis` (library `edge-tts` 7.3.1, LGPL-3.0, compatible with AGPL). The API calls it via the adapter `AiServiceSpeechProvider`; cache, quota, and consent policy are the same as with Azure, because the text also goes to Microsoft.
- Default voice — `en-US-AndrewMultilingualNeural`: Derek is unavailable in Edge (service responds with «No audio was received»).
- This is an unofficial interface for the Microsoft Edge 'Read Aloud' feature: Microsoft's terms do not describe its use by third-party applications, and the service may change without warning. Therefore, by default `SPEECH_PROVIDER=none`, the mode enables the administrator's own installation, and if there is a failure, the browser's voice is used.

## Alternatives

- **Only browser voice.** Free and private, but quality and set of voices depend on the OS; there are often no voices in Linux.
- **Local TTS (Piper) in ai-service.** Self-hosted and private, but requires voice models and CPU. A good next step; the `SpeechProvider` port allows this.
- **Azure Speech SDK.** Heavy native dependency for a single REST call.

## Consequences

- New variables: `SPEECH_PROVIDER`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `AZURE_SPEECH_VOICE`, `SPEECH_CACHE_TTL_DAYS`. Region is validated by a regular expression to prevent host request substitution.
- Integration tests forcibly disable speech to avoid contacting a paid service.
- Cache size in Valkey is not limited separately (see tech-debt).
