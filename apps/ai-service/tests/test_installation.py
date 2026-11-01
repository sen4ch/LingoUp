import json

from app.config import load_settings


def test_installation_settings_and_secret_files(tmp_path, monkeypatch):
    token_file = tmp_path / "token"
    token_file.write_text("a" * 64)
    monkeypatch.setenv("AI_SERVICE_TOKEN_FILE", str(token_file))
    monkeypatch.setenv("INSTALLATION_DIR", str(tmp_path))
    (tmp_path / "runtime.json").write_text(
        json.dumps(
            {
                "revision": "test-revision",
                "settings": {
                    "mode": "openai-compatible",
                    "endpoint": "https://models.example/v1",
                    "model": "test-model",
                    "apiKey": "private-key",
                    "dataLocality": "external",
                    "speaking": True,
                },
            }
        )
    )
    settings = load_settings()
    assert settings.ai_service_token.get_secret_value() == "a" * 64
    assert settings.ai_backend == "openai-compatible"
    assert settings.openai_compatible_model == "test-model"
    assert settings.openai_compatible_api_key.get_secret_value() == "private-key"
    assert settings.speaking_enabled is True
    assert "private-key" not in repr(settings)


def test_basic_installation_never_activates_a_real_provider(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "b" * 64)
    monkeypatch.delenv("AI_SERVICE_TOKEN_FILE", raising=False)
    monkeypatch.setenv("AI_BACKEND", "ollama")
    monkeypatch.setenv("INSTALLATION_DIR", str(tmp_path))
    (tmp_path / "runtime.json").write_text(
        json.dumps(
            {
                "settings": {
                    "mode": "basic",
                    "endpoint": "http://ollama:11434",
                    "model": "qwen3:4b",
                    "dataLocality": "external",
                    "speaking": False,
                }
            }
        )
    )
    assert load_settings().ai_backend == "mock"
    monkeypatch.setenv("BROWSER_SETUP_ENABLED", "false")
    assert load_settings().ai_backend == "ollama"
    assert load_settings().installation_dir == ""
