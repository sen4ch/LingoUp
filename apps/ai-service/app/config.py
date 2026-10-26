from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuration from environment variables. Secrets are never logged."""

    ai_service_token: SecretStr = Field(min_length=32)
    ai_backend: Literal["mock", "ollama", "openai-compatible"] = "mock"

    ollama_url: str = "http://ollama:11434"
    ollama_model: str = "qwen3:4b"

    openai_compatible_base_url: str = ""
    openai_compatible_api_key: SecretStr = SecretStr("")
    openai_compatible_model: str = ""
    # Whether the OpenAI-compatible endpoint runs on infrastructure you operate.
    openai_compatible_data_locality: Literal["local", "external"] = "external"

    request_timeout_seconds: float = 60.0
    max_body_bytes: int = 16 * 1024
