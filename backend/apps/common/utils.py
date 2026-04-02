import json
from decimal import Decimal

from django.http import JsonResponse


ASSESSMENT_STATUS_MAP = {
    "DRAFT": "Draft",
    "SCHEDULED": "Scheduled",
    "ACTIVE": "Active",
    "CLOSED": "Closed",
    "PUBLISHED": "Published",
}

ATTEMPT_STATUS_MAP = {
    "IN_PROGRESS": "In Progress",
    "SUBMITTED": "Submitted",
    "AUTO_GRADED": "Graded",
    "MANUALLY_GRADED": "Graded",
    "FINALIZED": "Graded",
}


def to_float(value):
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def to_percentage(score_value, max_total):
    max_total = to_float(max_total)
    if max_total <= 0:
        return 0.0

    score_value = to_float(score_value)
    if score_value <= max_total:
        return (score_value / max_total) * 100

    if score_value <= 100:
        return score_value

    return 100.0


def assessment_status(label):
    return ASSESSMENT_STATUS_MAP.get((label or "").upper(), "Draft")


def attempt_status(label):
    return ATTEMPT_STATUS_MAP.get((label or "").upper(), "In Progress")


def visibility_payload(visibility):
    show_final_score = bool(visibility.show_final_score)
    show_score_breakdown = bool(visibility.show_score_breakdown)
    show_ai = bool(visibility.show_ai_keyword_analysis)
    return {
        "showFinalScore": show_final_score,
        "showScoreBreakdown": show_score_breakdown,
        "showTeacherFeedback": bool(visibility.show_teacher_feedback),
        "showAiKeywordAnalysis": show_ai,
        "showPerQuestionDetails": bool(visibility.show_per_question_details),
        "showScore": show_final_score,
        "showQuestionBreakdown": show_score_breakdown,
        "showKeywordAnalysis": show_ai,
    }


def required_int(request, key):
    raw_value = request.GET.get(key)
    if not raw_value:
        return None, JsonResponse({"detail": f"Missing query param: {key}"}, status=400)
    try:
        return int(raw_value), None
    except ValueError:
        return None, JsonResponse({"detail": f"Invalid integer query param: {key}"}, status=400)


def to_keyword_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def extract_keyword_analysis(private_note):
    if not private_note:
        return [], []

    try:
        payload = json.loads(private_note)
        if isinstance(payload, dict):
            detected = to_keyword_list(
                payload.get("detectedKeywords") or payload.get("detected_keywords") or []
            )
            missing = to_keyword_list(
                payload.get("missingKeywords") or payload.get("missing_keywords") or []
            )
            return detected, missing
    except ValueError:
        pass

    return [], []
