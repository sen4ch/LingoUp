"""Level-aware email exchange and assessment of the latest learner reply."""

import re
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from .prompts import DATA_NOT_INSTRUCTIONS, Messages, _payload
from .schemas import CefrLevel


class WritingMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class WritingInput(BaseModel):
    level: CefrLevel
    topic: str = Field(min_length=1, max_length=80)
    messages: list[WritingMessage] = Field(max_length=20)


ErrorType = Literal[
    "sentence_structure",
    "word_order",
    "sentence_connection",
    "verb_tense",
    "punctuation",
    "agreement",
    "articles",
    "word_form",
    "spelling",
    "word_choice",
    "naturalness",
    "ambiguity",
]


class WritingIssue(BaseModel):
    quote: str = Field(min_length=1, max_length=4000)
    occurrence: int = Field(ge=0, le=4000)
    category: Literal["word", "grammar", "suggestion"]
    errorType: ErrorType | None = None  # noqa: N815
    replacement: str = Field(max_length=4000)
    explanation: str = Field(min_length=1, max_length=600)
    example: str | None = Field(default=None, min_length=1, max_length=600)
    start: int | None = Field(default=None, ge=0, le=8000)
    end: int | None = Field(default=None, ge=0, le=8000)
    alternatives: list["WritingAlternative"] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def consistent_category(self) -> "WritingIssue":
        if self.errorType in {"spelling", "word_choice"}:
            self.category = "word"
        elif self.errorType in {"naturalness", "ambiguity"}:
            self.category = "suggestion"
        elif self.errorType is not None:
            self.category = "grammar"
        if self.errorType == "ambiguity" and len(self.alternatives) < 2:
            raise ValueError("An ambiguous meaning needs at least two possible readings")
        return self


class WritingAlternative(BaseModel):
    replacement: str = Field(min_length=1, max_length=4000)
    meaning: str = Field(min_length=1, max_length=600)


class ReviewedIssue(WritingIssue):
    """Real model reviews must identify the rule and supply teaching fields explicitly."""

    errorType: ErrorType  # noqa: N815
    example: str | None = Field(min_length=1, max_length=600)
    alternatives: list[WritingAlternative] = Field(max_length=3)


class WritingReview(BaseModel):
    feedback: str = Field(min_length=1, max_length=1000)
    issues: list[ReviewedIssue] = Field(max_length=50)
    correctedText: str | None = Field(default=None, min_length=1, max_length=6000)  # noqa: N815


class CompleteWritingReview(WritingReview):
    correctedText: str | None = Field(min_length=1, max_length=6000)  # noqa: N815


class WritingEmail(BaseModel):
    subject: str = Field(min_length=1, max_length=120)
    reply: str = Field(min_length=1, max_length=4000)


class WritingOutput(WritingEmail):
    feedback: str = Field(min_length=1, max_length=1000)
    issues: list[WritingIssue] = Field(max_length=50)
    correctedText: str | None = Field(default=None, min_length=1, max_length=6000)  # noqa: N815
    needsClarification: bool = False  # noqa: N815


def protect_ambiguous_intent(task: WritingInput, review: WritingReview) -> WritingReview:
    """Do not let a missing letter/apostrophe silently turn desire into refusal."""
    text = task.messages[-1].content
    pattern = re.compile(r"\b(I|you|we|they|he|she|it)\s+wont\s+(?!to\b)([a-z]+)\b", re.I)
    positive_context = re.sub(
        r"\b(?:do not|don't|does not|doesn't|never)\s+want\b", "", text, flags=re.I
    )
    desire = re.search(r"\b(want|wish|hope|would like|dream)\b", positive_context, re.I)
    refusal = re.search(
        r"\b(refuse|never|will not|cannot|can't|don't want|do not want)\b", text, re.I
    )
    corrected = review.correctedText or ""
    resolved = (desire and not refusal and re.search(r"\bwant(?:s)? to\b", corrected, re.I)) or (
        refusal and not desire and re.search(r"\b(?:won't|will not)\b", corrected, re.I)
    )
    matches = [] if resolved else list(pattern.finditer(text))[:50]
    if matches:
        review.correctedText = None
        review.issues = [
            issue for issue in review.issues if not re.search(r"\bwont\b", issue.quote, re.I)
        ][: 50 - len(matches)]
    for match in matches:
        quote = match.group()
        subject, verb = match.groups()
        desire = "wants" if subject.lower() in {"he", "she", "it"} else "want"
        review.issues.append(
            ReviewedIssue(
                quote=quote,
                occurrence=text[: match.start()].count(quote),
                category="suggestion",
                errorType="ambiguity",
                replacement=quote,
                explanation="Wont could mean want to (a wish) or won't (will not). "
                "These have different meanings. Choose the one you intended.",
                example=None,
                alternatives=[
                    WritingAlternative(
                        replacement=f"{subject} {desire} to {verb}",
                        meaning="A wish or intention to do this.",
                    ),
                    WritingAlternative(
                        replacement=f"{subject} won't {verb}",
                        meaning="A decision or prediction not to do this.",
                    ),
                ],
            )
        )
    return review


def validate_writing_review(task: WritingInput, review: WritingReview) -> WritingReview:
    """Ground highlights in original text. Never build the full rewrite from teaching items."""
    text = task.messages[-1].content
    valid: list[ReviewedIssue] = []
    seen: set[tuple[int, int]] = set()
    for issue in sorted(review.issues, key=lambda item: item.category != "grammar"):
        # Informal greetings do not need a mandatory comma after Hi/Hello.
        if re.fullmatch(r"(?:hi|hello|hey)\s+\w+[!.]?", issue.quote.strip(), re.I) and (
            re.sub(r"\W", "", issue.quote).casefold()
            == re.sub(r"\W", "", issue.replacement).casefold()
        ):
            continue
        if issue.quote.strip().casefold() == issue.replacement.strip().casefold() and (
            issue.errorType != "ambiguity"
        ):
            continue
        # Ignore model-provided positions; compute them using original source characters.
        pattern = r"\s+".join(re.escape(part) for part in issue.quote.split())
        pattern = pattern.replace("'", "['’‘]").replace('"', '["“”]')
        if not pattern:
            continue
        matches = list(re.finditer(pattern, text, re.I))
        if issue.occurrence >= len(matches):
            continue
        match = matches[issue.occurrence]
        if (match.start() and text[match.start() - 1].isalnum() and match[0][0].isalnum()) or (
            match.end() < len(text) and text[match.end()].isalnum() and match[0][-1].isalnum()
        ):
            continue
        span = (match.start(), match.end())
        if span in seen:
            continue
        seen.add(span)
        issue.quote = match[0]
        issue.start = len(text[: match.start()].encode("utf-16-le")) // 2
        issue.end = len(text[: match.end()].encode("utf-16-le")) // 2
        valid.append(issue)
    review.issues = valid
    caps = {"A1": 3, "A2": 4, "B1": 5, "B2": 6, "C1": 50, "C2": 50}
    count = min(len(valid), caps[task.level])
    review.feedback = (
        f"Let's practise {count} {'thing' if count == 1 else 'things'}. Read the corrections below."
        if count
        else "Read your corrected text below."
    )
    if not valid and review.correctedText == text:
        review.feedback = "No corrections needed."
    if any(issue.errorType == "ambiguity" for issue in valid):
        review.correctedText = None
        review.feedback += " Choose the meaning you intended."
    return review


def writing_messages(task: WritingInput, review: WritingReview | None = None) -> Messages:
    lengths = {
        "A1": "30-50",
        "A2": "50-80",
        "B1": "80-120",
        "B2": "120-160",
        "C1": "160-200",
        "C2": "180-240",
    }
    return [
        {
            "role": "system",
            "content": (
                "You are Alex, an English email pen pal and writing tutor. "
                "Write a natural email with greeting, paragraphs and sign-off, in English. "
                "Match vocabulary, grammar, topic complexity and expected reply to the CEFR level. "
                f"Your email should be {lengths[task.level]} words. "
                "With no history, send an opening email about the topic and ask 1-3 questions. "
                "Otherwise respond meaningfully to the latest learner email, continue the same "
                "exchange and ask a follow-up question. The writing assessment is done separately. "
                "Return ONLY subject and reply. Keep feedback and corrections outside the email. "
                "If assessment marks an ambiguity, ask what the learner means instead of assuming "
                "one interpretation. Never invent facts about the learner. " + DATA_NOT_INSTRUCTIONS
            ),
        },
        {
            "role": "user",
            "content": "Input: "
            + _payload(
                {
                    **task.model_dump(),
                    "ambiguities": [
                        issue.model_dump()
                        for issue in review.issues
                        if issue.errorType == "ambiguity"
                    ]
                    if review
                    else [],
                }
            ),
        },
    ]


def writing_review_messages(task: WritingInput) -> Messages:
    guidance = {
        "A1": "Explain with very short common words. Say 'Use is after this', not 'finite copula'. "
        "Prioritize missing am/is/are, subject + verb + object, basic verbs, one/many, "
        "simple questions/negatives, then periods. Teach at most 3 main points.",
        "A2": "Use short simple explanations and familiar examples. Prioritize basic tenses, "
        "questions, articles and one/many. Teach at most 4 main points.",
        "B1": "Explain intermediate tense choices and clause connections clearly. "
        "Teach at most 5 main points.",
        "B2": "Explain complex clauses, tense consistency, register and word order. "
        "Teach at most 6 main points.",
        "C1": "Give precise explanations of nuanced grammar, cohesion and register as needed.",
        "C2": "Give precise explanations of nuanced grammar, cohesion and register as needed.",
    }
    return [
        {
            "role": "system",
            "content": (
                "You are an English writing teacher. Perform two tasks in ONE structured response. "
                "A: correctedText is the COMPLETE corrected learnerEmail, fixing ALL real grammar, "
                "spelling and punctuation errors, including errors not chosen for teaching. "
                "Every sentence in correctedText, issue replacements and examples must be correct "
                "natural English. Preserve meaning, polarity, time, names and facts. Add no facts. "
                "B: issues contains all useful distinct corrections; the UI shows only the most "
                "important for the level initially, with the rest expandable. The teaching limit "
                "must NEVER limit correctedText or make you stop checking the rest of the email. "
                + guidance[task.level]
                + " "
                "Check missing verbs/subjects, verb forms and tenses, agreement, question/negative "
                "word order, articles, sentence connections (and/but/because/so), run-ons and "
                "punctuation. Then check spelling and optional natural phrasing. "
                "Each issue: quote (EXACT original substring), occurrence (0 for first), category "
                "(grammar/word/suggestion), errorType, replacement, explanation, example (correct "
                "short sentence or null), alternatives (normally []). Do not invent start/end. "
                "Use the smallest meaningful original fragment. Copy its ORIGINAL mistakes. "
                "One problem must have one issue, not duplicates in several categories. "
                "Grammar types: sentence_structure, agreement, word_form, verb_tense, word_order, "
                "articles, sentence_connection, punctuation. Word types: spelling, word_choice. "
                "Optional suggestions: naturalness (valid but awkward; explicitly say optional) "
                "or ambiguity. Never mark a correctly spelled word such as this as spelling. "
                "Do not generate unchanged corrections or invent errors to fill a quota. "
                "Use issues=[] and correctedText=original for correct natural English. "
                "Example: original='This amazing' -> replacement='This is amazing.'; "
                "type=sentence_structure; explanation=Use 'is' after 'this' to describe it.; "
                "example='This is nice.' "
                "Example: 'I have a questions' -> 'I have a question.'; type=agreement; "
                "explanation=After 'a', use one thing. "
                "Example: 'Did you leared?' -> 'Did you learn?'; type=word_order; "
                "explanation=After 'did', use the basic form of the verb. "
                "Replacement fragments must include ALL fixes in that fragment, not broken partial "
                "sentences for another pass to fix. The complete text must include all fixes too. "
                "Do not assume whether wont means want to or won't. Use context; if genuinely "
                "unclear, correctedText=null and add an ambiguity suggestion with 2-3 alternatives "
                "(replacement + meaning). Never silently choose a different meaning. "
                "feedback is short factual advice; no praise for actions not in the email. "
                "Assess ONLY learnerEmail; previousEmail is context. " + DATA_NOT_INSTRUCTIONS
            ),
        },
        {
            "role": "user",
            "content": "Input: "
            + _payload(
                {
                    "level": task.level,
                    "previousEmail": task.messages[-2].content if len(task.messages) > 1 else "",
                    "learnerEmail": task.messages[-1].content,
                }
            ),
        },
    ]
