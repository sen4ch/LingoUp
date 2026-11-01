import json
import os
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration from environment variables. Secrets are never logged."""

    # Validation errors must not echo values: they may contain secrets.
    model_config = SettingsConfigDict(hide_input_in_errors=True)

    ai_service_token: SecretStr = Field(min_length=32)
    ai_backend: Literal["mock", "ollama", "openai-compatible", "anthropic"] = "mock"
    api_workspace_id: str = ""
    piper_quality: Literal["medium", "high"] = "medium"
    installation_revision: str = ""

    ollama_url: str = "http://ollama:11434"
    ollama_model: str = "qwen3:4b"
    # Reasoning ("thinking") mode of models such as qwen3 or deepseek-r1. It makes answers
    # several times slower; None keeps the model's default.
    ollama_think: bool | None = None
    # How long Ollama keeps the model loaded after a request (avoids slow cold starts).
    ollama_keep_alive: str = "30m"

    openai_compatible_base_url: str = ""
    openai_compatible_api_key: SecretStr = SecretStr("")
    openai_compatible_model: str = ""
    # Whether the OpenAI-compatible endpoint runs on infrastructure you operate.
    openai_compatible_data_locality: Literal["local", "external"] = "external"

    request_timeout_seconds: float = 60.0
    # Pronunciation through edge-tts; a word takes about a second.
    speech_timeout_seconds: float = 15.0
    max_body_bytes: int = 16 * 1024
    speaking_enabled: bool = False
    whisper_model: str = "base"
    whisper_download_root: str = "/models"
    installation_dir: str = ""

    @field_validator("ai_service_token")
    @classmethod
    def reject_placeholder(cls, value: SecretStr) -> SecretStr:
        if "change-me" in value.get_secret_value().lower():
            raise ValueError("replace the change-me placeholder from .env.example")
        return value


def load_settings() -> Settings:
    """Read private Docker files. Environment-only installations keep their behavior."""
    values: dict = {}
    token_file = os.environ.get("AI_SERVICE_TOKEN_FILE")
    if token_file:
        values["ai_service_token"] = Path(token_file).read_text().strip()
    directory = os.environ.get("INSTALLATION_DIR")
    if os.environ.get("BROWSER_SETUP_ENABLED") == "false":
        directory = None
        values["installation_dir"] = ""
    runtime = Path(directory, "runtime.json") if directory else None
    if runtime and runtime.exists():
        saved = json.loads(runtime.read_text())
        settings = saved["settings"]
        mode = settings["mode"]
        if mode not in {"basic", "ollama", "openai-compatible"}:
            raise ValueError("Invalid installation mode")
        values.update(
            ai_backend="mock"
            if mode == "basic"
            else "anthropic"
            if mode == "openai-compatible" and settings.get("apiProvider") == "anthropic"
            else mode,
            api_workspace_id=settings.get("workspaceId", ""),
            piper_quality="high" if settings.get("speech") == "piper-high" else "medium",
            installation_revision=saved.get("revision", ""),
            ollama_url=settings["endpoint"],
            ollama_model=settings["model"],
            ollama_think=False,
            openai_compatible_base_url=settings["endpoint"],
            openai_compatible_model=settings["model"],
            openai_compatible_api_key=settings.get("apiKey", ""),
            openai_compatible_data_locality=settings["dataLocality"],
            speaking_enabled=settings["speaking"],
        )
    return Settings(**values)
