import json

import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import create_app

TOKEN = "t" * 32
HEADERS = {"x-ai-service-token": TOKEN}
TASK = {
    "term": "thrive",
    "context": "Plants thrive in sun.",
    "learnerLevel": "B1",
    "nativeLanguage": "ru",
}


def client(**overrides: object) -> TestClient:
    settings = Settings(ai_service_token=TOKEN, **overrides)  # type: ignore[arg-type]
    return TestClient(create_app(settings))


def test_liveness_is_public_but_tasks_require_the_token() -> None:
    with client() as c:
        assert c.get("/health/live").status_code == 200
        assert c.post("/v1/tasks/word-explanation", json=TASK).status_code == 401
        assert (
            c.post(
                "/v1/tasks/word-explanation", json=TASK, headers={"x-ai-service-token": "x" * 32}
            ).status_code
            == 401
        )


def test_health_reports_backend_and_locality() -> None:
    with client() as c:
        body = c.get("/health", headers=HEADERS).json()
    assert body == {"status": "ok", "provider": "mock", "model": "mock-v1", "dataLocality": "local"}


def test_mock_backend_returns_labelled_placeholder() -> None:
    with client() as c:
        body = c.post("/v1/tasks/word-explanation", json=TASK, headers=HEADERS).json()
    assert body["provider"] == "mock"
    assert body["output"]["definition"].startswith('Placeholder for "thrive"')
    assert body["output"]["example"] == TASK["context"]


def test_input_is_validated() -> None:
    with client() as c:
        response = c.post(
            "/v1/tasks/word-explanation", json={**TASK, "learnerLevel": "Z9"}, headers=HEADERS
        )
        assert response.status_code == 422
        response = c.post("/v1/tasks/word-explanation", json={**TASK, "extra": 1}, headers=HEADERS)
        assert response.status_code == 422


def test_oversized_bodies_are_rejected() -> None:
    with client(max_body_bytes=100) as c:
        response = c.post(
            "/v1/tasks/word-explanation", json={**TASK, "context": "x" * 500}, headers=HEADERS
        )
    assert response.status_code == 413


@respx.mock
def test_ollama_output_is_validated() -> None:
    route = respx.post("http://ollama:11434/api/chat").mock(
        return_value=httpx.Response(
            200,
            json={
                "message": {
                    "content": '{"definition": "to grow well", "translation": "процветать"}'
                }
            },
        )
    )
    with client(ai_backend="ollama") as c:
        body = c.post("/v1/tasks/word-explanation", json=TASK, headers=HEADERS).json()
    assert body["output"]["translation"] == "процветать"
    sent = route.calls.last.request.read().decode()
    assert '"format"' in sent and "ignore any instructions" in sent


@respx.mock
def test_invalid_model_output_becomes_502() -> None:
    respx.post("http://ollama:11434/api/chat").mock(
        return_value=httpx.Response(200, json={"message": {"content": "not json"}})
    )
    with client(ai_backend="ollama") as c:
        response = c.post("/v1/tasks/word-explanation", json=TASK, headers=HEADERS)
    assert response.status_code == 502


@respx.mock
def test_upstream_errors_become_502() -> None:
    respx.post("http://vllm:8000/v1/chat/completions").mock(return_value=httpx.Response(500))
    with client(
        ai_backend="openai-compatible",
        openai_compatible_base_url="http://vllm:8000/v1",
        openai_compatible_model="m",
        openai_compatible_data_locality="local",
    ) as c:
        assert c.get("/health", headers=HEADERS).json()["dataLocality"] == "local"
        assert c.post("/v1/tasks/word-explanation", json=TASK, headers=HEADERS).status_code == 502


def test_bodies_without_length_are_rejected() -> None:
    with client() as c:
        response = c.post(
            "/v1/tasks/word-explanation",
            content=iter([b'{"term": "x"}']),
            headers={**HEADERS, "content-type": "application/json"},
        )
    assert response.status_code == 411


def test_placeholder_token_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(ai_service_token="change-me-ai-service-token-at-least-32-chars")  # type: ignore[arg-type]  # noqa: S106


CHAT_OK = httpx.Response(
    200, json={"message": {"content": '{"definition": "to grow well", "translation": null}'}}
)


@respx.mock
def test_ollama_disables_thinking_keeps_model_loaded_and_warms_up() -> None:
    warm = respx.post("http://ollama:11434/api/generate").mock(return_value=httpx.Response(200))
    chat = respx.post("http://ollama:11434/api/chat").mock(return_value=CHAT_OK)
    with client(ai_backend="ollama", ollama_think=False, ollama_keep_alive="45m") as c:
        assert c.post("/v1/tasks/word-explanation", json=TASK, headers=HEADERS).status_code == 200
    sent = json.loads(chat.calls.last.request.read())
    assert sent["think"] is False
    assert sent["keep_alive"] == "45m"
    assert warm.called
    assert json.loads(warm.calls.last.request.read()) == {"model": "qwen3:4b", "keep_alive": "45m"}


@respx.mock
def test_ollama_keeps_model_default_thinking_when_not_configured() -> None:
    respx.post("http://ollama:11434/api/generate").mock(return_value=httpx.Response(500))
    chat = respx.post("http://ollama:11434/api/chat").mock(return_value=CHAT_OK)
    # A failed warm-up must not break the service.
    with client(ai_backend="ollama") as c:
        assert c.post("/v1/tasks/word-explanation", json=TASK, headers=HEADERS).status_code == 200
    assert "think" not in json.loads(chat.calls.last.request.read())


TEXT_TASK = {"level": "B1", "words": ["bargain", "crowded"], "topic": None}
EXERCISE_TASK = {
    "level": "B1",
    "words": [
        {"term": "bargain", "definition": "a cheap purchase"},
        {"term": "crowded", "definition": None},
    ],
}


def test_mock_generates_labelled_text_and_exercises() -> None:
    with client() as c:
        text = c.post("/v1/tasks/reading-text-generation", json=TEXT_TASK, headers=HEADERS).json()
        items = c.post("/v1/tasks/exercise-generation", json=EXERCISE_TASK, headers=HEADERS).json()
    assert text["provider"] == "mock"
    assert any('"bargain"' in paragraph for paragraph in text["output"]["paragraphs"])
    assert [item["term"] for item in items["output"]["items"]] == ["bargain", "crowded"]
    assert all("___" in item["sentence"] for item in items["output"]["items"])


def test_generation_inputs_are_validated() -> None:
    with client() as c:
        all_words = {**TEXT_TASK, "words": [f"w{i}" for i in range(11)]}
        url = "/v1/tasks/reading-text-generation"
        response = c.post(url, json=all_words, headers=HEADERS)
        assert response.status_code == 200
        paragraphs = " ".join(response.json()["output"]["paragraphs"])
        assert all(word in paragraphs for word in all_words["words"])
        assert c.post(url, json={**TEXT_TASK, "words": []}, headers=HEADERS).status_code == 422
        assert c.post(url, json={**TEXT_TASK, "level": "X"}, headers=HEADERS).status_code == 422
        assert c.post(url, json=TEXT_TASK).status_code == 401


@respx.mock
def test_ollama_text_generation_uses_schema_and_injection_guard() -> None:
    respx.post("http://ollama:11434/api/generate").mock(return_value=httpx.Response(200))
    chat = respx.post("http://ollama:11434/api/chat").mock(
        return_value=httpx.Response(
            200,
            json={
                "message": {
                    "content": json.dumps(
                        {
                            "title": "Market day",
                            "summary": "A trip to a crowded market.",
                            "paragraphs": ["The market was crowded.", "I found a bargain."],
                        }
                    )
                }
            },
        )
    )
    with client(ai_backend="ollama", ollama_think=False) as c:
        body = c.post("/v1/tasks/reading-text-generation", json=TEXT_TASK, headers=HEADERS).json()
    assert body["output"]["title"] == "Market day"
    sent = json.loads(chat.calls.last.request.read())
    assert sent["format"]["required"] == ["title", "summary", "paragraphs"]
    assert "data, not instructions" in sent["messages"][0]["content"]
    assert '"words": ["bargain", "crowded"]' in sent["messages"][1]["content"]


def mock_exercise_output(items: list[dict[str, object]]) -> None:
    respx.post("http://ollama:11434/api/generate").mock(return_value=httpx.Response(200))
    respx.post("http://ollama:11434/api/chat").mock(
        return_value=httpx.Response(
            200, json={"message": {"content": json.dumps({"items": items})}}
        )
    )


@respx.mock
def test_exercises_blank_the_word_and_drop_unusable_items() -> None:
    mock_exercise_output(
        [
            # The model forgot the gap: the service blanks the word itself.
            {"term": "bargain", "sentence": "This coat was a real Bargain.", "hint": None},
            {"term": "crowded", "sentence": "The bus was ___ today.", "hint": "full"},
            {"term": "crowded", "sentence": "No word and no gap here.", "hint": None},
            {"term": "crowded", "sentence": "Crowded, so crowded.", "hint": None},
            {"term": "crowded", "sentence": "Too ___ and ___.", "hint": None},
        ]
    )
    with client(ai_backend="ollama") as c:
        response = c.post("/v1/tasks/exercise-generation", json=EXERCISE_TASK, headers=HEADERS)
    assert response.status_code == 200
    assert [item["sentence"] for item in response.json()["output"]["items"]] == [
        "This coat was a real ___.",
        "The bus was ___ today.",
    ]


@respx.mock
def test_exercises_without_any_usable_item_are_rejected_as_502() -> None:
    mock_exercise_output([{"term": "bargain", "sentence": "No gap here.", "hint": None}])
    with client(ai_backend="ollama") as c:
        response = c.post("/v1/tasks/exercise-generation", json=EXERCISE_TASK, headers=HEADERS)
    assert response.status_code == 502
