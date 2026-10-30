import json

import httpx
import respx
from test_api import HEADERS, client

TASK = {
    "writingTasks": ["Describe the table", "Discuss both views"],
    "writing": ["My report", "My essay"],
    "speakingTasks": ["Study?", "A skill?", "Education?"],
    "speaking": ["I study", "I learned to cook", "Schools should teach skills"],
}


def test_exam_auth_and_mock_are_explicit():
    with client() as c:
        assert c.post("/v1/tasks/exam-assessment", json=TASK).status_code == 401
        response = c.post("/v1/tasks/exam-assessment", json=TASK, headers=HEADERS)
        assert response.status_code == 200
        assert response.json()["provider"] == "mock"
        assert response.json()["output"]["writingTask1"]["band"] == 0


@respx.mock
def test_exam_assessment_is_structured_and_does_not_claim_pronunciation():
    respx.post("http://ollama:11434/api/generate").mock(return_value=httpx.Response(200))
    review = {"band": 5.5, "feedback": "Develop the ideas and use clearer paragraphs."}
    output = {"writingTask1": review, "writingTask2": review, "speakingLanguage": review}
    chat = respx.post("http://ollama:11434/api/chat").mock(
        return_value=httpx.Response(200, json={"message": {"content": json.dumps(output)}})
    )
    with client(ai_backend="ollama") as c:
        response = c.post("/v1/tasks/exam-assessment", json=TASK, headers=HEADERS)
        assert response.status_code == 200
        assert response.json()["output"] == output
        sent = json.loads(chat.calls.last.request.read())
        assert "Do not assess or invent pronunciation" in sent["messages"][0]["content"]
