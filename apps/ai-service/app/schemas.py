"""Task contracts. Must mirror packages/ai-sdk/src/tasks.ts (word-explanation)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CefrLevel = Literal["A1", "A2", "B1", "B2", "C1", "C2"]


class WordExplanationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: str = Field(min_length=1, max_length=80)
    context: str = Field(max_length=600)
    learnerLevel: CefrLevel  # noqa: N815 - JSON contract uses camelCase
    nativeLanguage: str = Field(min_length=2, max_length=2)  # noqa: N815


class WordExplanationOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    definition: str = Field(min_length=1, max_length=500)
    translation: str | None = Field(default=None, max_length=200)
    partOfSpeech: str | None = Field(default=None, max_length=40)  # noqa: N815
    example: str | None = Field(default=None, max_length=300)
    usageNote: str | None = Field(default=None, max_length=300)  # noqa: N815


class TaskResponse(BaseModel):
    provider: str
    model: str
    output: WordExplanationOutput


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    provider: str
    model: str
    dataLocality: Literal["local", "external"]  # noqa: N815
