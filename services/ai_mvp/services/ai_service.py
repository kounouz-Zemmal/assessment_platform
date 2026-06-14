"""
Llama-powered (via Ollama) generation for question improvement, model answers, and grading keywords.
All provider calls stay in this module (not in Flask routes).
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv
import requests

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env")

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "10.80.11.107")
OLLAMA_PORT = os.getenv("OLLAMA_PORT", "11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
OLLAMA_URL = f"http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/generate"
OLLAMA_TAGS_URL = f"http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/tags"

TEMPERATURE = 0.2
MAX_KEYWORDS = 15
MIN_KEYWORDS = 5
CONNECT_TIMEOUT_SECONDS = 2
READ_TIMEOUT_SECONDS = 25
HEALTH_TTL_SECONDS = 30

_LAST_HEALTH_CHECK_AT = 0.0


class AiServiceError(Exception):
    """Raised when configuration is invalid or the AI provider fails."""

    def __init__(self, message: str, status_code: int = 503) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _verify_ollama_connection() -> None:
    """Verify that Ollama is reachable and model is available."""
    global _LAST_HEALTH_CHECK_AT
    now = time.time()
    if now - _LAST_HEALTH_CHECK_AT < HEALTH_TTL_SECONDS:
        return

    try:
        response = requests.get(
            OLLAMA_TAGS_URL,
            timeout=(CONNECT_TIMEOUT_SECONDS, CONNECT_TIMEOUT_SECONDS),
        )
        response.raise_for_status()
        data = response.json()
        models = [m.get("name", "") for m in data.get("models", [])]
        if OLLAMA_MODEL not in models:
            raise AiServiceError(
                f"Model '{OLLAMA_MODEL}' not found on Ollama. Available models: {', '.join(models)}. "
                f"Run: ollama pull {OLLAMA_MODEL}",
                503,
            )
        _LAST_HEALTH_CHECK_AT = now
    except requests.RequestException as exc:
        raise AiServiceError(
            f"Cannot connect to Ollama at {OLLAMA_URL}. "
            f"Ensure Ollama is running: ollama serve",
            503,
        ) from exc


def _chat(system: str, user: str) -> str:
    """Call Ollama Llama model with system and user prompts."""
    _verify_ollama_connection()
    prompt = f"System:\n{system}\n\nUser:\n{user}"
    
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "temperature": TEMPERATURE,
                "stream": False,
            },
            timeout=(CONNECT_TIMEOUT_SECONDS, READ_TIMEOUT_SECONDS),
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise AiServiceError(f"Ollama API error: {exc!s}", 503) from exc

    try:
        data = response.json()
        text = (data.get("response") or "").strip()
    except ValueError as exc:
        raise AiServiceError(f"Invalid JSON from Ollama: {exc!s}", 503) from exc

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
        f"Extract {MIN_KEYWORDS}–{MAX_KEYWORDS} essential keywords or key phrases from the given text. "
        "Return as a JSON array of strings (no explanation). "
        "Example: [\"photosynthesis\", \"chlorophyll\", \"light energy\"]"
    )
    response_text = _chat(system, f"Text:\n{answer_text}")
    return _parse_keyword_json(response_text)


def _generate_answer_and_keywords(question_text: str) -> tuple[str, list[str]]:
    system = (
        "You are a subject-matter expert and grading assistant.\n"
        "Given an exam question, provide:\n"
        "1) a concise model answer\n"
        "2) 5-15 short grading keywords (1-4 words each), derived only from the answer\n"
        "Return strict JSON object only: {\"answer\": \"...\", \"keywords\": [\"...\", \"...\"]}"
    )
    raw = _chat(system, f"Question:\n{question_text}")
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise AiServiceError(f"Invalid JSON from Ollama for answer+keywords: {exc!s}", 503) from exc

    if not isinstance(parsed, dict):
        raise AiServiceError("Invalid structured answer from Ollama.", 503)
    answer_text = str(parsed.get("answer", "")).strip()
    keywords_raw = parsed.get("keywords", [])
    if not isinstance(keywords_raw, list):
        keywords_raw = []
    keywords = [str(k).strip() for k in keywords_raw if str(k).strip()][:MAX_KEYWORDS]
    return answer_text, keywords


def _parse_keyword_json(raw: str) -> list[str]:
    raw = raw.strip()
    if raw.startswith("[") and raw.endswith("]"):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(k).strip() for k in parsed if str(k).strip()]
        except json.JSONDecodeError:
            pass
    return []


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
    keyword_list: list[str] = []
    if answer and keywords:
        internal_answer, keyword_list = _generate_answer_and_keywords(working_question)
    elif answer or keywords:
        internal_answer = _generate_answer(working_question)

    response_answer = internal_answer if answer else ""

    if keywords and not keyword_list:
        if not internal_answer:
            internal_answer = _generate_answer(working_question)
        keyword_list = _extract_keywords_from_answer(internal_answer)

    return {
        "improved_question": improved_question,
        "answer": response_answer,
        "keywords": keyword_list,
    }


def evaluate_answer_with_keywords(answer_text: str, keywords: list[dict], max_points: float) -> dict:
    """
    Grade a student answer by keyword matching with fuzzy tolerance.
    Keywords is a list of dicts: [{"text": "...", "weight": 1.0, "synonyms": [...]}, ...]
    Returns { "points": float, "feedback": str, "keyword_matches": [...] }
    """
    answer_lower = answer_text.lower()
    keyword_matches = []
    total_weight = 0.0
    matched_weight = 0.0

    for kw_entry in keywords:
        kw_text = str(kw_entry.get("text", "")).strip().lower()
        weight = float(kw_entry.get("weight", 1.0))
        synonyms = [str(s).strip().lower() for s in kw_entry.get("synonyms", [])]
        search_terms = [kw_text] + synonyms

        is_matched = any(term in answer_lower for term in search_terms)
        total_weight += weight

        if is_matched:
            keyword_matches.append(kw_text)
            matched_weight += weight

    # Linear scoring: matched_weight / total_weight * max_points
    if total_weight > 0:
        points = (matched_weight / total_weight) * max_points
    else:
        points = 0.0

    feedback = f"Matched {len(keyword_matches)}/{len(keywords)} keywords."
    return {
        "points": round(points, 2),
        "feedback": feedback,
        "keyword_matches": keyword_matches,
    }