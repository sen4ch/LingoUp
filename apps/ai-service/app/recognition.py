"""Local multilingual recognition. Audio is decoded in memory and never stored."""

import asyncio
import io
import wave
from typing import Any


def pcm_audio(data: bytes) -> bytes:
    try:
        with wave.open(io.BytesIO(data), "rb") as audio:
            if (
                audio.getnchannels() != 1
                or audio.getsampwidth() != 2
                or audio.getframerate() != 16000
                or not 0 < audio.getnframes() <= 30 * 16000
                or audio.getcomptype() != "NONE"
            ):
                raise ValueError("Expected mono PCM16 WAV, 16 kHz, at most 30 seconds")
            frames = audio.readframes(audio.getnframes())
            if len(frames) != audio.getnframes() * 2:
                raise ValueError("Truncated audio")
            return frames
    except (wave.Error, EOFError) as error:
        raise ValueError("Unreadable WAV audio") from error


class Recognizer:
    def __init__(self, model: str, download_root: str) -> None:
        self.model = model
        self.download_root = download_root
        self._model: Any = None
        self._lock = asyncio.Lock()

    def _load(self) -> Any:
        if self._model is None:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(
                self.model,
                device="cpu",
                compute_type="int8",
                cpu_threads=4,
                download_root=self.download_root,
            )
        return self._model

    async def warm_up(self) -> None:
        async with self._lock:
            await asyncio.to_thread(self._load)

    async def transcribe(self, data: bytes) -> str:
        frames = pcm_audio(data)
        async with self._lock:
            return await asyncio.to_thread(self._transcribe, frames)

    def _transcribe(self, frames: bytes) -> str:
        import numpy as np

        samples = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
        segments, _ = self._load().transcribe(
            samples,
            language=None,
            task="transcribe",
            beam_size=1,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        return " ".join(segment.text.strip() for segment in segments).strip()[:1000]
