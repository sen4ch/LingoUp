# Exam audio

These are synthetic recordings of LingoUp's original short practice texts, not official IELTS recordings. They are generated once with the project's existing local Piper voice and shipped with the question bank. Playing an exam does not require Edge TTS, an external voice service or an AI request quota.

The MP3 filename is the SHA-256 hash of its exact transcript in `apps/api/src/modules/learning/domain/ielts-practice.ts`. When editing a transcript, regenerate the recordings with Node 24+ and the local `ai-service` container running:

```powershell
node scripts/generate-exam-audio.mjs
```

Tests verify that every current transcript has a matching recording. The API still checks the learner's exam session before serving a file.
