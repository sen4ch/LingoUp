"""Task contracts. Must mirror packages/ai-sdk/src/tasks.ts."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

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


GAP = "___"


class ReadingTextGenerationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: CefrLevel
    words: list[Annotated[str, Field(min_length=1, max_length=80)]] = Field(min_length=1)
    topic: str | None = Field(default=None, max_length=80)


class SpeakingMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1000)


class SpeakingTutorInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    level: CefrLevel
    topic: str = Field(max_length=80)
    messages: list[SpeakingMessage] = Field(max_length=20)


class SpeakingCorrection(BaseModel):
    quote: str = Field(min_length=1, max_length=1000)
    replacement: str = Field(max_length=1000)
    category: Literal["word", "grammar", "suggestion"]
    errorType: Literal[
        "sentence_structure",
        "word_order",
        "verb_tense",
        "agreement",
        "articles",
        "word_form",
        "word_choice",
        "naturalness",
    ]  # noqa: N815
    explanation: str = Field(min_length=1, max_length=600)
    example: str | None = Field(default=None, min_length=1, max_length=600)


class SpeakingTutorOutput(BaseModel):
    corrections: list[SpeakingCorrection] = Field(default_factory=list, max_length=1)
    reply: str = Field(min_length=1, max_length=600)

    @field_validator("reply")
    @classmethod
    def english_script(cls, value: str) -> str:
        if not any("a" <= char.lower() <= "z" for char in value):
            raise ValueError("English reply required")
        if any(char.isalpha() and not char.isascii() for char in value):
            raise ValueError("English reply required")
        return value


class ReadingTextGenerationOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = Field(min_length=1, max_length=120)
    summary: str = Field(min_length=1, max_length=300)
    paragraphs: list[Annotated[str, Field(min_length=1, max_length=1500)]] = Field(
        min_length=1, max_length=8
    )


class ExerciseWord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: str = Field(min_length=1, max_length=80)
    definition: str | None = Field(default=None, max_length=500)


class ExerciseGenerationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: CefrLevel
    words: list[ExerciseWord] = Field(min_length=1, max_length=10)


class ExerciseItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    term: str = Field(min_length=1, max_length=80)
    sentence: str = Field(min_length=5, max_length=300)
    hint: str | None = Field(default=None, max_length=200)

    @field_validator("sentence")
    @classmethod
    def must_contain_gap(cls, value: str) -> str:
        if GAP not in value:
            raise ValueError(f"sentence must contain {GAP}")
        return value


class ExerciseGenerationOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: list[ExerciseItem] = Field(min_length=1, max_length=10)


class TaskResponse(BaseModel):
    provider: str
    model: str
    output: WordExplanationOutput


class ReadingTextResponse(BaseModel):
    provider: str
    model: str
    output: ReadingTextGenerationOutput


class ExerciseResponse(BaseModel):
    provider: str
    model: str
    output: ExerciseGenerationOutput


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    provider: str
    model: str
    dataLocality: Literal["local", "external"]  # noqa: N815
