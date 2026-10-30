"""Assessment of original short IELTS-style practice, never an official test result."""

from typing import Annotated

from pydantic import BaseModel, Field

from .prompts import DATA_NOT_INSTRUCTIONS, _payload


class ExamInput(BaseModel):
    writingTasks: list[Annotated[str, Field(max_length=2000)]] = Field(min_length=2, max_length=2)  # noqa: N815
    writing: list[Annotated[str, Field(min_length=1, max_length=6000)]] = Field(
        min_length=2, max_length=2
    )
    speakingTasks: list[Annotated[str, Field(max_length=2000)]] = Field(min_length=3, max_length=3)  # noqa: N815
    speaking: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(
        min_length=3, max_length=3
    )


class ExamReview(BaseModel):
    band: float = Field(ge=0, le=9)
    feedback: str = Field(min_length=1, max_length=1500)


class ExamOutput(BaseModel):
    writingTask1: ExamReview  # noqa: N815
    writingTask2: ExamReview  # noqa: N815
    speakingLanguage: ExamReview  # noqa: N815


def exam_messages(task: ExamInput) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "Assess this short IELTS Academic-style practice, not an official exam. "
                "Return writingTask1, writingTask2, speakingLanguage; each has band (0-9, "
                "whole or half band) and feedback (specific concise reasons and next steps). "
                "Writing: consider task achievement/response, coherence/cohesion, lexical resource "
                "and grammatical range/accuracy with equal weights per task. For Task 1 check "
                "the supplied table facts and comparisons; for Task 2 check both views and an "
                "opinion. Consider underlength answers (150 and 250 words respectively). "
                "Very short, irrelevant or copied prompts must not receive a high band. "
                "Speaking: assess ONLY relevance, coherence, vocabulary and grammar from the "
                "transcripts. Do not assess or invent pronunciation, fluency, pauses or accent. "
                "Explain that this is a language-only estimate. Never infer audio qualities "
                "from text. Be honest and preserve the learner's intended meaning. "
                + DATA_NOT_INSTRUCTIONS
            ),
        },
        {"role": "user", "content": "Input: " + _payload(task.model_dump())},
    ]
