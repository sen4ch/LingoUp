"""Backend adapters. Each returns validated WordExplanationOutput or raises ProviderError."""

import json
from typing import Literal, Protocol

import httpx
from pydantic import ValidationError

from .config import Settings
from .prompts import OUTPUT_SCHEMA, word_explanation_messages
from .schemas import WordExplanationInput, WordExplanationOutput


class ProviderError(Exception):
    """Upstream failure or unusable model output. Mapped to HTTP 502 (retryable)."""


class Provider(Protocol):
    name: str
    model: str
    data_locality: Literal["local", "external"]

    async def explain_word(self, task: WordExplanationInput) -> WordExplanationOutput: ...

    async def aclose(self) -> None: ...


def parse_output(raw: str) -> WordExplanationOutput:
    try:
        return WordExplanationOutput.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as error:
        raise ProviderError("Model returned output that does not match the schema") from error


class MockProvider:
    """Deterministic placeholder; output is explicitly labelled as such."""

    name = "mock"
    model = "mock-v1"
    data_locality: Literal["local", "external"] = "local"

    async def explain_word(self, task: WordExplanationInput) -> WordExplanationOutput:
        return WordExplanationOutput(
            definition=(
                f'Placeholder for "{task.term}": the ai-service runs with AI_BACKEND=mock. '
                "Configure Ollama or an OpenAI-compatible backend for real explanations."
            ),
            example=task.context.strip() or None,
        )

    async def aclose(self) -> None:
        return None


class OllamaProvider:
    """Local models via Ollama's /api/chat with JSON-schema constrained output."""

    name = "ollama"
    data_locality: Literal["local", "external"] = "local"

    def __init__(self, settings: Settings) -> None:
        self.model = settings.ollama_model
        self._client = httpx.AsyncClient(
            base_url=settings.ollama_url, timeout=settings.request_timeout_seconds
        )

    async def explain_word(self, task: WordExplanationInput) -> WordExplanationOutput:
        try:
            response = await self._client.post(
                "/api/chat",
                json={
                    "model": self.model,
                    "messages": word_explanation_messages(task),
                    "format": OUTPUT_SCHEMA,
                    "stream": False,
                    "options": {"temperature": 0.2},
                },
            )
            response.raise_for_status()
            content = response.json()["message"]["content"]
        except (httpx.HTTPError, KeyError, ValueError) as error:
            raise ProviderError(f"Ollama request failed: {type(error).__name__}") from error
        return parse_output(content)

    async def aclose(self) -> None:
        await self._client.aclose()


class OpenAICompatibleProvider:
    """vLLM, LocalAI or any OpenAI-compatible /v1/chat/completions endpoint."""

    name = "openai-compatible"

    def __init__(self, settings: Settings) -> None:
        if not settings.openai_compatible_base_url or not settings.openai_compatible_model:
            raise ValueError(
                "OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_MODEL are required "
                "for AI_BACKEND=openai-compatible"
            )
        self.model = settings.openai_compatible_model
        self.data_locality = settings.openai_compatible_data_locality
        api_key = settings.openai_compatible_api_key.get_secret_value()
        self._client = httpx.AsyncClient(
            base_url=settings.openai_compatible_base_url.rstrip("/"),
            timeout=settings.request_timeout_seconds,
            headers={"authorization": f"Bearer {api_key}"} if api_key else {},
        )

    async def explain_word(self, task: WordExplanationInput) -> WordExplanationOutput:
        try:
            response = await self._client.post(
                "/chat/completions",
                json={
                    "model": self.model,
                    "messages": word_explanation_messages(task),
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                },
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as error:
            raise ProviderError(
                f"OpenAI-compatible request failed: {type(error).__name__}"
            ) from error
        return parse_output(content)

    async def aclose(self) -> None:
        await self._client.aclose()


def create_provider(settings: Settings) -> Provider:
    match settings.ai_backend:
        case "mock":
            return MockProvider()
        case "ollama":
            return OllamaProvider(settings)
        case "openai-compatible":
            return OpenAICompatibleProvider(settings)
