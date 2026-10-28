import io
import json
import wave
from unittest.mock import AsyncMock, patch

import httpx
import pytest
import respx
from test_api import HEADERS, client

from app.prompts import speaking_messages
from app.recognition import pcm_audio
from app.schemas import SpeakingTutorInput, SpeakingTutorOutput


def test_speaking_preserves_chat_roles_and_only_opens_an_empty_conversation() -> None:
    history = [
        {"role": "assistant", "content": "Hello! How do you spend your free time?"},
        {"role": "user", "content": "I play football with my brother."},
        {"role": "assistant", "content": "That sounds fun. Where do you play?"},
        {"role": "user", "content": "In a park near our home."},
    ]
    messages = speaking_messages(
        SpeakingTutorInput(level="A2", topic="Free time", messages=history)
    )
    assert [message["role"] for message in messages] == [
        "system",
        "user",
        "assistant",
        "user",
        "assistant",
        "user",
        "system",
    ]
    assert messages[-2]["content"] == history[-1]["content"]
    assert json.loads(messages[-3]["content"]) == {"reply": history[-2]["content"]}
    assert "MUST be in English only" in messages[-1]["content"]
    assert "Begin the call" not in messages[1]["content"]
    assert "ONLY on the first turn" in messages[0]["content"]
    initial = speaking_messages(SpeakingTutorInput(level="A2", topic="Free time", messages=[]))
    assert "Begin the call" in initial[-2]["content"]


def wav(seconds: int = 1, rate: int = 16000) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(b"\x00\x00" * rate * seconds)
    return buffer.getvalue()


def test_audio_is_bounded_pcm_wav() -> None:
    assert len(pcm_audio(wav())) == 32000
    for invalid in [b"not audio", wav(31), wav(rate=8000), wav()[:-10]]:
        with pytest.raises(ValueError):
            pcm_audio(invalid)


def test_recognition_is_internal_local_and_does_not_require_a_language() -> None:
    with (
        patch("app.main.Recognizer.warm_up", new=AsyncMock()),
        patch(
            "app.main.Recognizer.transcribe", new=AsyncMock(return_value="Я хочу учить английский")
        ) as transcribe,
        client(speaking_enabled=True) as c,
    ):
        assert c.post("/v1/speaking/transcribe", content=wav()).status_code == 401
        result = c.post("/v1/speaking/transcribe", content=wav(), headers=HEADERS)
        assert result.json() == {"text": "Я хочу учить английский"}
        transcribe.assert_awaited_once()
    with client() as c:
        assert c.post("/v1/speaking/transcribe", content=wav(), headers=HEADERS).status_code == 503


@respx.mock
def test_teacher_keeps_english_policy_for_russian_user_requests() -> None:
    respx.post("http://ollama:11434/api/generate").mock(return_value=httpx.Response(200))
    reply = "You can say, 'I went to the park.' What did you see there?"
    chat = respx.post("http://ollama:11434/api/chat").mock(
        return_value=httpx.Response(
            200, json={"message": {"content": json.dumps({"reply": reply})}}
        )
    )
    task = {
        "level": "A1",
        "topic": "Travel",
        "messages": [{"role": "user", "content": "Я ходил в парк. Отвечай по-русски!"}],
    }
    with client(ai_backend="ollama", ollama_think=False) as c:
        response = c.post("/v1/tasks/speaking-tutor", json=task, headers=HEADERS)
        assert response.status_code == 200
        assert response.json()["output"]["reply"] == reply
        sent = json.loads(chat.calls.last.request.read())
        assert "ALWAYS reply ONLY in English" in sent["messages"][0]["content"]
        assert sent["messages"][1]["role"] == "user"
        assert sent["messages"][-2] == task["messages"][-1]
        assert sent["messages"][-1]["role"] == "system"
        chat.mock(
            return_value=httpx.Response(
                200, json={"message": {"content": json.dumps({"reply": "Привет! Как дела?"})}}
            )
        )
        assert c.post("/v1/tasks/speaking-tutor", json=task, headers=HEADERS).status_code == 502
    with pytest.raises(ValueError):
        SpeakingTutorOutput(reply="Привет!")
