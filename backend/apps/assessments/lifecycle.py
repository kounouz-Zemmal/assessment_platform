from datetime import timedelta

from django.utils import timezone

from apps.common.utils import normalize_aware_datetime


def refresh_assessment_lifecycle(assessment):
    """
    Keep assessment.status aligned with real schedule:
    - SCHEDULED -> ACTIVE when start has passed
    - SCHEDULED/ACTIVE -> CLOSED when the resolved end has passed
    PUBLISHED is not auto-changed.
    """
    if not assessment or not assessment.id:
        return assessment

    status = (assessment.status or "").upper()
    if status in {"PUBLISHED"}:
        return assessment

    start = normalize_aware_datetime(assessment.start_time) if assessment.start_time else None
    end_db = normalize_aware_datetime(assessment.end_time) if assessment.end_time else None
    duration_mins = int(assessment.duration_minutes or 0)
    duration_end = start + timedelta(minutes=duration_mins) if start and duration_mins > 0 else None

    if end_db and duration_end:
        resolved_end = min(end_db, duration_end)
    else:
        resolved_end = end_db or duration_end

    now = timezone.now()
    new_status = None

    if start and now >= start and status == "SCHEDULED":
        new_status = "ACTIVE"
    if resolved_end and now > resolved_end and status in {"SCHEDULED", "ACTIVE"}:
        new_status = "CLOSED"

    if not new_status or new_status == status:
        return assessment

    assessment.status = new_status
    assessment.updated_at = now
    assessment.save(update_fields=["status", "updated_at"])
    return assessment
