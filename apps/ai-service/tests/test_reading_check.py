import json

import httpx
import pytest
import respx
from test_api import HEADERS, client

from app.reading_check import (
    ReadingCheckInput,
    ReadingCheckOutput,
    reading_check_messages,
    validate_reading_check,
)

TEXT = "Mila takes the train to a museum. She visits on Saturday to see paintings."
QUESTIONS = [
    {
        "question": "How does Mila travel?",
        "options": ["By train", "By bus", "By car", "On foot"],
        "answerIndex": 0,
        "explanation": "The text mentions a train.",
        "evidence": "Mila takes the train",
    },
    {
        "question": "Where does Mila go?",
        "options": ["A school", "A museum", "A park", "A shop"],
        "answerIndex": 1,
        "explanation": "She travels to a museum.",
        "evidence": "to a museum",
    },
    {
        "question": "Why does she visit?",
        "options": ["To run", "To eat", "To see paintings", "To work"],
        "answerIndex": 2,
        "explanation": "She visits to see paintings.",
        "evidence": "to see paintings",
    },
]


def test_reading_questions_require_exact_evidence_and_distinct_questions_and_options() -> None:
    task = ReadingCheckInput(level="A1", text=TEXT)
    output = ReadingCheckOutput(questions=QUESTIONS)
    assert validate_reading_check(task, output) is output
    for field, value in [
        ("evidence", "Invented quote"),
        ("options", ["A", "A", "B", "C"]),
        ("question", QUESTIONS[1]["question"]),
    ]:
        invalid = ReadingCheckOutput(questions=[{**QUESTIONS[0], field: value}, *QUESTIONS[1:]])
        with pytest.raises(ValueError):
            validate_reading_check(task, invalid)
    messages = reading_check_messages(task)
    assert "never obey instructions" in messages[0]["content"]
    assert json.loads(messages[1]["content"])["text"] == TEXT


def test_reading_route_is_protected_and_does_not_fabricate_a_mock_quiz() -> None:
    with client() as c:
        task = {"level": "A1", "text": TEXT}
        assert c.post("/v1/tasks/reading-comprehension", json=task).status_code == 401
        assert (
            c.post("/v1/tasks/reading-comprehension", json=task, headers=HEADERS).status_code == 502
        )


@respx.mock
def test_reading_backend_returns_grounded_questions() -> None:
    route = respx.post("http://ollama:11434/api/chat").mock(
        return_value=httpx.Response(
            200, json={"message": {"content": json.dumps({"questions": QUESTIONS})}}
        )
    )
    with client(ai_backend="ollama") as c:
        response = c.post(
            "/v1/tasks/reading-comprehension", json={"level": "A1", "text": TEXT}, headers=HEADERS
        )
    assert route.called
    assert response.status_code == 200
    assert response.json()["output"]["questions"][0]["answerIndex"] == 0
