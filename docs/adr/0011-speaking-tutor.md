# ADR-0011: Voice Chat with an English Teacher

- Status: Accepted
- Date: 2026-10-28

## Solution

The page `/speaking` works as a call: the user activates the microphone once, the teacher greets them, then the application automatically sends a response after 1.1 seconds of silence. This is a sequential voice conversation: the response begins after recognition and generation. The "Interrupt and Respond" button stops the playback and returns the microphone to the user.

- AudioWorklet collects mono PCM, the browser converts it into WAV 16 kHz PCM16. The response is limited to 20 seconds; the server accepts up to 30 seconds and 1 MB. The header and PCM length are checked before recognition.
- `faster-whisper` (multi-language model `base`, CPU/int8) automatically recognizes the language. The model is stored in a separate Docker volume, user records are processed in memory. CPU is chosen to prevent evicting LLM from the GPU.
- Learning provides `POST /v1/learning/speaking/transcribe` and `POST /v1/learning/speaking/turn`; they require a session, have request limits, size limits, and time limits. RecognitionGateway limits parallelism and consumes the overall AI quota.
- The `speaking-tutor` task passes through the existing AI Gateway: CEFR level, topic, and the last 20 messages. The history is passed as separate `user` and `assistant` messages to allow the model to continue the conversation, rather than starting over. The server instruction requires responding only in English, briefly correcting one error, and asking the next question; this policy is additionally reinforced after the history. The topic and student's replies cannot change the teacher's role and language. Responses with non-English alphabets are rejected; this is an additional check, not a full semantic language detector.
- Text-to-speech uses the existing SpeechGateway with user consent; without consent, only local English browser voices are available. The teacher's audio may be cached by the existing TTS system. Instruction prohibits evaluating pronunciation based on text transcription.
- The microphone is disabled during response, pauses, and processing; ending the call closes the tracks and AudioContext and cancels requests and TTS. The history remains in page memory, and the call table is not created.

## Limitations

Local ASR and LLM add latency between replicas. There is no streaming audio generation and automatic voice overlap during the response. Microphone access requires HTTPS or localhost. Recognition quality depends on the model, noise, and language. English voice must be set locally or available through authorized external TTS.
