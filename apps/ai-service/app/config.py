from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration from environment variables. Secrets are never logged."""

    # Validation errors must not echo values: they may contain secrets.
    model_config = SettingsConfigDict(hide_input_in_errors=True)

    ai_service_token: SecretStr = Field(min_length=32)
    ai_backend: Literal["mock", "ollama", "openai-compatible"] = "mock"

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
    max_body_bytes: int = 16 * 1024

    @field_validator("ai_service_token")
    @classmethod
    def reject_placeholder(cls, value: SecretStr) -> SecretStr:
        if "change-me" in value.get_secret_value().lower():
            raise ValueError("replace the change-me placeholder from .env.example")
        return value
