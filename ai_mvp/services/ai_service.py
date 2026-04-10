"""
Gemini-powered generation for question improvement, model answers, and grading keywords.
All provider calls stay in this module (not in Flask routes).
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv
import google.generativeai as genai

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env")

MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
TEMPERATURE = 0.2
MAX_KEYWORDS = 15
MIN_KEYWORDS = 5


class AiServiceError(Exception):
    """Raised when configuration is invalid or the AI provider fails."""

    def __init__(self, message: str, status_code: int = 503) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _get_model() -> genai.GenerativeModel:
    key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if not key:
        raise AiServiceError(
            "GEMINI_API_KEY is not set. Copy ai_mvp/.env.example to ai_mvp/.env and add your key "
            "(https://aistudio.google.com/app/apikey).",
            503,
        )
    try:
        genai.configure(api_key=key)
        return genai.GenerativeModel(model_name=MODEL)
    except Exception as exc:  # noqa: BLE001
        raise AiServiceError(f"Gemini client setup error: {exc!s}", 503) from exc


def _chat(system: str, user: str) -> str:
    model = _get_model()
    prompt = f"System:\n{system}\n\nUser:\n{user}"
    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=TEMPERATURE,
            ),
        )
    except Exception as exc:  # noqa: BLE001 — surface safe message to API
        raise AiServiceError(f"Gemini API error: {exc!s}", 503) from exc

    text = (response.text or "").strip()
    if not text:
        raise AiServiceError("Gemini returned an empty response.", 503)
    return text


def _improve_question(question: str) -> str:
    system = (
        "You are an expert educator. Rewrite the student's assessment question to be clearer, "
        "unambiguous, and appropriate for classroom use. Keep the same topic and difficulty intent. "
        "Do not add answer hints. Output only the improved question text, no preamble."
    )
    return _chat(system, question)


def _generate_answer(question_text: str) -> str:
    system = (
        "You are a subject-matter expert. Given an exam question, produce a concise, correct model "
        "answer suitable for grading reference. Use complete sentences only if the question requires "
        "it; otherwise be brief. Output only the answer, no labels like 'Answer:'."
    )
    return _chat(system, f"Question:\n{question_text}")


def _extract_keywords_from_answer(answer_text: str) -> list[str]:
    system = (
        "You extract short grading keywords from a model answer for automated keyword-based scoring.\n"
        "Rules:\n"
        "- Keywords must be short concepts or phrases (1–4 words each), not full sentences.\n"
        "- Derive concepts only from the answer text (do not invent facts).\n"
        "- Return between 5 and 15 items.\n"
        "- Respond with a single JSON array of strings only, no markdown, no explanation.\n"
        "Example: [\"photosynthesis\", \"chlorophyll\", \"glucose\"]"
    )
    raw = _chat(system, f"Model answer:\n{answer_text}")
    return _parse_keyword_json(raw)


def _parse_keyword_json(raw: str) -> list[str]:
    raw = raw.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: split lines or commas
        parts = re.split(r"[\n,]", raw)
        data = [p.strip().strip('"').strip("'") for p in parts if p.strip()]

    if not isinstance(data, list):
        raise AiServiceError("Keyword model did not return a JSON array.", 503)

    cleaned: list[str] = []
    for item in data:
        if not isinstance(item, str):
            continue
        s = item.strip()
        if not s or len(s) > 80:
            continue
        cleaned.append(s)

    # Enforce 5–15 by trimming or padding is wrong; clip to max, require at least what we got
    cleaned = cleaned[:MAX_KEYWORDS]
    if len(cleaned) < MIN_KEYWORDS and len(cleaned) > 0:
        # Accept partial list rather than failing the whole request
        pass
    return cleaned


def generate_ai_content(question: str, answer: bool, keywords: bool, improve: bool) -> dict:
    """
    Optional AI features:
    - improve: rewrite question → improved_question
    - answer: model answer → answer (and feeds keywords when keywords=True)
    - keywords: concepts from the model answer (requires generating answer if not returned to user)
    """
    if not any([answer, keywords, improve]):
        return {"improved_question": "", "answer": "", "keywords": []}

    improved_question = ""
    working_question = question.strip()

    if improve:
        improved_question = _improve_question(working_question)
        working_question = improved_question

    # Internal answer text: needed for keywords and/or returned answer field
    internal_answer = ""
    if answer or keywords:
        internal_answer = _generate_answer(working_question)

    response_answer = internal_answer if answer else ""

    keyword_list: list[str] = []
    if keywords:
        if not internal_answer:
            internal_answer = _generate_answer(working_question)
        keyword_list = _extract_keywords_from_answer(internal_answer)

    return {
        "improved_question": improved_question if improve else "",
        "answer": response_answer,
        "keywords": keyword_list,
    }
