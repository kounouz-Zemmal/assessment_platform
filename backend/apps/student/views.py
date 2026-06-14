from collections import defaultdict
import json
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import IntegrityError, connection
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.models import User
from apps.academics.models import StudentGroup
from apps.assessments.models import (
    Answer,
    AnswerKeywordAnalysis,
    Assessment,
    AssessmentQuestion,
    AssessmentResultVisibility,
    Attempt,
    Choice,
    Feedback,
    QuestionKeyword,
)
from apps.assessments.lifecycle import refresh_assessment_lifecycle
from apps.common.utils import (
    assessment_status,
    attempt_status,
    build_proctor_status,
    parse_iso_datetime,
    PROCTOR_SUSPICIOUS_THRESHOLD_SECONDS,
    proctor_cache_key,
    to_float,
    to_percentage,
    visibility_payload,
)


def require_student_auth(request):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    role_name = getattr(getattr(request.user, "role", None), "name", "").lower()
    if role_name != "student":
        return JsonResponse({"detail": "Forbidden"}, status=403)

    return None


def _normalize_question_type(value):
    return (value or "").strip().upper().replace("/", "_").replace(" ", "_")


def _parse_bool_answer(value):
    text = (value or "").strip().lower()
    if text in {"true", "t", "1", "yes"}:
        return True
    if text in {"false", "f", "0", "no"}:
        return False
    return None


def _infer_correct_answer(question_type, student_answer, is_correct):
    qtype = _normalize_question_type(question_type)
    if qtype in {"MCQ", "SCQ", "TRUE_FALSE", "TRUEFALSE", "BOOLEAN"}:
        answer_text = (student_answer or "").strip()
        if not answer_text:
            return None
        if is_correct is True:
            return answer_text
        if qtype in {"TRUE_FALSE", "TRUEFALSE", "BOOLEAN"} and is_correct is False:
            parsed = _parse_bool_answer(answer_text)
            if parsed is not None:
                return "True" if not parsed else "False"
    return None


def _student_enrolled_module_ids(student_id):
    return list(
        StudentGroup.objects.filter(
            student_id=student_id,
            group__module__deleted_at__isnull=True,
            group__module__is_active=True,
        ).values_list("group__module_id", flat=True)
    )


def _attempt_is_successfully_submitted(attempt):
    return (attempt.status or "").upper() in {"SUBMITTED", "AUTO_GRADED", "MANUALLY_GRADED", "FINALIZED"}


def _attempt_is_timed_out(attempt):
    return (attempt.status or "").upper() == "TIMED_OUT"


def _attempt_allows_editing(attempt):
    """Only in-progress attempts accept saves, proctoring, and submission."""
    return (attempt.status or "").upper() == "IN_PROGRESS"


# Backward-compatible name used across student flows for graded/submitted attempts.
def _attempt_is_final(attempt):
    return _attempt_is_successfully_submitted(attempt)


def _assessment_open_for_attempt(assessment):
    status_value = (assessment.status or "").upper()
    if status_value in {"DRAFT", "CLOSED"}:
        return False, "Assessment is not open"

    now = timezone.now()
    start_time = assessment.start_time
    end_time = assessment.end_time
    if start_time and timezone.is_naive(start_time):
        start_time = timezone.make_aware(start_time, timezone.get_current_timezone())
    if end_time and timezone.is_naive(end_time):
        end_time = timezone.make_aware(end_time, timezone.get_current_timezone())

    if start_time and now < start_time:
        return False, "Assessment has not started yet"
    if end_time and now > end_time:
        return False, "Assessment has already ended"
    return True, None


def _assessment_window(assessment):
    start_time = assessment.start_time
    end_time = assessment.end_time
    if start_time and timezone.is_naive(start_time):
        start_time = timezone.make_aware(start_time, timezone.get_current_timezone())
    if end_time and timezone.is_naive(end_time):
        end_time = timezone.make_aware(end_time, timezone.get_current_timezone())
    return start_time, end_time


def _assessment_can_start(assessment, has_successful_submission, timed_out_without_submission=False):
    now = timezone.now()
    start_time, end_time = _assessment_window(assessment)
    status_value = (assessment.status or "").upper()
    if status_value in {"DRAFT", "CLOSED"}:
        return False
    if has_successful_submission or timed_out_without_submission:
        return False
    return (
        (start_time is None or now >= start_time)
        and (end_time is None or now <= end_time)
    )


def _dispatch_assessment_start_notifications(assessment):
    start_time, end_time = _assessment_window(assessment)
    now = timezone.now()
    if not start_time or now < start_time:
        return
    if end_time and now > end_time:
        return

    cache_key = f"assessment-start-notified:{assessment.id}"
    if not cache.add(cache_key, "1", timeout=60 * 60 * 24 * 7):
        return

    student_rows = StudentGroup.objects.filter(group__module_id=assessment.module_id).select_related("student")
    recipients = sorted({row.student.email for row in student_rows if row.student and row.student.email})
    if not recipients:
        return
    if not getattr(settings, "DEFAULT_FROM_EMAIL", None):
        return

    subject = f"Assessment started: {assessment.title}"
    start_local = timezone.localtime(start_time).strftime("%Y-%m-%d %H:%M")
    end_local = timezone.localtime(end_time).strftime("%Y-%m-%d %H:%M") if end_time else "N/A"
    body = (
        f"Your assessment is now available.\n\n"
        f"Title: {assessment.title}\n"
        f"Module: {assessment.module.code} - {assessment.module.name}\n"
        f"Start: {start_local}\n"
        f"End: {end_local}\n\n"
        "Please log in and start the assessment within the valid window."
    )
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=True,
        )
    except Exception:
        pass


def _normalize_answer_payload(value):
    if isinstance(value, list):
        return ", ".join(str(item).strip() for item in value if str(item).strip())
    return str(value or "").strip()


def _ensure_proctoring_tables():
    with connection.cursor() as cursor:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS assessment_proctoring_config (
                assessment_id BIGINT PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
                tab_switch_threshold_seconds INTEGER NOT NULL DEFAULT 10,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS proctoring_tab_activity (
                id BIGSERIAL PRIMARY KEY,
                assessment_id BIGINT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
                attempt_id BIGINT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
                student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                switched_at TIMESTAMPTZ NOT NULL,
                returned_at TIMESTAMPTZ NULL,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_proctor_activity_attempt ON proctoring_tab_activity(attempt_id)"
        )


def _assessment_tab_switch_threshold_seconds(assessment_id: int) -> int:
    _ensure_proctoring_tables()
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT tab_switch_threshold_seconds FROM assessment_proctoring_config WHERE assessment_id = %s",
            [assessment_id],
        )
        row = cursor.fetchone()
    if not row:
        return PROCTOR_SUSPICIOUS_THRESHOLD_SECONDS
    try:
        value = int(row[0])
    except (TypeError, ValueError):
        return PROCTOR_SUSPICIOUS_THRESHOLD_SECONDS
    return max(1, value)


_ATTEMPTS_TIMED_OUT_CONSTRAINT_CACHE_KEY = "ddl:attempts_status_includes_timed_out_v1"


def _ensure_attempts_status_allows_timed_out():
    """
    Ensure attempts.status accepts TIMED_OUT (PostgreSQL CHECK). Matches sql_patches/
    001_attempt_status_timed_out.sql so installs do not require a manual DB step.
    """
    if connection.vendor != "postgresql":
        return
    if cache.get(_ATTEMPTS_TIMED_OUT_CONSTRAINT_CACHE_KEY):
        return
    add_sql = """
        ALTER TABLE attempts ADD CONSTRAINT attempts_status_check CHECK (
            status::text = ANY (
                ARRAY[
                    'IN_PROGRESS'::character varying,
                    'SUBMITTED'::character varying,
                    'AUTO_GRADED'::character varying,
                    'MANUALLY_GRADED'::character varying,
                    'FINALIZED'::character varying,
                    'TIMED_OUT'::character varying
                ]::text[]
            )
        );
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("ALTER TABLE attempts DROP CONSTRAINT IF EXISTS attempts_status_check;")
            cursor.execute(add_sql)
        cache.set(_ATTEMPTS_TIMED_OUT_CONSTRAINT_CACHE_KEY, "1", timeout=None)
        return
    except Exception:
        pass
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT c.conname
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                WHERE t.relname = 'attempts' AND c.contype = 'c'
                  AND pg_get_constraintdef(c.oid) ILIKE %s
                """,
                ["%status%"],
            )
            for row in cursor.fetchall():
                qn = connection.ops.quote_name(row[0])
                cursor.execute(f"ALTER TABLE attempts DROP CONSTRAINT IF EXISTS {qn}")
            cursor.execute(add_sql)
        cache.set(_ATTEMPTS_TIMED_OUT_CONSTRAINT_CACHE_KEY, "1", timeout=None)
    except Exception:
        pass


def _grade_objective_answer(question, answer_text):
    qtype = _normalize_question_type(question.type)
    text = (answer_text or "").strip()
    if not text:
        return None, 0.0
    if qtype in {"MCQ", "SCQ", "TRUE_FALSE", "TRUEFALSE", "BOOLEAN"}:
        correct_choices = list(
            Choice.objects.filter(question_id=question.id, is_correct=True).values_list("content", flat=True)
        )
        normalized_correct = {item.strip().lower() for item in correct_choices}
        is_correct = text.strip().lower() in normalized_correct
        return is_correct, (1.0 if is_correct else 0.0)
    return None, None


@require_GET
def student_dashboard(request):
    auth_error = require_student_auth(request)
    if auth_error:
        return auth_error

    student_id = request.user.id

    try:
        student = User.objects.get(id=student_id)
    except User.DoesNotExist:
        return JsonResponse({"detail": "Student not found"}, status=404)

    enrollment_rows = (
        StudentGroup.objects.filter(
            student_id=student_id,
            group__module__deleted_at__isnull=True,
            group__module__is_active=True,
        )
        .select_related("group", "group__module")
        .order_by("group__module__code", "group__name")
    )
    module_ids = [row.group.module_id for row in enrollment_rows]

    assessments = list(
        Assessment.objects.filter(
            module_id__in=module_ids,
            deleted_at__isnull=True,
            module__deleted_at__isnull=True,
            module__is_active=True,
        )
        .select_related("module")
        .order_by("start_time", "id")
    )
    for a in assessments:
        refresh_assessment_lifecycle(a)
    attempts = list(
        Attempt.objects.filter(student_id=student_id, assessment_id__in=[a.id for a in assessments])
    )
    attempts_by_assessment = defaultdict(list)
    for attempt in attempts:
        attempts_by_assessment[attempt.assessment_id].append(attempt)

    upcoming = [a for a in assessments if a.status in {"SCHEDULED", "ACTIVE"}]
    completed_attempts = [
        attempt
        for attempt in attempts
        if attempt.status in {"SUBMITTED", "AUTO_GRADED", "MANUALLY_GRADED", "FINALIZED"}
    ]
    graded_attempts = [
        attempt
        for attempt in attempts
        if attempt.status in {"AUTO_GRADED", "MANUALLY_GRADED", "FINALIZED"}
    ]

    avg_percentage = 0
    if graded_attempts:
        percentages = []
        for attempt in graded_attempts:
            max_score = sum(
                to_float(point)
                for point in AssessmentQuestion.objects.filter(
                    assessment_id=attempt.assessment_id
                ).values_list("points", flat=True)
            ) or 1.0
            percentages.append(to_percentage(attempt.score, max_score))
        avg_percentage = round(sum(percentages) / len(percentages))

    recent_attempts = sorted(
        completed_attempts,
        key=lambda item: item.submitted_at or item.updated_at,
        reverse=True,
    )[:5]

    assessment_lookup = {a.id: a for a in assessments}
    recent_results = []
    for attempt in recent_attempts:
        assessment = assessment_lookup.get(attempt.assessment_id)
        if not assessment:
            continue
        max_score = sum(
            to_float(point)
            for point in AssessmentQuestion.objects.filter(
                assessment_id=assessment.id
            ).values_list("points", flat=True)
        )
        recent_results.append(
            {
                "assessmentId": str(assessment.id),
                "title": assessment.title,
                "moduleCode": assessment.module.code,
                "status": attempt_status(attempt.status),
                "score": to_float(attempt.score) if attempt.score is not None else None,
                "maxScore": max_score,
            }
        )

    payload = {
        "studentName": f"{student.first_name} {student.last_name}".strip(),
        "stats": {
            "upcomingCount": len(upcoming),
            "completedCount": len(completed_attempts),
            "averageScore": avg_percentage,
            "enrolledModulesCount": len(enrollment_rows),
        },
        "upcomingAssessments": [
            {
                "id": str(assessment.id),
                "title": assessment.title,
                "moduleCode": assessment.module.code,
                "moduleName": assessment.module.name,
                "startTime": assessment.start_time.isoformat() if assessment.start_time else None,
                "duration": assessment.duration_minutes,
                "status": assessment_status(assessment.status),
                "hasSubmission": bool(attempts_by_assessment.get(assessment.id)),
            }
            for assessment in upcoming
        ],
        "recentResults": recent_results,
        "enrolledModules": [
            {
                "id": str(row.group.module.id),
                "code": row.group.module.code,
                "name": row.group.module.name,
                "group": row.group.name,
            }
            for row in enrollment_rows
        ],
    }
    return JsonResponse(payload)


@require_GET
def student_assessments(request):
    auth_error = require_student_auth(request)
    if auth_error:
        return auth_error

    student_id = request.user.id
    module_ids = _student_enrolled_module_ids(student_id)
    assessments = list(
        Assessment.objects.filter(
            module_id__in=module_ids,
            deleted_at__isnull=True,
            module__deleted_at__isnull=True,
            module__is_active=True,
            status__in=["SCHEDULED", "ACTIVE", "CLOSED", "PUBLISHED"],
        )
        .select_related("module")
        .order_by("-start_time", "-created_at")
    )
    for a in assessments:
        refresh_assessment_lifecycle(a)
    attempts_by_assessment = {
        row.assessment_id: row
        for row in Attempt.objects.filter(student_id=student_id, assessment_id__in=[a.id for a in assessments]).order_by(
            "assessment_id", "-attempt_number"
        )
    }

    notifications = []
    payload_items = []
    for item in assessments:
        latest_attempt = attempts_by_assessment.get(item.id)
        has_submission = bool(latest_attempt and _attempt_is_successfully_submitted(latest_attempt))
        timed_out_without_submission = bool(latest_attempt and _attempt_is_timed_out(latest_attempt))
        start_time, end_time = _assessment_window(item)
        can_start = _assessment_can_start(item, has_submission, timed_out_without_submission)

        if can_start:
            _dispatch_assessment_start_notifications(item)
            notifications.append(
                {
                    "type": "assessment_started",
                    "assessmentId": str(item.id),
                    "title": item.title,
                    "message": f"{item.title} is now available. You can start now.",
                }
            )

        payload_items.append(
            {
                "id": str(item.id),
                "title": item.title,
                "moduleId": str(item.module_id),
                "moduleCode": item.module.code,
                "moduleName": item.module.name,
                "duration": item.duration_minutes,
                "startTime": start_time.isoformat() if start_time else None,
                "endTime": end_time.isoformat() if end_time else None,
                "status": assessment_status(item.status),
                "instructions": item.instructions or "",
                "questionCount": AssessmentQuestion.objects.filter(assessment_id=item.id).count(),
                "hasSubmission": has_submission,
                "timedOutWithoutSubmission": timed_out_without_submission,
                "canStart": can_start,
            }
        )

    return JsonResponse({"assessments": payload_items, "notifications": notifications})


@require_GET
def student_assessment_instructions(request, assessment_id):
    auth_error = require_student_auth(request)
    if auth_error:
        return auth_error

    student_id = request.user.id
    try:
        assessment = Assessment.objects.select_related("module").get(id=assessment_id, deleted_at__isnull=True)
    except Assessment.DoesNotExist:
        return JsonResponse({"detail": "Assessment not found"}, status=404)
    refresh_assessment_lifecycle(assessment)

    if assessment.module_id not in _student_enrolled_module_ids(student_id):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    active_attempt = (
        Attempt.objects.filter(student_id=student_id, assessment_id=assessment_id).order_by("-attempt_number").first()
    )
    return JsonResponse(
        {
            "assessment": {
                "id": str(assessment.id),
                "title": assessment.title,
                "moduleCode": assessment.module.code,
                "moduleName": assessment.module.name,
                "duration": assessment.duration_minutes,
                "instructions": assessment.instructions or "",
                "status": assessment_status(assessment.status),
                "autoSubmitOnTimeout": bool(assessment.auto_submit),
                "tabSwitchWarning": bool(assessment.tab_warning),
                "tabSwitchThresholdSeconds": _assessment_tab_switch_threshold_seconds(assessment.id),
                "shuffleAnswers": bool(assessment.shuffle_choices),
                "questionCount": AssessmentQuestion.objects.filter(assessment_id=assessment.id).count(),
            },
            "attempt": {
                "id": str(active_attempt.id),
                "status": attempt_status(active_attempt.status),
                "startTime": active_attempt.start_time.isoformat() if active_attempt.start_time else None,
            }
            if active_attempt and _attempt_allows_editing(active_attempt)
            else None,
            "timedOutWithoutSubmission": bool(active_attempt and _attempt_is_timed_out(active_attempt)),
        }
    )


def _attempt_detail_payload(attempt, assessment):
    question_rows = list(
        AssessmentQuestion.objects.filter(assessment_id=assessment.id).select_related("question").order_by("sort_order", "id")
    )
    answer_rows = {row.question_id: row for row in Answer.objects.filter(attempt_id=attempt.id)}
    choices_by_question_id = defaultdict(list)
    for choice in Choice.objects.filter(question_id__in=[row.question_id for row in question_rows]).order_by("sort_order", "id"):
        choices_by_question_id[choice.question_id].append(choice.content)
    keywords_by_question_id = defaultdict(list)
    for item in QuestionKeyword.objects.filter(
        question_id__in=[row.question_id for row in question_rows], is_active=True
    ).order_by("id"):
        keywords_by_question_id[item.question_id].append(item.keyword)

    start_time = attempt.start_time
    if start_time and timezone.is_naive(start_time):
        start_time = timezone.make_aware(start_time, timezone.get_current_timezone())
    assessment_end_time = assessment.end_time
    if assessment_end_time and timezone.is_naive(assessment_end_time):
        assessment_end_time = timezone.make_aware(assessment_end_time, timezone.get_current_timezone())
    scheduled_deadline = (
        start_time + timedelta(minutes=assessment.duration_minutes) if start_time else None
    )
    if assessment_end_time and scheduled_deadline:
        deadline_time = min(scheduled_deadline, assessment_end_time)
    else:
        deadline_time = assessment_end_time or scheduled_deadline

    return {
        "attempt": {
            "id": str(attempt.id),
            "status": attempt_status(attempt.status),
            "startTime": start_time.isoformat() if start_time else None,
            "submittedAt": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
            "remainingSeconds": max(
                0,
                int((deadline_time - timezone.now()).total_seconds()),
            )
            if deadline_time
            else assessment.duration_minutes * 60,
        },
        "assessment": {
            "id": str(assessment.id),
            "title": assessment.title,
            "duration": assessment.duration_minutes,
            "moduleCode": assessment.module.code,
            "shuffleAnswers": bool(assessment.shuffle_choices),
            "autoSubmitOnTimeout": bool(assessment.auto_submit),
            "tabSwitchWarning": bool(assessment.tab_warning),
            "tabSwitchThresholdSeconds": _assessment_tab_switch_threshold_seconds(assessment.id),
            "perQuestionTimerEnabled": False,
            "perQuestionTimeoutBehavior": "next",
        },
        "questions": [
            {
                "id": str(row.question_id),
                "text": row.question.content,
                "type": row.question.type,
                "points": to_float(row.points),
                "options": choices_by_question_id.get(row.question_id, []),
                "keywords": keywords_by_question_id.get(row.question_id, []),
                "answer": answer_rows[row.question_id].text_answer if row.question_id in answer_rows else "",
                "questionTimeLimitSeconds": None,
            }
            for row in question_rows
        ],
    }


def _save_attempt_answers(attempt, answers_dict):
    now = timezone.now()
    for question_id_raw, answer_value in (answers_dict or {}).items():
        try:
            question_id = int(question_id_raw)
        except (TypeError, ValueError):
            continue
        answer_text = _normalize_answer_payload(answer_value)
        answer_row = Answer.objects.filter(attempt_id=attempt.id, question_id=question_id).first()
        if answer_row:
            answer_row.text_answer = answer_text
            answer_row.answered_at = now
            answer_row.updated_at = now
            answer_row.save(update_fields=["text_answer", "answered_at", "updated_at"])
        else:
            Answer.objects.create(
                attempt_id=attempt.id,
                question_id=question_id,
                text_answer=answer_text,
                is_correct=None,
                auto_score=0,
                manual_score=None,
                final_score=None,
                answered_at=now,
                created_at=now,
                updated_at=now,
            )
    attempt.last_activity_at = now
    attempt.updated_at = now
    attempt.save(update_fields=["last_activity_at", "updated_at"])


@csrf_exempt
@require_http_methods(["POST"])
def student_attempt_start(request, assessment_id):
    auth_error = require_student_auth(request)
    if auth_error:
        return auth_error
    student_id = request.user.id
    try:
        assessment = Assessment.objects.select_related("module").get(id=assessment_id, deleted_at__isnull=True)
    except Assessment.DoesNotExist:
        return JsonResponse({"detail": "Assessment not found"}, status=404)
    refresh_assessment_lifecycle(assessment)
    if assessment.module_id not in _student_enrolled_module_ids(student_id):
        return JsonResponse({"detail": "Forbidden"}, status=403)
    if not AssessmentQuestion.objects.filter(assessment_id=assessment_id).exists():
        return JsonResponse({"detail": "Assessment has no questions configured yet."}, status=409)
    can_open, reason = _assessment_open_for_attempt(assessment)
    if not can_open:
        return JsonResponse({"detail": reason or "Assessment is not open"}, status=409)
    existing = Attempt.objects.filter(student_id=student_id, assessment_id=assessment_id).order_by("-attempt_number").first()
    if existing and _attempt_is_successfully_submitted(existing):
        return JsonResponse({"detail": "Attempt already submitted"}, status=409)
    if existing and _attempt_is_timed_out(existing):
        return JsonResponse(
            {"detail": "Your time ended without a submission for this assessment."},
            status=409,
        )
    if existing and _attempt_allows_editing(existing):
        return JsonResponse(_attempt_detail_payload(existing, assessment))

    now = timezone.now()
    attempt = Attempt.objects.create(
        student_id=student_id,
        assessment_id=assessment_id,
        attempt_number=1,
        status="IN_PROGRESS",
        start_time=now,
        end_time=None,
        submitted_at=None,
        auto_submitted=False,
        last_activity_at=now,
        score=None,
        created_at=now,
        updated_at=now,
    )
    return JsonResponse(_attempt_detail_payload(attempt, assessment), status=201)


@require_GET
def student_attempt_detail(request, assessment_id):
    auth_error = require_student_auth(request)
    if auth_error:
        return auth_error
    student_id = request.user.id
    attempt = Attempt.objects.filter(student_id=student_id, assessment_id=assessment_id).order_by("-attempt_number").first()
    if not attempt:
        return JsonResponse({"detail": "Attempt not found"}, status=404)
    assessment = Assessment.objects.select_related("module").filter(id=assessment_id).first()
    if not assessment:
        return JsonResponse({"detail": "Assessment not found"}, status=404)
    if assessment.module_id not in _student_enrolled_module_ids(student_id):
        return JsonResponse({"detail": "Forbidden"}, status=403)
    payload = _attempt_detail_payload(attempt, assessment)
    if _attempt_is_timed_out(attempt):
        payload["questions"] = []
    return JsonResponse(payload)


@csrf_exempt
@require_http_methods(["PATCH"])
def student_attempt_save(request, assessment_id):
    auth_error = require_student_auth(request)
    if auth_error:
        return auth_error
    student_id = request.user.id
    attempt = (
        Attempt.objects.filter(student_id=student_id, assessment_id=assessment_id)
        .select_related("assessment")
        .order_by("-attempt_number")
        .first()
    )
    if not attempt:
        return JsonResponse({"detail": "Attempt not found"}, status=404)
    if attempt.assessment.module_id not in _student_enrolled_module_ids(student_id):
        return JsonResponse({"detail": "Forbidden"}, status=403)
    if not _attempt_allows_editing(attempt):
        return JsonResponse({"detail": "Attempt already finalized"}, status=409)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"detail": "Invalid JSON body"}, status=400)
    _save_attempt_answers(attempt, payload.get("answers") or {})
    return JsonResponse({"saved": True, "attemptId": str(attempt.id)})


@csrf_exempt
@require_http_methods(["POST"])
def student_attempt_proctoring_event(request, assessment_id):
    auth_error = require_student_auth(request)
    if auth_error:
        return auth_error
    student_id = request.user.id
    attempt = (
        Attempt.objects.filter(student_id=student_id, assessment_id=assessment_id)
        .select_related("assessment")
        .order_by("-attempt_number")
        .first()
    )
    if not attempt:
        return JsonResponse({"detail": "Attempt not found"}, status=404)
    if attempt.assessment.module_id not in _student_enrolled_module_ids(student_id):
        return JsonResponse({"detail": "Forbidden"}, status=403)
    if not _attempt_allows_editing(attempt):
        return JsonResponse({"detail": "Attempt already finalized"}, status=409)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        payload = {}

    event_type = str(payload.get("event") or "heartbeat").strip().lower()
    threshold_seconds = _assessment_tab_switch_threshold_seconds(assessment_id)
    now = timezone.now()
    cache_key = proctor_cache_key(assessment_id, student_id)
    current = cache.get(cache_key) or {}

    outside_duration_seconds = max(0, int(payload.get("outsideDurationSeconds") or 0))
    away_since = parse_iso_datetime(current.get("awaySince"))
    if event_type == "tab_hidden":
        away_since = now
    elif event_type == "tab_visible":
        away_since = None
    elif away_since:
        outside_duration_seconds = max(outside_duration_seconds, int((now - away_since).total_seconds()))

    suspicious_hint = bool(payload.get("suspicious"))
    active_event_id = int(current.get("activeEventId") or 0)
    _ensure_proctoring_tables()
    if event_type == "tab_hidden" and active_event_id <= 0:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO proctoring_tab_activity (
                    assessment_id, attempt_id, student_id, switched_at, returned_at, duration_seconds, created_at
                ) VALUES (%s, %s, %s, %s, NULL, 0, %s)
                RETURNING id
                """,
                [assessment_id, attempt.id, student_id, now, now],
            )
            inserted = cursor.fetchone()
            active_event_id = int(inserted[0]) if inserted else 0
    elif event_type == "tab_visible" and active_event_id > 0:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE proctoring_tab_activity
                SET returned_at = %s,
                    duration_seconds = GREATEST(duration_seconds, EXTRACT(EPOCH FROM (%s - switched_at))::INT)
                WHERE id = %s
                """,
                [now, now, active_event_id],
            )
        active_event_id = 0
    elif event_type == "heartbeat" and active_event_id > 0 and away_since:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE proctoring_tab_activity
                SET duration_seconds = GREATEST(duration_seconds, EXTRACT(EPOCH FROM (%s - switched_at))::INT)
                WHERE id = %s
                """,
                [now, active_event_id],
            )

    status_payload = build_proctor_status(
        {
            "lastSeenAt": now.isoformat(),
            "awaySince": away_since.isoformat() if away_since else None,
            "outsideDurationSeconds": outside_duration_seconds,
            "suspicious": suspicious_hint,
        },
        now=now,
        threshold_seconds=threshold_seconds,
    )

    next_state = {
        "assessmentId": str(assessment_id),
        "studentId": str(student_id),
        "attemptId": str(attempt.id),
        "event": event_type,
        "visibilityState": str(payload.get("visibilityState") or ("hidden" if event_type == "tab_hidden" else "visible")),
        "awaySince": away_since.isoformat() if away_since else None,
        "outsideDurationSeconds": status_payload["outsideDurationSeconds"],
        "currentQuestionIndex": int(payload.get("currentQuestionIndex") or 0),
        "lastSeenAt": now.isoformat(),
        "lastUpdatedAt": now.isoformat(),
        "suspicious": status_payload["isSuspicious"],
        "activeEventId": active_event_id,
    }
    cache.set(cache_key, next_state, timeout=60 * 30)

    attempt.last_activity_at = now
    attempt.updated_at = now
    attempt.save(update_fields=["last_activity_at", "updated_at"])
    return JsonResponse(
        {
            "saved": True,
            "attemptId": str(attempt.id),
            "isSuspicious": status_payload["isSuspicious"],
            "outsideDurationSeconds": status_payload["outsideDurationSeconds"],
            "thresholdSeconds": threshold_seconds,
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def student_attempt_submit(request, assessment_id):
    auth_error = require_student_auth(request)
    if auth_error:
        return auth_error
    student_id = request.user.id
    attempt = (
        Attempt.objects.filter(student_id=student_id, assessment_id=assessment_id)
        .select_related("assessment")
        .order_by("-attempt_number")
        .first()
    )
    if not attempt:
        return JsonResponse({"detail": "Attempt not found"}, status=404)
    if attempt.assessment.module_id not in _student_enrolled_module_ids(student_id):
        return JsonResponse({"detail": "Forbidden"}, status=403)
    if _attempt_is_successfully_submitted(attempt):
        return JsonResponse({"saved": True, "submitted": True, "attemptId": str(attempt.id)})
    if not _attempt_allows_editing(attempt):
        return JsonResponse(
            {"detail": "This attempt cannot be submitted (e.g. time expired without auto-submit)."},
            status=409,
        )

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        payload = {}
    _save_attempt_answers(attempt, payload.get("answers") or {})

    points_by_question = {
        row.question_id: to_float(row.points)
        for row in AssessmentQuestion.objects.filter(assessment_id=assessment_id).select_related("question")
    }
    answers = list(Answer.objects.filter(attempt_id=attempt.id).select_related("question"))
    total = 0.0
    now = timezone.now()
    for row in answers:
        correctness, ratio = _grade_objective_answer(row.question, row.text_answer)
        if ratio is not None:
            score = round(points_by_question.get(row.question_id, 0.0) * ratio, 2)
            row.is_correct = correctness
            row.auto_score = score
            row.final_score = score
            row.updated_at = now
            row.save(update_fields=["is_correct", "auto_score", "final_score", "updated_at"])
            total += score
            continue

        keywords = list(
            QuestionKeyword.objects.filter(question_id=row.question_id, is_active=True).values_list("keyword", flat=True)
        )
        answer_text = (row.text_answer or "").lower()
        detected = sorted({kw for kw in keywords if kw.lower() in answer_text})
        missing = sorted({kw for kw in keywords if kw.lower() not in answer_text})
        max_points = points_by_question.get(row.question_id, 0.0)
        score = round((len(detected) / max(1, len(keywords))) * max_points, 2) if keywords else 0.0
        row.auto_score = score
        row.final_score = score
        row.updated_at = now
        row.save(update_fields=["auto_score", "final_score", "updated_at"])
        AnswerKeywordAnalysis.objects.filter(answer_id=row.id).delete()
        for keyword in detected:
            keyword_obj = QuestionKeyword.objects.filter(question_id=row.question_id, keyword=keyword).first()
            if keyword_obj:
                AnswerKeywordAnalysis.objects.update_or_create(
                    answer_id=row.id,
                    question_keyword_id=keyword_obj.id,
                    defaults={
                        "keyword_snapshot": keyword,
                        "is_detected": True,
                        "confidence": None,
                        "created_at": now,
                    },
                )
        for keyword in missing:
            keyword_obj = QuestionKeyword.objects.filter(question_id=row.question_id, keyword=keyword).first()
            if keyword_obj:
                AnswerKeywordAnalysis.objects.update_or_create(
                    answer_id=row.id,
                    question_keyword_id=keyword_obj.id,
                    defaults={
                        "keyword_snapshot": keyword,
                        "is_detected": False,
                        "confidence": None,
                        "created_at": now,
                    },
                )
        total += score

    submitted_at_client = parse_iso_datetime(payload.get("submittedAt"))
    if submitted_at_client and submitted_at_client > now + timedelta(minutes=5):
        submitted_at_client = None
    submitted_at_value = submitted_at_client or now

    # Never block grading/submission if proctoring persistence fails (DB permissions, schema, etc.).
    try:
        _ensure_proctoring_tables()
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE proctoring_tab_activity
                SET returned_at = COALESCE(returned_at, %s),
                    duration_seconds = GREATEST(duration_seconds, EXTRACT(EPOCH FROM (%s - switched_at))::INT)
                WHERE attempt_id = %s AND returned_at IS NULL
                """,
                [submitted_at_value, submitted_at_value, attempt.id],
            )
    except Exception:
        pass

    attempt.status = "AUTO_GRADED"
    attempt.score = round(total, 2)
    attempt.submitted_at = submitted_at_value
    attempt.end_time = submitted_at_value
    attempt.auto_submitted = bool(payload.get("autoSubmitted", False))
    attempt.updated_at = now
    attempt.save(update_fields=["status", "score", "submitted_at", "end_time", "auto_submitted", "updated_at"])
    return JsonResponse({"saved": True, "submitted": True, "attemptId": str(attempt.id)})


@csrf_exempt
@require_http_methods(["POST"])
def student_attempt_timed_out(request, assessment_id):
    """Clock ran out while auto-submit-on-timeout is disabled: close attempt without grading."""
    auth_error = require_student_auth(request)
    if auth_error:
        return auth_error
    student_id = request.user.id
    try:
        assessment = Assessment.objects.select_related("module").get(id=assessment_id, deleted_at__isnull=True)
    except Assessment.DoesNotExist:
        return JsonResponse({"detail": "Assessment not found"}, status=404)
    if assessment.module_id not in _student_enrolled_module_ids(student_id):
        return JsonResponse({"detail": "Forbidden"}, status=403)
    if bool(assessment.auto_submit):
        return JsonResponse(
            {"detail": "This assessment is configured to auto-submit when time runs out."},
            status=409,
        )

    attempt = (
        Attempt.objects.filter(student_id=student_id, assessment_id=assessment_id)
        .select_related("assessment")
        .order_by("-attempt_number")
        .first()
    )
    if not attempt:
        return JsonResponse({"detail": "Attempt not found"}, status=404)
    if _attempt_is_timed_out(attempt):
        return JsonResponse({"saved": True, "attemptId": str(attempt.id), "status": "TIMED_OUT"})
    if not _attempt_allows_editing(attempt):
        return JsonResponse({"detail": "Attempt is not open for time expiry."}, status=409)

    _ensure_attempts_status_allows_timed_out()

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        payload = {}
    _save_attempt_answers(attempt, payload.get("answers") or {})

    now = timezone.now()
    attempt.status = "TIMED_OUT"
    attempt.end_time = now
    attempt.submitted_at = None
    attempt.auto_submitted = False
    attempt.updated_at = now
    try:
        attempt.save(update_fields=["status", "end_time", "submitted_at", "auto_submitted", "updated_at"])
    except IntegrityError:
        cache.delete(_ATTEMPTS_TIMED_OUT_CONSTRAINT_CACHE_KEY)
        _ensure_attempts_status_allows_timed_out()
        try:
            attempt.save(update_fields=["status", "end_time", "submitted_at", "auto_submitted", "updated_at"])
        except IntegrityError:
            return JsonResponse(
                {"detail": "Your attempt was not submitted.", "code": "timed_out_not_saved"},
                status=503,
            )
    return JsonResponse({"saved": True, "attemptId": str(attempt.id), "status": "TIMED_OUT"})


@require_GET
def student_history(request):
    auth_error = require_student_auth(request)
    if auth_error:
        return auth_error

    student_id = request.user.id

    attempts = list(
        Attempt.objects.filter(student_id=student_id)
        .select_related("assessment", "assessment__module")
        .order_by("-submitted_at", "-updated_at")
    )
    rows = []
    graded_percentages = []
    for attempt in attempts:
        ui_status = attempt_status(attempt.status)
        if ui_status not in {"Submitted", "Graded"}:
            continue

        max_score = sum(
            to_float(point)
            for point in AssessmentQuestion.objects.filter(
                assessment_id=attempt.assessment_id
            ).values_list("points", flat=True)
        )
        if ui_status == "Graded" and max_score > 0:
            graded_percentages.append(to_percentage(attempt.score, max_score))

        rows.append(
            {
                "submissionId": str(attempt.id),
                "assessmentId": str(attempt.assessment_id),
                "assessmentTitle": attempt.assessment.title,
                "moduleCode": attempt.assessment.module.code,
                "moduleName": attempt.assessment.module.name,
                "submittedAt": (
                    attempt.submitted_at.isoformat()
                    if attempt.submitted_at
                    else (attempt.updated_at.isoformat() if attempt.updated_at else None)
                ),
                "status": ui_status,
                "score": to_float(attempt.score) if attempt.score is not None else None,
                "maxScore": max_score,
            }
        )

    average_score = round(sum(graded_percentages) / len(graded_percentages), 1) if graded_percentages else 0
    return JsonResponse(
        {
            "rows": rows,
            "stats": {
                "totalAttempts": len(rows),
                "gradedAttempts": len([r for r in rows if r["status"] == "Graded"]),
                "averageScore": average_score,
            },
        }
    )


@require_GET
def student_results(request, assessment_id):
    auth_error = require_student_auth(request)
    if auth_error:
        return auth_error

    student_id = request.user.id

    try:
        assessment = Assessment.objects.select_related("module").get(id=assessment_id)
    except Assessment.DoesNotExist:
        return JsonResponse({"detail": "Assessment not found"}, status=404)
    if assessment.module_id not in _student_enrolled_module_ids(student_id):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    attempt = (
        Attempt.objects.filter(student_id=student_id, assessment_id=assessment_id)
        .order_by("-attempt_number")
        .first()
    )
    if not attempt:
        return JsonResponse({"detail": "Results not found"}, status=404)
    if _attempt_is_timed_out(attempt):
        return JsonResponse(
            {"detail": "No submitted results. Your attempt ended when time ran out without submission."},
            status=404,
        )

    visibility = AssessmentResultVisibility.objects.filter(assessment_id=assessment_id).first()
    if not visibility:
        visibility = AssessmentResultVisibility(
            assessment_id=assessment_id,
            show_final_score=True,
            show_score_breakdown=True,
            show_teacher_feedback=True,
            show_ai_keyword_analysis=True,
            show_per_question_details=True,
        )

    answer_rows = list(
        Answer.objects.filter(attempt_id=attempt.id)
        .select_related("question")
        .order_by("id")
    )

    feedback_by_answer = {
        item.answer_id: item
        for item in Feedback.objects.filter(answer_id__in=[a.id for a in answer_rows])
    }

    points_by_question = {
        row.question_id: to_float(row.points)
        for row in AssessmentQuestion.objects.filter(assessment_id=assessment_id)
    }
    assessment_max_score = sum(points_by_question.values())
    if assessment_max_score <= 0:
        assessment_max_score = to_float(assessment.total_points)

    answers_payload = []
    for row in answer_rows:
        feedback_item = feedback_by_answer.get(row.id)
        score = row.final_score if row.final_score is not None else row.manual_score
        if score is None:
            score = row.auto_score
        question_points = points_by_question.get(row.question_id)
        if question_points is None:
            # Keep UI stable for orphaned/misaligned rows without changing total assessment max.
            question_points = max(to_float(score), 0.0)

        inferred_correct_answer = _infer_correct_answer(
            row.question.type,
            row.text_answer,
            row.is_correct,
        )

        answers_payload.append(
            {
                "questionId": str(row.question_id),
                "questionText": row.question.content,
                "questionType": row.question.type,
                "points": question_points,
                "answer": row.text_answer or "",
                "correctAnswer": inferred_correct_answer,
                "autoScore": to_float(score),
                "teacherComment": feedback_item.teacher_comment if feedback_item else None,
            }
        )

    submission_score = to_float(attempt.score) if attempt.score is not None else None
    if submission_score is None and answers_payload:
        submission_score = round(sum(to_float(item["autoScore"]) for item in answers_payload), 2)

    feedback_text = next((a["teacherComment"] for a in answers_payload if a["teacherComment"]), None)

    return JsonResponse(
        {
            "assessment": {
                "id": str(assessment.id),
                "title": assessment.title,
                "moduleCode": assessment.module.code,
                "moduleName": assessment.module.name,
            },
            "visibility": visibility_payload(visibility),
            "submission": {
                "id": str(attempt.id),
                "status": attempt_status(attempt.status),
                "score": submission_score,
                "maxScore": assessment_max_score,
                "submittedAt": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
                "feedback": feedback_text,
                "answers": answers_payload,
            },
        }
    )
