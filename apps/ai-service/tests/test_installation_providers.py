import asyncio
import json
from unittest.mock import patch

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.providers import AnthropicProvider, OpenAICompatibleProvider, ProviderError

TOKEN = "t" * 32


def test_claude_uses_native_messages_with_system_schema_and_workspace():
    async def run():
        provider = AnthropicProvider(
            Settings(
                ai_service_token=TOKEN,
                ai_backend="anthropic",
                api_workspace_id="my-workspace",
                openai_compatible_base_url="https://claude.example/v1",
                openai_compatible_model="test-claude",
                openai_compatible_api_key="private-key",
            )
        )
        with respx.mock as mock:
            route = mock.post("https://claude.example/v1/messages").mock(
                return_value=httpx.Response(
                    200,
                    json={
                        "content": [
                            {"type": "thinking", "thinking": "hidden"},
                            {"type": "text", "text": '{"answer":"yes"}'},
                        ],
                        "stop_reason": "end_turn",
                    },
                )
            )
            result = await provider.complete_json(
                [
                    {"role": "system", "content": "Teach English"},
                    {"role": "user", "content": "Hello"},
                ],
                {"type": "object"},
                0.2,
            )
            assert json.loads(result) == {"answer": "yes"}
            request = route.calls.last.request
            payload = json.loads(request.content)
            assert request.headers["x-api-key"] == "private-key"
            assert request.headers["anthropic-workspace-id"] == "my-workspace"
            assert "Teach English" in payload["system"]
            assert "JSON schema" in payload["system"]
            assert payload["messages"] == [{"role": "user", "content": "Hello"}]
            assert "response_format" not in payload
            assert "temperature" not in payload
        await provider.aclose()

    asyncio.run(run())


def test_claude_rejects_truncation_and_redacts_provider_errors():
    async def run():
        provider = AnthropicProvider(
            Settings(
                ai_service_token=TOKEN,
                ai_backend="anthropic",
                openai_compatible_base_url="https://claude.example/v1",
                openai_compatible_model="test",
                openai_compatible_api_key="private-key",
            )
        )
        with respx.mock as mock:
            route = mock.post("https://claude.example/v1/messages").mock(
                return_value=httpx.Response(401, text="private-key and personal text")
            )
            with pytest.raises(ProviderError) as error:
                await provider.complete_json([], {}, 0.2)
            assert "private-key" not in str(error.value)
            route.mock(
                return_value=httpx.Response(200, json={"stop_reason": "max_tokens", "content": []})
            )
            with pytest.raises(ProviderError, match="truncated"):
                await provider.complete_json([], {}, 0.2)
        await provider.aclose()

    asyncio.run(run())


def test_deepseek_and_custom_servers_keep_openai_json_mode():
    async def run():
        provider = OpenAICompatibleProvider(
            Settings(
                ai_service_token=TOKEN,
                openai_compatible_base_url="https://deepseek.example",
                openai_compatible_model="test",
                openai_compatible_api_key="key",
            )
        )
        with respx.mock as mock:
            route = mock.post("https://deepseek.example/chat/completions").mock(
                return_value=httpx.Response(
                    200, json={"choices": [{"message": {"content": '{"ok":true}'}}]}
                )
            )
            assert (
                await provider.complete_json([{"role": "user", "content": "Return json"}], {}, 0.1)
                == '{"ok":true}'
            )
            assert json.loads(route.calls.last.request.content)["response_format"] == {
                "type": "json_object"
            }
        await provider.aclose()

    asyncio.run(run())


def test_local_voice_requests_never_call_external_edge_renderer():
    async def local(text, voice):
        assert voice == "piper-high"
        return b"ID3-local-audio"

    async def external(text, voice):
        raise AssertionError("Local voice sent to an external service")

    with patch("app.main.local_synthesize", local):
        with TestClient(
            create_app(Settings(ai_service_token=TOKEN), synthesize=external)
        ) as client:
            response = client.post(
                "/v1/tasks/speech-synthesis",
                headers={"x-ai-service-token": TOKEN},
                json={"text": "Hello world", "voice": "piper-high"},
            )
            assert response.status_code == 200
            assert response.content == b"ID3-local-audio"


def test_runtime_selects_claude_and_high_voice(tmp_path, monkeypatch):
    from app.config import load_settings

    monkeypatch.setenv("AI_SERVICE_TOKEN", TOKEN)
    monkeypatch.setenv("INSTALLATION_DIR", str(tmp_path))
    (tmp_path / "runtime.json").write_text(
        json.dumps(
            {
                "revision": "saved-revision",
                "settings": {
                    "mode": "openai-compatible",
                    "apiProvider": "anthropic",
                    "workspaceId": "workspace",
                    "endpoint": "https://claude.example/v1",
                    "model": "test",
                    "apiKey": "private-key",
                    "dataLocality": "external",
                    "speaking": False,
                    "speech": "piper-high",
                },
            }
        )
    )
    settings = load_settings()
    assert settings.ai_backend == "anthropic"
    assert settings.api_workspace_id == "workspace"
    assert settings.piper_quality == "high"
    assert settings.installation_revision == "saved-revision"
