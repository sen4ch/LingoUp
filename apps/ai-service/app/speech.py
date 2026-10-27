"""Pronunciation audio through the Microsoft Edge read-aloud service (edge-tts).

The service needs no key but runs on Microsoft's servers: the text leaves this deployment.
The API decides what may be sent (privacy policy) and caches the audio.
"""

import asyncio
from collections.abc import Awaitable, Callable

import edge_tts
from pydantic import BaseModel, ConfigDict, Field

VOICE_PATTERN = r"^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9]+Neural$"
MAX_AUDIO_BYTES = 1024 * 1024


class SpeechInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=600)
    voice: str = Field(pattern=VOICE_PATTERN)


class SpeechError(Exception):
    """Synthesis failed; the message never contains the text."""


Synthesizer = Callable[[str, str], Awaitable[bytes]]


async def edge_synthesize(text: str, voice: str) -> bytes:
    """Returns MP3 audio (24 kHz, 48 kbit/s mono)."""
    chunks: list[bytes] = []
    try:
        async for chunk in edge_tts.Communicate(text=text, voice=voice).stream():
            if chunk["type"] == "audio" and "data" in chunk:
                chunks.append(chunk["data"])
    except Exception as error:  # noqa: BLE001 - library errors are reported by type only
        raise SpeechError(f"edge-tts failed: {type(error).__name__}") from error
    audio = b"".join(chunks)
    if not audio or len(audio) > MAX_AUDIO_BYTES:
        raise SpeechError(f"unexpected audio size: {len(audio)} bytes")
    return audio


async def synthesize_with_timeout(
    synthesize: Synthesizer, task: SpeechInput, timeout_seconds: float
) -> bytes:
    try:
        async with asyncio.timeout(timeout_seconds):
            return await synthesize(task.text, task.voice)
    except SpeechError:
        raise
    except TimeoutError as error:
        raise SpeechError("speech synthesis timed out") from error
    except Exception as error:  # noqa: BLE001 - reported by type only, never with the text
        raise SpeechError(f"speech synthesis failed: {type(error).__name__}") from error
