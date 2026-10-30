import json

import httpx
import pytest
import respx
from test_api import HEADERS, client

from app.writing import (
    CompleteWritingReview,
    WritingInput,
    protect_ambiguous_intent,
    validate_writing_review,
    writing_review_messages,
)


def task(text="This amazing. I have a questions. Did you leared?", level="A1"):
    return WritingInput(
        level=level,
        topic="Life",
        messages=[
            {"role": "assistant", "content": "Tell me about yourself."},
            {"role": "user", "content": text},
        ],
    )


def issue(quote="This amazing", replacement="This is amazing.", **extra):
    return {
        "quote": quote,
        "occurrence": 0,
        "category": "grammar",
        "errorType": "sentence_structure",
        "replacement": replacement,
        "explanation": "Use is after this.",
        "example": "This is nice.",
        "alternatives": [],
        **extra,
    }


def test_mock_and_authentication():
    with client() as c:
        assert c.post("/v1/tasks/writing-assessment", json=task().model_dump()).status_code == 401
        response = c.post("/v1/tasks/writing-assessment", json=task().model_dump(), headers=HEADERS)
        assert response.status_code == 200
        assert "not been assessed" in response.json()["output"]["feedback"]


@respx.mock
def test_one_review_request_corrects_all_text_then_writes_email():
    respx.post("http://ollama:11434/api/generate").mock(return_value=httpx.Response(200))
    corrected = "This is amazing. I have a question. Did you learn?"
    review = {
        "feedback": "Practise questions.",
        "correctedText": corrected,
        "issues": [issue(), issue("Did you leared?", "Did you learn?", errorType="word_order")],
    }
    email = {"subject": "Hello", "reply": "Hi! What are your plans?"}
    chat = respx.post("http://ollama:11434/api/chat").mock(
        side_effect=[
            httpx.Response(200, json={"message": {"content": json.dumps(value)}})
            for value in [review, email, {}]
        ]
    )
    with client(ai_backend="ollama") as c:
        response = c.post("/v1/tasks/writing-assessment", json=task().model_dump(), headers=HEADERS)
        assert response.status_code == 200
        output = response.json()["output"]
        assert output["correctedText"] == corrected
        assert output["issues"][1]["replacement"] == "Did you learn?"
        assert len(chat.calls) == 2
        sent = json.loads(chat.calls[0].request.read())
        assert "correctedText" in sent["format"]["properties"]
        assert (
            c.post(
                "/v1/tasks/writing-assessment", json=task().model_dump(), headers=HEADERS
            ).status_code
            == 502
        )


def test_noops_duplicates_and_unmatched_quotes_are_removed():
    review = CompleteWritingReview(
        feedback="Review",
        correctedText="This is amazing.",
        issues=[
            issue(),
            issue(errorType="word_form"),
            issue("this", "this", category="word", errorType="spelling"),
            issue("not in the original", "fixed"),
        ],
    )
    result = validate_writing_review(task(), review)
    assert len(result.issues) == 1
    assert result.issues[0].quote == "This amazing"
    assert result.issues[0].start == 0 and result.issues[0].end == 12


def test_positions_use_original_utf16_and_repeated_occurrence():
    source = "Hi ?? This amazing. This amazing"
    review = CompleteWritingReview(
        feedback="Review",
        correctedText="Hi! This is amazing.",
        issues=[
            issue(occurrence=1),
        ],
    )
    result = validate_writing_review(task(source), review)
    assert result.issues[0].start == 20
    assert result.issues[0].end == 32


@pytest.mark.parametrize("level", ["A1", "A2", "B1", "B2", "C1", "C2"])
def test_level_specific_prompt_does_not_limit_full_correction(level):
    system = writing_review_messages(task(level=level))[0]["content"]
    assert "ALL real grammar" in system
    if level == "A1":
        assert "very short common words" in system and "at most 3" in system
    elif level in {"A2", "B1", "B2"}:
        assert f"at most {dict(A2=4, B1=5, B2=6)[level]}" in system
    else:
        assert "as needed" in system


def test_ambiguity_is_not_a_forced_refusal_and_context_can_resolve_it():
    source = "I wont go."
    review = CompleteWritingReview(feedback="Review", correctedText="I won't go.", issues=[])
    result = protect_ambiguous_intent(task(source), review)
    assert result.correctedText is None
    assert {option.replacement for option in result.issues[0].alternatives} == {
        "I want to go",
        "I won't go",
    }
    clear = CompleteWritingReview(
        feedback="Review", correctedText="I want to go. It is my dream.", issues=[]
    )
    assert not protect_ambiguous_intent(task("I wont go. It is my dream."), clear).issues
    negative = CompleteWritingReview(
        feedback="Review", correctedText="I won't go because I do not want to.", issues=[]
    )
    assert not protect_ambiguous_intent(
        task("I wont go because I do not want to."), negative
    ).issues


def test_correct_text_does_not_need_artificial_errors():
    source = "This is amazing."
    review = CompleteWritingReview(feedback="Review", correctedText=source, issues=[])
    result = validate_writing_review(task(source), review)
    assert result.issues == [] and result.correctedText == source
    assert result.feedback == "No corrections needed."
