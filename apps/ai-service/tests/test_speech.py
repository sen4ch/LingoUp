import asyncio

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

TOKEN = "t" * 32
HEADERS = {"x-ai-service-token": TOKEN}
SPEECH = {"text": "look forward to", "voice": "en-US-AndrewMultilingualNeural"}
URL = "/v1/tasks/speech-synthesis"


def client(synthesize, **overrides: object) -> TestClient:  # type: ignore[no-untyped-def]
    settings = Settings(ai_service_token=TOKEN, **overrides)  # type: ignore[arg-type]
    return TestClient(create_app(settings, synthesize=synthesize))


def test_returns_mp3_from_the_synthesizer() -> None:
    calls: list[tuple[str, str]] = []

    async def fake(text: str, voice: str) -> bytes:
        calls.append((text, voice))
        return b"ID3-audio"

    with client(fake) as c:
        response = c.post(URL, json=SPEECH, headers=HEADERS)
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"ID3-audio"
    assert calls == [("look forward to", "en-US-AndrewMultilingualNeural")]


def test_requires_the_token_and_validates_input() -> None:
    async def fake(text: str, voice: str) -> bytes:
        return b"audio"

    with client(fake) as c:
        assert c.post(URL, json=SPEECH).status_code == 401
        bad_voice = {**SPEECH, "voice": "en-US-Andrew; rm -rf"}
        assert c.post(URL, json=bad_voice, headers=HEADERS).status_code == 422
        too_long = {**SPEECH, "text": "a" * 601}
        assert c.post(URL, json=too_long, headers=HEADERS).status_code == 422


def test_failures_and_timeouts_are_502_without_echoing_the_text() -> None:
    async def failing(text: str, voice: str) -> bytes:
        raise RuntimeError(f"cannot say {text}")

    async def slow(text: str, voice: str) -> bytes:
        await asyncio.sleep(5)
        return b"audio"

    with client(failing) as c:
        response = c.post(URL, json=SPEECH, headers=HEADERS)
    assert response.status_code == 502
    assert "look forward" not in response.text

    with client(slow, speech_timeout_seconds=0.05) as c:
        assert c.post(URL, json=SPEECH, headers=HEADERS).status_code == 502
