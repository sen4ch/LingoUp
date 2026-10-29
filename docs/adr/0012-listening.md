# ADR-0012: Listening — audio with questions and video viewing

- Status: accepted
- Date: 2026-10-28

## Solution

The page `/listening` contains exactly two sections: "Audio and Questions" and "Movies and Series".

### Exercise Generation

- AI first creates a coherent multi-paragraph text, then separately generates questions based on the prepared text. This provides local models with sufficient output volume for long recordings. A short draft is supplemented before the conclusion; only text between 450–750 words is accepted.
- The CEFR level determines the vocabulary, grammar, and type of questions. A1–A2: 5 questions; B1–B2: 6; C1–C2: 8. For B2 and above, questions on inference, attitude, and intentions are mandatory. Each answer has a quote, which is checked for presence in the text.
- Voice-over — local Piper `en_US-lessac-medium` on CPU. The model automatically loads into `/models/piper` within an existing model volume. Synthesized WAV files are converted by PyAV into a single MP3 with correct metadata. Duration is measured by audio; if it exceeds 180–300 seconds, speech is resynthesized with a modified speaking rate. Unacceptable duration is rejected, and pauses for artificial elongation are not added.
- Piper: [source code and GPL-3.0 license](https://github.com/OHF-Voice/piper1-gpl); [voice card and data source](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/lessac/medium/MODEL_CARD). External text-to-speech is not used for exercises. Existing AI Gateway agreements apply for external LLMs.
- Learning stores MP3 and private answers in Valkey for 24 hours under owner ID keys. Correct answers, explanations, and recording text are not released until answers are checked. Redownloading does not trigger AI; the file can be saved as MP3. Foreign or expired exercises return 404.
- Routes: `POST /v1/learning/listening`, `GET /v1/learning/listening/:id/audio`, `POST /v1/learning/listening/:id/answers`. Session is required; generation is limited by frequency and overall AI quota. Separate parallelism and timeout limits are used for generation and text-to-speech. Web proxy waits for exercise creation up to 5 minutes.

### Movies and Series

- Starter selection: educational BBC Learning English series The Flatmates and open-source film Blender Foundation Sintel. Viewing through the publisher's YouTube player, without downloading or bypassing restrictions. The user can also open a YouTube video or playlist by the link.
- Only `youtube-nocookie.com` is allowed in an iframe; video IDs and playlists are checked, arbitrary URLs are not embedded. Referrer is passed according to YouTube's requirements. If the publisher prohibits embedding, a link to the original is available.
- Original movies and series are opened locally through Blob URL, without uploading to the server. English WebVTT/SRT subtitles are supported; SRT is converted to WebVTT. Codec availability depends on the browser; MP4/H.264 and WebM are recommended.

## Limitations

AI questions are checked structurally and by quotes, but this does not replace editorial assessment of their definitiveness. Exercises are temporary, separate tables and long-term history of results are not created. Control of audio cache volume is needed when the number of users grows. The external video catalog depends on the availability of clips, publisher restrictions, and subtitles.
