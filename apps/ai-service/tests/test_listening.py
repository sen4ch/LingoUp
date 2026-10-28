import asyncio
import json
from unittest.mock import patch

import pytest

from app.listening import (
    ListeningAudioInput,
    ListeningInput,
    ListeningOutput,
    generate_listening,
    narration,
    question_count,
    validate_difficulty,
)
from app.providers import MockProvider
from app.speech import SpeechError


def test_beginner_draft_can_expand_more_than_twice_before_questions() -> None:
    lesson = asyncio.run(
        MockProvider().generate_listening(ListeningInput(level="A1", topic="Town"))
    )
    # Small models use short sentences at A1 despite the requested paragraph length.
    paragraph = " ".join(lesson.script.split()[:25])
    calls = []

    async def complete(messages, schema, temperature):
        calls.append(schema)
        if "questions" in schema["properties"]:
            return json.dumps({"questions": [q.model_dump() for q in lesson.questions]})
        if "title" in schema["properties"]:
            return json.dumps({"title": "Town", "paragraphs": [paragraph] * 8})
        return json.dumps({"paragraphs": [paragraph] * 4})

    result = asyncio.run(generate_listening(complete, ListeningInput(level="A1", topic="Town")))
    assert len(result.script.split()) >= 450
    assert len(calls) == 5  # draft, three expansions, questions


def test_level_changes_question_count_and_requires_deeper_questions() -> None:
    provider = MockProvider()
    for level in ["A1", "A2", "B1", "B2", "C1", "C2"]:
        lesson = asyncio.run(provider.generate_listening(ListeningInput(level=level, topic="Town")))
        assert len(lesson.questions) == question_count(level)
        assert validate_difficulty(lesson, level) is lesson
    invalid = lesson.model_dump()
    invalid["questions"][0]["evidence"] = "This quote does not occur in the story."
    with pytest.raises(ValueError):
        ListeningOutput.model_validate(invalid)
    invalid = lesson.model_dump()
    invalid["script"] = "Too short."
    with pytest.raises(ValueError):
        ListeningOutput.model_validate(invalid)
    for question in lesson.questions:
        question.kind = "detail"
    with pytest.raises(ValueError):
        validate_difficulty(lesson, "C2")


def test_audio_duration_is_measured_and_corrected_without_silent_padding() -> None:
    scales = []

    def voice(text, scale):
        scales.append(scale)
        return b"WAV"

    task = ListeningAudioInput(text="A story. " * 150, level="B1")
    with (
        patch("app.listening.combine_audio", return_value=b"MP3"),
        patch("app.listening.synthesize_local", voice),
        patch("app.listening.wav_duration", return_value=150.0),
        patch("app.listening.audio_duration", return_value=240.0),
    ):
        data, duration = asyncio.run(narration(task))
    assert data == b"MP3"
    assert duration == 240.0
    assert scales == [1.0, 1.6]
    with (
        patch("app.listening.combine_audio", return_value=b"MP3"),
        patch("app.listening.synthesize_local", voice),
        patch("app.listening.wav_duration", return_value=150.0),
        patch("app.listening.audio_duration", return_value=150.0),
        pytest.raises(SpeechError),
    ):
        asyncio.run(narration(task))
