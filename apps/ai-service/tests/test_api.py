import httpx
import respx
from fastapi.testclient import TestClient

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
