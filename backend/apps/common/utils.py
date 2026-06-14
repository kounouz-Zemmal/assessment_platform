import json
from decimal import Decimal
from typing import Dict, Optional

from django.http import JsonResponse
from django.utils import timezone


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
    "TIMED_OUT": "Not submitted",
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


PROCTOR_SUSPICIOUS_THRESHOLD_SECONDS = 10


def proctor_cache_key(assessment_id, student_id):
    return f"proctoring:{assessment_id}:{student_id}"


def normalize_aware_datetime(value):
    if value is None:
        return None
    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())
    return value


def parse_iso_datetime(value) -> Optional[timezone.datetime]:
    if not value:
        return None
    try:
        parsed = timezone.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return normalize_aware_datetime(parsed)


def build_proctor_status(event: Dict, now=None, threshold_seconds: Optional[int] = None):
    now = now or timezone.now()
    threshold_value = int(threshold_seconds or PROCTOR_SUSPICIOUS_THRESHOLD_SECONDS)
    last_seen = parse_iso_datetime(event.get("lastSeenAt"))
    away_since = parse_iso_datetime(event.get("awaySince"))
    outside_seconds = int(event.get("outsideDurationSeconds") or 0)

    if away_since:
        outside_seconds = max(outside_seconds, int((now - away_since).total_seconds()))
    stale_seconds = int((now - last_seen).total_seconds()) if last_seen else 10**9

    suspicious = bool(event.get("suspicious")) or outside_seconds >= threshold_value
    if stale_seconds >= (threshold_value + 10):
        suspicious = True

    return {
        "outsideDurationSeconds": max(0, outside_seconds),
        "staleSeconds": max(0, stale_seconds),
        "isSuspicious": suspicious,
    }
