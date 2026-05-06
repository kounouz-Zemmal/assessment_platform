"""
Ollama-powered generation for question improvement, model answers, and grading keywords.
All provider calls stay in this module (not in Flask routes).
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
TEMPERATURE = 0.2
MAX_KEYWORDS = 15
MIN_KEYWORDS = 5


class AiServiceError(Exception):
    """Raised when configuration is invalid or the AI provider fails."""

    def __init__(self, message: str, status_code: int = 503) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _chat(system: str, user: str) -> str:
    prompt = f"System:\n{system}\n\nUser:\n{user}"
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": TEMPERATURE},
    }
    try:
        request = urllib.request.Request(
            f"{OLLAMA_URL.rstrip('/')}/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
    except urllib.error.URLError as exc:
        raise AiServiceError(
            "Ollama is not reachable. Start Ollama and pull the configured model.",
            503,
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise AiServiceError(f"Ollama API error: {exc!s}", 503) from exc

    text = str(data.get("response") or "").strip()
    if not text:
        raise AiServiceError("Ollama returned an empty response.", 503)
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


def evaluate_answer_with_keywords(answer_text: str, keywords: list[dict], max_points: float) -> dict:
    """
    Evaluate a student descriptive answer against instructor-selected keywords.
    Returns JSON-friendly payload:
      { score, detected_keywords, missing_keywords }
    """
    if max_points <= 0:
        max_points = 1.0

    normalized_keywords: list[dict] = []
    for item in keywords or []:
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        try:
            weight = float(item.get("weight", 1.0))
        except (TypeError, ValueError):
            weight = 1.0
        normalized_keywords.append({"text": text, "weight": max(0.1, weight)})

    if not normalized_keywords:
        return {"score": 0.0, "detected_keywords": [], "missing_keywords": []}

    normalized_answer = f" {answer_text.lower()} "
    detected_clean: list[str] = []
    missing_clean: list[str] = []
    detected_weight = 0.0
    total_weight = sum(item["weight"] for item in normalized_keywords) or 1.0

    for item in normalized_keywords:
        keyword = item["text"]
        keyword_lower = keyword.lower()
        # Word-boundary based containment to avoid accidental partial matches.
        pattern = r"\b" + re.escape(keyword_lower) + r"\b"
        if re.search(pattern, normalized_answer):
            detected_clean.append(keyword)
            detected_weight += item["weight"]
        else:
            missing_clean.append(keyword)

    score = max_points * (detected_weight / total_weight)
    score = max(0.0, min(max_points, score))

    return {
        "score": score,
        "detected_keywords": detected_clean,
        "missing_keywords": missing_clean,
    }
