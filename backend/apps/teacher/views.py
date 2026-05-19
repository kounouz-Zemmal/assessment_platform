import json
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta

from django.conf import settings
from django.core.cache import cache
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from django.contrib.auth.decorators import login_required, user_passes_test
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.models import User
from apps.academics.models import Module, ModuleTeacher, StudentGroup, Topic
from apps.assessments.models import (
    Answer,
    AnswerKeywordAnalysis,
    Assessment,
    AssessmentQuestion,
    AssessmentResultVisibility,
    Attempt,
    Choice,
    Feedback,
    Question,
    QuestionKeyword,
    QuestionStat,
)
from apps.assessments.lifecycle import refresh_assessment_lifecycle
from apps.common.utils import (
    assessment_status,
    attempt_status,
    build_proctor_status,
    normalize_aware_datetime,
    PROCTOR_SUSPICIOUS_THRESHOLD_SECONDS,
    proctor_cache_key,
    to_float,
    to_percentage,
    visibility_payload,
)


def is_teacher(user):
    return getattr(getattr(user, "role", None), "name", "").lower() == "teacher"


QUESTION_TYPE_TO_DB = {
    "MCQ": "MCQ",
    "SCQ": "SCQ",
    "True/False": "TRUE_FALSE",
    "Descriptive": "DESCRIPTIVE",
}
QUESTION_TYPE_FROM_DB = {value: key for key, value in QUESTION_TYPE_TO_DB.items()}
QUESTION_DIFFICULTY_TO_DB = {"Easy": "EASY", "Medium": "MEDIUM", "Hard": "HARD"}
QUESTION_DIFFICULTY_FROM_DB = {value: key for key, value in QUESTION_DIFFICULTY_TO_DB.items()}
QUESTION_STATUS_TO_DB = {
    "Draft": "DRAFT",
    "Pending Review": "PENDING_REVIEW",
    "Approved": "APPROVED",
    "Rejected": "REJECTED",
}
QUESTION_STATUS_FROM_DB = {value: key for key, value in QUESTION_STATUS_TO_DB.items()}
DIFFICULTY_DEFAULT_POINTS = {"EASY": 1.0, "MEDIUM": 2.0, "HARD": 3.0}


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


def _set_assessment_tab_switch_threshold_seconds(assessment_id: int, threshold_seconds: int):
    _ensure_proctoring_tables()
    now = timezone.now()
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO assessment_proctoring_config (
                assessment_id, tab_switch_threshold_seconds, created_at, updated_at
            ) VALUES (%s, %s, %s, %s)
            ON CONFLICT (assessment_id)
            DO UPDATE SET tab_switch_threshold_seconds = EXCLUDED.tab_switch_threshold_seconds,
                          updated_at = EXCLUDED.updated_at
            """,
            [assessment_id, max(1, int(threshold_seconds)), now, now],
        )


_FINAL_ATTEMPT_STATUSES = frozenset({"SUBMITTED", "AUTO_GRADED", "MANUALLY_GRADED", "FINALIZED"})


def _live_proctor_sort_ts(iso):
    if not iso:
        return 0.0
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.timestamp()
    except (ValueError, TypeError):
        return 0.0


def _live_row_sort_key(item):
    name = (item.get("studentName") or "").lower()
    if item.get("participationPhase") == "submitted":
        return (2, -_live_proctor_sort_ts(item.get("submittedAt")), 0, name)
    outside = int(item.get("outsideDurationSeconds") or 0)
    stale = int(item.get("staleSeconds") or 0)
    if item.get("isSuspicious"):
        return (0, -outside, -stale, name)
    return (1, -outside, -stale, name)


def _live_proctoring_rows(assessment, now):
    """
    Active attempts (green/red by tab visibility) plus students who finished during the window (blue),
    sorted: suspicious active first, then normal active, then submitted (newest submit first).
    """
    threshold_seconds = _assessment_tab_switch_threshold_seconds(assessment.id)
    in_progress_attempts = list(
        Attempt.objects.filter(assessment_id=assessment.id, status="IN_PROGRESS")
        .select_related("student")
        .order_by("-last_activity_at", "-updated_at")
    )
    in_progress_ids = {a.student_id for a in in_progress_attempts}
    rows = []
    for attempt in in_progress_attempts:
        event = cache.get(proctor_cache_key(assessment.id, attempt.student_id)) or {}
        status = build_proctor_status(event, now=now, threshold_seconds=threshold_seconds)
        suspicious = status["isSuspicious"]
        rows.append(
            {
                "attemptId": str(attempt.id),
                "studentId": str(attempt.student_id),
                "studentName": f"{attempt.student.first_name} {attempt.student.last_name}".strip(),
                "studentEmail": attempt.student.email,
                "participationPhase": "active",
                "statusColor": "red" if suspicious else "green",
                "isSuspicious": suspicious,
                "outsideDurationSeconds": status["outsideDurationSeconds"],
                "staleSeconds": status["staleSeconds"],
                "visibilityState": event.get("visibilityState") or "visible",
                "currentQuestionIndex": int(event.get("currentQuestionIndex") or 0),
                "lastSeenAt": event.get("lastSeenAt")
                or (attempt.last_activity_at.isoformat() if attempt.last_activity_at else None),
                "submittedAt": None,
            }
        )

    final_attempts = (
        Attempt.objects.filter(assessment_id=assessment.id, status__in=_FINAL_ATTEMPT_STATUSES)
        .select_related("student")
        .order_by("student_id", "-attempt_number", "-id")
    )
    seen_final = set()
    for attempt in final_attempts:
        if attempt.student_id in in_progress_ids:
            continue
        if attempt.student_id in seen_final:
            continue
        seen_final.add(attempt.student_id)
        submitted_iso = attempt.submitted_at.isoformat() if attempt.submitted_at else None
        rows.append(
            {
                "attemptId": str(attempt.id),
                "studentId": str(attempt.student_id),
                "studentName": f"{attempt.student.first_name} {attempt.student.last_name}".strip(),
                "studentEmail": attempt.student.email,
                "participationPhase": "submitted",
                "statusColor": "blue",
                "isSuspicious": False,
                "outsideDurationSeconds": 0,
                "staleSeconds": 0,
                "visibilityState": "hidden",
                "currentQuestionIndex": 0,
                "lastSeenAt": submitted_iso,
                "submittedAt": submitted_iso,
            }
        )

    rows.sort(key=_live_row_sort_key)
    return threshold_seconds, rows, len(in_progress_attempts), len(seen_final)


def _submission_status_label(attempt):
    if not attempt:
        return "Not Started"
    normalized = (attempt.status or "").upper()
    if normalized == "IN_PROGRESS":
        return "In Progress"
    if normalized == "TIMED_OUT":
        return "Not submitted"
    if normalized in {"AUTO_GRADED", "MANUALLY_GRADED", "FINALIZED"}:
        return "Graded"
    if normalized == "SUBMITTED":
        return "Submitted"
    if normalized in {"DRAFT", ""}:
        return "Not Started"
    return attempt_status(normalized)


def _submission_status_label_for_assessment(attempt, assessment):
    """
    Submissions list: IN_PROGRESS after the student-facing deadline with auto-submit off
    is shown as Not submitted (matches TIMED_OUT semantics when the client recorded it).
    """
    if not attempt or not assessment:
        return _submission_status_label(attempt)
    normalized = (attempt.status or "").upper()
    if normalized == "IN_PROGRESS" and not bool(getattr(assessment, "auto_submit", True)):
        deadline = _assessment_resolved_end_time(assessment)
        if deadline is not None:
            deadline = normalize_aware_datetime(deadline)
            if deadline is not None and timezone.now() >= deadline:
                return "Not submitted"
    return _submission_status_label(attempt)


def _attempt_submission_mode_label(attempt):
    """Mode column only for real hand-ins, not in-progress or timed-out rows."""
    if not attempt:
        return None
    st = (attempt.status or "").upper()
    if st not in {"SUBMITTED", "AUTO_GRADED", "MANUALLY_GRADED", "FINALIZED"}:
        return None
    return "auto-submitted" if bool(getattr(attempt, "auto_submitted", False)) else "submitted"


def _teacher_module_ids(teacher_id):
    return list(
        ModuleTeacher.objects.filter(user_id=teacher_id).values_list("module_id", flat=True)
    )


def _teacher_visible_questions_queryset(teacher_id):
    module_ids = _teacher_module_ids(teacher_id)
    return (
        Question.objects.filter(Q(created_by_id=teacher_id) | Q(module_id__in=module_ids))
        .filter(deleted_at__isnull=True)
        .select_related("module")
    )


def _parse_int(value, default_value):
    try:
        parsed = int(value)
        if parsed <= 0:
            return default_value
        return parsed
    except (TypeError, ValueError):
        return default_value


ASSESSMENT_STATUS_TO_DB = {
    "Draft": "DRAFT",
    "Scheduled": "SCHEDULED",
    "Active": "ACTIVE",
    "Closed": "CLOSED",
    "Published": "PUBLISHED",
}


def _is_lecturer_for_module(teacher_id, module_id):
    assignment = ModuleTeacher.objects.filter(user_id=teacher_id, module_id=module_id).first()
    if not assignment:
        return False
    normalized = (assignment.role_in_module or "").replace("_", " ").strip().lower()
    return normalized == "lecturer"


def _assessment_resolved_end_time(assessment):
    """
    Earliest of: scheduled end_time, or start + duration. Matches student timer deadline logic
    so teacher lists (Upcoming/Passed) align with the real window students see.
    """
    start = normalize_aware_datetime(assessment.start_time) if assessment.start_time else None
    end = normalize_aware_datetime(assessment.end_time) if assessment.end_time else None
    duration_mins = int(assessment.duration_minutes or 0)
    duration_end = start + timedelta(minutes=duration_mins) if start and duration_mins > 0 else None
    if end and duration_end:
        return min(end, duration_end)
    return end or duration_end


def _serialize_assessment(
    assessment,
    questions_by_assessment_id=None,
    can_modify_status=False,
):
    if questions_by_assessment_id is None:
        question_ids = list(
            AssessmentQuestion.objects.filter(assessment_id=assessment.id)
            .order_by("sort_order", "id")
            .values_list("question_id", flat=True)
        )
    else:
        question_ids = questions_by_assessment_id.get(assessment.id, [])

    resolved_end = _assessment_resolved_end_time(assessment)
    return {
        "id": str(assessment.id),
        "title": assessment.title,
        "moduleId": str(assessment.module_id),
        "moduleCode": assessment.module.code if getattr(assessment, "module", None) else None,
        "duration": int(assessment.duration_minutes or 0),
        "startTime": assessment.start_time.isoformat() if assessment.start_time else None,
        "endTime": assessment.end_time.isoformat() if assessment.end_time else None,
        "resolvedEndTime": resolved_end.isoformat() if resolved_end else None,
        "status": assessment_status(assessment.status),
        "questions": [str(question_id) for question_id in question_ids],
        "randomize": bool(assessment.shuffle_questions),
        "instructions": assessment.instructions or "",
        "shuffleAnswers": bool(assessment.shuffle_choices),
        "autoSubmitOnTimeout": bool(assessment.auto_submit),
        "tabSwitchWarning": bool(assessment.tab_warning),
        "tabSwitchThresholdSeconds": _assessment_tab_switch_threshold_seconds(assessment.id),
        "createdBy": str(assessment.created_by_id),
        "createdAt": assessment.created_at.isoformat() if assessment.created_at else None,
        "canModifyStatus": bool(can_modify_status),
    }


def _validate_assessment_payload(payload, teacher_id):
    errors = {}
    module_id = payload.get("moduleId")
    title = (payload.get("title") or "").strip()
    question_ids_raw = payload.get("selectedQuestions") or payload.get("questions") or []
    selected_topic_ids_raw = payload.get("selectedTopicIds") or []
    instructions = (payload.get("instructions") or "").strip()
    duration = payload.get("duration")
    start_time = payload.get("startTime")
    end_time = payload.get("endTime")
    randomize = bool(payload.get("randomize", False))
    shuffle_answers = bool(payload.get("shuffleAnswers", True))
    auto_submit_on_timeout = bool(payload.get("autoSubmitOnTimeout", True))
    tab_switch_warning = bool(payload.get("tabSwitchWarning", False))
    tab_switch_threshold_seconds = _parse_int(payload.get("tabSwitchThresholdSeconds"), PROCTOR_SUSPICIOUS_THRESHOLD_SECONDS)

    if not title:
        errors["title"] = "Title is required."

    try:
        module_id_int = int(module_id)
    except (TypeError, ValueError):
        module_id_int = None
        errors["moduleId"] = "Valid moduleId is required."

    teacher_module_ids = _teacher_module_ids(teacher_id)
    if module_id_int and module_id_int not in teacher_module_ids:
        errors["moduleId"] = "You can only create assessments for assigned modules."

    try:
        duration_int = int(duration)
        if duration_int <= 0:
            raise ValueError
    except (TypeError, ValueError):
        duration_int = 0
        errors["duration"] = "Duration must be a positive integer."

    question_ids = []
    try:
        question_ids = [int(question_id) for question_id in question_ids_raw]
    except (TypeError, ValueError):
        errors["questions"] = "Questions are invalid."
    selected_topic_ids = []
    try:
        selected_topic_ids = [int(topic_id) for topic_id in selected_topic_ids_raw]
    except (TypeError, ValueError):
        errors["selectedTopicIds"] = "Topics are invalid."

    start_dt = None
    end_dt = None
    if start_time:
        try:
            start_dt = timezone.datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        except ValueError:
            errors["startTime"] = "Invalid start time format."
    if end_time:
        try:
            end_dt = timezone.datetime.fromisoformat(end_time.replace("Z", "+00:00"))
        except ValueError:
            errors["endTime"] = "Invalid end time format."
    if start_dt and timezone.is_naive(start_dt):
        start_dt = timezone.make_aware(start_dt, timezone.get_current_timezone())
    if end_dt and timezone.is_naive(end_dt):
        end_dt = timezone.make_aware(end_dt, timezone.get_current_timezone())
    if start_dt and end_dt and end_dt <= start_dt:
        errors["endTime"] = "End time must be after start time."

    valid_questions = []
    if module_id_int:
        if selected_topic_ids:
            valid_topic_ids = set(
                Topic.objects.filter(id__in=selected_topic_ids, module_id=module_id_int).values_list("id", flat=True)
            )
            if len(valid_topic_ids) != len(set(selected_topic_ids)):
                errors["selectedTopicIds"] = "All selected topics must belong to the selected module."
        else:
            valid_topic_ids = set()

        query = Question.objects.filter(module_id=module_id_int, deleted_at__isnull=True)
        if question_ids and valid_topic_ids:
            query = query.filter(Q(id__in=question_ids) | Q(topic_id__in=list(valid_topic_ids)))
        elif question_ids:
            query = query.filter(id__in=question_ids)
        elif valid_topic_ids:
            query = query.filter(topic_id__in=list(valid_topic_ids))
        else:
            errors["questions"] = "Select at least one question or topic."
        valid_questions = list(query)
        if question_ids and len(valid_questions) != len(set(question_ids)):
            errors["questions"] = "All selected questions must belong to the selected module."

    total_points = sum(to_float(question.default_points) for question in valid_questions)

    return {
        "errors": errors,
        "title": title,
        "module_id": module_id_int,
        "duration": duration_int,
        "question_ids": question_ids if question_ids else [q.id for q in valid_questions],
        "start_time": start_dt,
        "end_time": end_dt,
        "instructions": instructions,
        "randomize": randomize,
        "shuffle_answers": shuffle_answers,
        "auto_submit_on_timeout": auto_submit_on_timeout,
        "tab_switch_warning": tab_switch_warning,
        "tab_switch_threshold_seconds": max(1, tab_switch_threshold_seconds),
        "total_points": total_points,
    }


def _serialize_question(question, choices_by_question_id, keywords_by_question_id, topics_by_id):
    raw_type = (question.type or "").upper()
    question_type = QUESTION_TYPE_FROM_DB.get(raw_type, "MCQ")
    choices = choices_by_question_id.get(question.id, [])
    options = [choice.content for choice in choices]
    correct_options = [choice.content for choice in choices if choice.is_correct]
    if question_type in {"SCQ", "True/False"}:
        correct_answer = correct_options[0] if correct_options else ""
    else:
        correct_answer = correct_options

    keywords_payload = [
        {"text": keyword.keyword, "weight": to_float(keyword.weight), "synonyms": []}
        for keyword in keywords_by_question_id.get(question.id, [])
    ]
    topic = topics_by_id.get(question.topic_id) if question.topic_id else None

    return {
        "id": str(question.id),
        "moduleId": str(question.module_id),
        "moduleCode": question.module.code,
        "moduleName": question.module.name,
        "topicId": str(question.topic_id) if question.topic_id else "",
        "topicName": topic.name if topic else "",
        "type": question_type,
        "difficulty": QUESTION_DIFFICULTY_FROM_DB.get((getattr(question, "difficulty", "") or "").upper(), "Medium"),
        "status": QUESTION_STATUS_FROM_DB.get((getattr(question, "status", "") or "").upper(), "Draft"),
        "text": question.content,
        "points": to_float(question.default_points),
        "options": options,
        "correctAnswer": correct_answer,
        "referenceAnswer": question.explanation or "",
        "keywords": keywords_payload,
        "createdBy": str(question.created_by_id),
        "createdAt": question.created_at.isoformat() if question.created_at else None,
    }


@login_required
@user_passes_test(is_teacher)
@require_GET
def teacher_profile(request):
    teacher_id = request.user.id

    try:
        user = User.objects.select_related("role").get(id=teacher_id)
    except User.DoesNotExist:
        return JsonResponse({"detail": "Teacher not found"}, status=404)

    assignments = (
        ModuleTeacher.objects.filter(user_id=teacher_id)
        .select_related("module")
        .order_by("module__code", "id")
    )

    payload = {
        "user": {
            "id": str(user.id),
            "firstName": user.first_name,
            "lastName": user.last_name,
            "name": f"{user.first_name} {user.last_name}".strip(),
            "email": user.email,
            "role": (user.role.name or "").lower(),
            "status": "active" if user.is_active else "inactive",
            "createdAt": user.created_at.isoformat(),
        },
        "teacherAssignments": [
            {
                "id": str(assignment.id),
                "moduleCode": assignment.module.code or "N/A",
                "moduleName": assignment.module.name,
                "teachingRole": assignment.role_in_module.replace("_", " ").title(),
            }
            for assignment in assignments
        ],
    }
    return JsonResponse(payload)


@login_required
@user_passes_test(is_teacher)
@require_GET
def teacher_result_visibility_list(request):
    teacher_id = request.user.id

    module_ids = list(
        ModuleTeacher.objects.filter(user_id=teacher_id).values_list("module_id", flat=True)
    )

    assessments = (
        Assessment.objects.filter(Q(created_by_id=teacher_id) | Q(module_id__in=module_ids))
        .select_related("module")
        .order_by("-created_at")
    )

    visibility_by_assessment = {
        v.assessment_id: v
        for v in AssessmentResultVisibility.objects.filter(
            assessment_id__in=[a.id for a in assessments]
        )
    }

    data = []
    for assessment in assessments:
        visibility = visibility_by_assessment.get(assessment.id)
        if not visibility:
            visibility = AssessmentResultVisibility(
                assessment_id=assessment.id,
                show_final_score=True,
                show_score_breakdown=True,
                show_teacher_feedback=True,
                show_ai_keyword_analysis=True,
                show_per_question_details=True,
            )

        data.append(
            {
                "id": str(assessment.id),
                "title": assessment.title,
                "moduleId": str(assessment.module_id),
                "moduleCode": assessment.module.code,
                "moduleName": assessment.module.name,
                "status": assessment_status(assessment.status),
                "resultsVisibility": visibility_payload(visibility),
            }
        )

    return JsonResponse({"assessments": data})


@csrf_exempt
@login_required
@user_passes_test(is_teacher)
@require_http_methods(["PATCH"])
def teacher_result_visibility_update(request, assessment_id):
    teacher_id = request.user.id

    try:
        assessment = Assessment.objects.select_related("module").get(id=assessment_id)
    except Assessment.DoesNotExist:
        return JsonResponse({"detail": "Assessment not found"}, status=404)

    is_owner = assessment.created_by_id == teacher_id
    is_assigned = ModuleTeacher.objects.filter(
        user_id=teacher_id, module_id=assessment.module_id
    ).exists()
    if not (is_owner or is_assigned):
        return JsonResponse({"detail": "Not allowed for this assessment"}, status=403)

    try:
        body = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"detail": "Invalid JSON body"}, status=400)

    defaults = {
        "show_final_score": bool(body.get("showFinalScore", True)),
        "show_score_breakdown": bool(body.get("showScoreBreakdown", True)),
        "show_teacher_feedback": bool(body.get("showTeacherFeedback", True)),
        "show_ai_keyword_analysis": bool(body.get("showAiKeywordAnalysis", True)),
        "show_per_question_details": bool(body.get("showPerQuestionDetails", True)),
    }

    visibility, _ = AssessmentResultVisibility.objects.update_or_create(
        assessment_id=assessment.id,
        defaults=defaults,
    )

    return JsonResponse(
        {
            "assessment": {
                "id": str(assessment.id),
                "title": assessment.title,
                "moduleId": str(assessment.module_id),
                "moduleCode": assessment.module.code,
                "moduleName": assessment.module.name,
                "status": assessment_status(assessment.status),
                "resultsVisibility": visibility_payload(visibility),
            }
        }
    )


@login_required
@user_passes_test(is_teacher)
@require_GET
def teacher_analytics(request):
    teacher_id = request.user.id

    module_ids = list(
        ModuleTeacher.objects.filter(user_id=teacher_id).values_list("module_id", flat=True)
    )
    assessments = list(
        Assessment.objects.filter(Q(created_by_id=teacher_id) | Q(module_id__in=module_ids))
        .select_related("module")
        .order_by("-created_at")
    )

    if not assessments:
        return JsonResponse(
            {
                "authorizedAssessments": [],
                "selectedAssessmentId": None,
                "summary": {
                    "totalSubmissions": 0,
                    "passedStudents": 0,
                    "failedStudents": 0,
                    "averageScore": 0,
                    "passRate": 0,
                },
                "scoreDistribution": [],
                "questionMetrics": [],
                "difficultyBreakdown": [],
            }
        )

    selected_id = request.GET.get("assessment_id")
    selected = None
    if selected_id:
        for assessment in assessments:
            if str(assessment.id) == str(selected_id):
                selected = assessment
                break
    if selected is None:
        selected = assessments[0]

    attempts = list(Attempt.objects.filter(assessment_id=selected.id).order_by("id"))
    finalized = [
        a
        for a in attempts
        if a.status in {"SUBMITTED", "AUTO_GRADED", "MANUALLY_GRADED", "FINALIZED"}
    ]

    assessment_question_rows = list(
        AssessmentQuestion.objects.filter(assessment_id=selected.id)
        .select_related("question")
        .order_by("sort_order", "id")
    )
    question_ids = [row.question_id for row in assessment_question_rows]
    points_by_question = {row.question_id: to_float(row.points) for row in assessment_question_rows}

    answers = list(
        Answer.objects.filter(attempt_id__in=[a.id for a in finalized], question_id__in=question_ids)
        .values(
            "attempt_id",
            "question_id",
            "auto_score",
            "manual_score",
            "final_score",
        )
    )

    score_by_attempt_question = {}
    for answer in answers:
        score = answer["final_score"]
        if score is None:
            score = answer["manual_score"]
        if score is None:
            score = answer["auto_score"]
        score_by_attempt_question[(answer["attempt_id"], answer["question_id"])] = to_float(score)

    max_total = sum(points_by_question.values()) or 1.0
    scored = []
    for attempt in finalized:
        if question_ids:
            raw_score = sum(score_by_attempt_question.get((attempt.id, qid), 0.0) for qid in question_ids)
        else:
            raw_score = to_float(attempt.score)
        percentage = to_percentage(raw_score, max_total)
        scored.append({"score": raw_score, "percentage": percentage})

    total_submissions = len(finalized)
    passed_students = len([item for item in scored if item["percentage"] >= 50])
    failed_students = max(0, total_submissions - passed_students)
    average_score = (
        sum(item["percentage"] for item in scored) / total_submissions if total_submissions else 0
    )
    pass_rate = (passed_students / total_submissions * 100) if total_submissions else 0

    buckets = [
        ("0-20", 0, 20),
        ("21-40", 21, 40),
        ("41-60", 41, 60),
        ("61-80", 61, 80),
        ("81-100", 81, 100),
    ]
    score_distribution = []
    for label, low, high in buckets:
        count = len([item for item in scored if low <= item["percentage"] <= high])
        score_distribution.append({"range": label, "count": count})

    question_stat_rows = {
        row.question_id: row for row in QuestionStat.objects.filter(question_id__in=question_ids)
    }

    question_metrics = []
    difficulty_counter = defaultdict(int)
    for index, row in enumerate(assessment_question_rows, start=1):
        stat = question_stat_rows.get(row.question_id)
        if stat:
            attempt_count = int(stat.attempt_count)
            avg_q_score = to_float(stat.avg_score)
            success_rate = to_float(stat.success_rate)
        else:
            per_question_scores = [
                score_by_attempt_question.get((attempt.id, row.question_id), 0.0)
                for attempt in finalized
                if (attempt.id, row.question_id) in score_by_attempt_question
            ]
            attempt_count = len(per_question_scores)
            avg_q_score = sum(per_question_scores) / attempt_count if attempt_count else 0
            point_value = to_float(row.points) or 1.0
            success_rate = (
                len([s for s in per_question_scores if s >= point_value * 0.6]) / attempt_count * 100
                if attempt_count
                else 0
            )

        if success_rate >= 70:
            difficulty = "Easy"
        elif success_rate >= 40:
            difficulty = "Medium"
        else:
            difficulty = "Hard"
        difficulty_counter[difficulty] += 1

        question_metrics.append(
            {
                "questionId": str(row.question_id),
                "label": f"Q{index}",
                "attemptCount": attempt_count,
                "averageScore": round(avg_q_score, 2),
                "successRate": round(success_rate, 2),
                "correctCount": round((success_rate / 100.0) * attempt_count),
                "maxPoints": to_float(row.points),
                "difficulty": difficulty,
            }
        )

    payload = {
        "authorizedAssessments": [
            {
                "id": str(assessment.id),
                "title": assessment.title,
                "moduleId": str(assessment.module_id),
                "moduleCode": assessment.module.code,
                "status": assessment_status(assessment.status),
            }
            for assessment in assessments
        ],
        "selectedAssessmentId": str(selected.id),
        "selectedAssessment": {
            "id": str(selected.id),
            "title": selected.title,
            "moduleCode": selected.module.code,
            "moduleName": selected.module.name,
            "status": assessment_status(selected.status),
            "duration": selected.duration_minutes,
            "startTime": selected.start_time.isoformat() if selected.start_time else None,
            "endTime": selected.end_time.isoformat() if selected.end_time else None,
        },
        "summary": {
            "totalSubmissions": total_submissions,
            "passedStudents": passed_students,
            "failedStudents": failed_students,
            "averageScore": round(average_score, 2),
            "passRate": round(pass_rate, 2),
        },
        "scoreDistribution": score_distribution,
        "questionMetrics": question_metrics,
        "difficultyBreakdown": [
            {"name": "Easy", "value": difficulty_counter["Easy"], "color": "#10b981"},
            {"name": "Medium", "value": difficulty_counter["Medium"], "color": "#f59e0b"},
            {"name": "Hard", "value": difficulty_counter["Hard"], "color": "#ef4444"},
        ],
    }
    return JsonResponse(payload)


@login_required
@user_passes_test(is_teacher)
@require_GET
def teacher_live_proctoring_current(request):
    teacher_id = request.user.id
    module_ids = _teacher_module_ids(teacher_id)
    now = timezone.now()

    candidate_assessments = list(
        Assessment.objects.filter(
            Q(created_by_id=teacher_id) | Q(module_id__in=module_ids),
            deleted_at__isnull=True,
        )
        .select_related("module")
        .order_by("start_time", "-created_at")
    )

    live_candidates = []
    for assessment in candidate_assessments:
        refresh_assessment_lifecycle(assessment)
        start_time = normalize_aware_datetime(assessment.start_time)
        end_time = normalize_aware_datetime(assessment.end_time)
        if not start_time or not end_time:
            continue
        if not (start_time <= now <= end_time):
            continue
        active_count = Attempt.objects.filter(assessment_id=assessment.id, status="IN_PROGRESS").count()
        in_prog_ids = Attempt.objects.filter(
            assessment_id=assessment.id, status="IN_PROGRESS"
        ).values_list("student_id", flat=True)
        submitted_distinct = (
            Attempt.objects.filter(assessment_id=assessment.id, status__in=_FINAL_ATTEMPT_STATUSES)
            .exclude(student_id__in=in_prog_ids)
            .values("student_id")
            .distinct()
            .count()
        )
        if active_count <= 0 and submitted_distinct <= 0:
            continue
        live_candidates.append((assessment, active_count, submitted_distinct, start_time))

    if not live_candidates:
        return JsonResponse(
            {
                "assessment": None,
                "thresholdSeconds": PROCTOR_SUSPICIOUS_THRESHOLD_SECONDS,
                "activeStudentsCount": 0,
                "submittedStudentsCount": 0,
                "rows": [],
            }
        )

    # Prefer the assessment with the most in-progress students, then most submitted, then earliest start.
    live_candidates.sort(key=lambda item: (-item[1], -item[2], item[3]))
    assessment, _, _, start_time = live_candidates[0]
    end_time = normalize_aware_datetime(assessment.end_time)

    threshold_seconds, rows, in_progress_count, submitted_count = _live_proctoring_rows(assessment, now)

    return JsonResponse(
        {
            "assessment": {
                "id": str(assessment.id),
                "title": assessment.title,
                "moduleCode": assessment.module.code,
                "moduleName": assessment.module.name,
                "status": assessment_status(assessment.status),
                "startTime": start_time.isoformat() if start_time else None,
                "endTime": end_time.isoformat() if end_time else None,
            },
            "thresholdSeconds": threshold_seconds,
            "activeStudentsCount": in_progress_count,
            "submittedStudentsCount": submitted_count,
            "rows": rows,
        }
    )


@login_required
@user_passes_test(is_teacher)
@require_GET
def teacher_dashboard(request):
    teacher_id = request.user.id
    module_ids = _teacher_module_ids(teacher_id)

    questions_count = Question.objects.filter(created_by_id=teacher_id, deleted_at__isnull=True).count()
    created_assessments_count = Assessment.objects.filter(
        created_by_id=teacher_id, deleted_at__isnull=True
    ).count()
    assigned_assessments_count = (
        Assessment.objects.filter(module_id__in=module_ids, deleted_at__isnull=True)
        .exclude(created_by_id=teacher_id)
        .count()
    )
    pending_grading_count = Attempt.objects.filter(
        assessment__created_by_id=teacher_id,
        status="SUBMITTED",
    ).count()
    total_submissions_count = Attempt.objects.filter(assessment__created_by_id=teacher_id).count()

    active_assessments = (
        Assessment.objects.filter(created_by_id=teacher_id, status__in=["ACTIVE", "SCHEDULED"])
        .filter(deleted_at__isnull=True)
        .select_related("module")
        .order_by("start_time", "-created_at")[:8]
    )

    now = timezone.now()
    MAX_LIVE_ASSESSMENTS = 3
    MAX_LIVE_STUDENTS_PER_ASSESSMENT = 12
    live_proctoring = []
    for assessment in active_assessments:
        refresh_assessment_lifecycle(assessment)
        start_time = normalize_aware_datetime(assessment.start_time)
        end_time = normalize_aware_datetime(assessment.end_time)
        # Show only assessments that are explicitly live inside their scheduled window.
        if not start_time or not end_time:
            continue
        is_window_open = now >= start_time and now <= end_time
        if not is_window_open:
            continue

        threshold_seconds, rows, in_progress_count, submitted_count = _live_proctoring_rows(assessment, now)
        rows = rows[:MAX_LIVE_STUDENTS_PER_ASSESSMENT]
        if not rows:
            continue
        live_proctoring.append(
            {
                "assessmentId": str(assessment.id),
                "assessmentTitle": assessment.title,
                "moduleCode": assessment.module.code,
                "activeStudentsCount": in_progress_count,
                "submittedStudentsCount": submitted_count,
                "thresholdSeconds": threshold_seconds,
                "rows": rows,
            }
        )
    live_proctoring.sort(
        key=lambda item: item.get("activeStudentsCount", 0) + item.get("submittedStudentsCount", 0),
        reverse=True,
    )
    live_proctoring = live_proctoring[:MAX_LIVE_ASSESSMENTS]

    return JsonResponse(
        {
            "stats": {
                "questionsCreated": questions_count,
                "assessmentsCreated": created_assessments_count,
                "assessmentsAssigned": assigned_assessments_count,
                "totalAssessments": created_assessments_count + assigned_assessments_count,
                "pendingGrading": pending_grading_count,
                "totalSubmissions": total_submissions_count,
            },
            "activeAssessments": [
                {
                    "id": str(assessment.id),
                    "title": assessment.title,
                    "status": assessment_status(assessment.status),
                    "duration": assessment.duration_minutes,
                    "startTime": assessment.start_time.isoformat() if assessment.start_time else None,
                    "moduleCode": assessment.module.code,
                }
                for assessment in active_assessments
            ],
            "liveProctoring": live_proctoring,
        }
    )


@login_required
@user_passes_test(is_teacher)
@require_GET
def teacher_assessment_live_proctoring(request, assessment_id):
    teacher_id = request.user.id
    module_ids = _teacher_module_ids(teacher_id)
    try:
        assessment = Assessment.objects.select_related("module").get(id=assessment_id, deleted_at__isnull=True)
    except Assessment.DoesNotExist:
        return JsonResponse({"detail": "Assessment not found"}, status=404)

    if assessment.module_id not in module_ids and assessment.created_by_id != teacher_id:
        return JsonResponse({"detail": "Not allowed for this assessment"}, status=403)

    now = timezone.now()
    start_time = normalize_aware_datetime(assessment.start_time)
    end_time = normalize_aware_datetime(assessment.end_time)
    is_window_open = (start_time is None or now >= start_time) and (end_time is None or now <= end_time)

    threshold_seconds, rows, in_progress_count, submitted_count = _live_proctoring_rows(assessment, now)

    return JsonResponse(
        {
            "assessment": {
                "id": str(assessment.id),
                "title": assessment.title,
                "moduleCode": assessment.module.code,
                "moduleName": assessment.module.name,
                "status": assessment_status(assessment.status),
                "startTime": start_time.isoformat() if start_time else None,
                "endTime": end_time.isoformat() if end_time else None,
                "isWindowOpen": is_window_open,
            },
            "thresholdSeconds": threshold_seconds,
            "activeStudentsCount": in_progress_count,
            "submittedStudentsCount": submitted_count,
            "rows": rows,
        }
    )


@login_required
@user_passes_test(is_teacher)
@require_GET
def teacher_modules(request):
    teacher_id = request.user.id
    assignments = (
        ModuleTeacher.objects.filter(user_id=teacher_id)
        .select_related("module")
        .order_by("module__code", "id")
    )
    module_ids = [assignment.module_id for assignment in assignments]
    topics_by_module_id = defaultdict(list)
    for topic in Topic.objects.filter(module_id__in=module_ids, is_active=True).order_by("name", "id"):
        topics_by_module_id[topic.module_id].append(
            {"id": str(topic.id), "name": topic.name, "moduleId": str(topic.module_id)}
        )

    return JsonResponse(
        {
            "modules": [
                {
                    "id": str(assignment.module.id),
                    "code": assignment.module.code,
                    "name": assignment.module.name,
                    "description": assignment.module.description or "",
                    "teachingRole": assignment.role_in_module.replace("_", " ").title(),
                    "topics": topics_by_module_id.get(assignment.module_id, []),
                }
                for assignment in assignments
            ]
        }
    )


@csrf_exempt
@login_required
@user_passes_test(is_teacher)
@require_http_methods(["POST"])
def teacher_create_topic(request):
    teacher_id = request.user.id
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"detail": "Invalid JSON body"}, status=400)

    module_id = payload.get("moduleId")
    name = (payload.get("name") or "").strip()
    description = (payload.get("description") or "").strip()
    if not module_id:
        return JsonResponse({"detail": "moduleId is required"}, status=400)
    if not name:
        return JsonResponse({"detail": "Topic name is required"}, status=400)

    try:
        module_id_int = int(module_id)
    except (TypeError, ValueError):
        return JsonResponse({"detail": "Invalid moduleId"}, status=400)

    if module_id_int not in _teacher_module_ids(teacher_id):
        return JsonResponse({"detail": "You can only create topics in assigned modules"}, status=403)

    if not Module.objects.filter(id=module_id_int, is_active=True, deleted_at__isnull=True).exists():
        return JsonResponse({"detail": "Module not found"}, status=404)

    now = timezone.now()
    topic = Topic.objects.create(
        name=name,
        module_id=module_id_int,
        description=description or None,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    return JsonResponse(
        {
            "topic": {
                "id": str(topic.id),
                "name": topic.name,
                "moduleId": str(topic.module_id),
                "description": topic.description or "",
            }
        },
        status=201,
    )


def _validate_question_payload(payload, teacher_id, is_update=False):
    errors = {}
    module_id = payload.get("moduleId")
    text = (payload.get("text") or "").strip()
    question_type = payload.get("type")
    difficulty = payload.get("difficulty") or "Medium"
    status = payload.get("status") or "Draft"
    topic_id = payload.get("topicId")
    options = payload.get("options") or []
    correct_answer = payload.get("correctAnswer")
    reference_answer = (payload.get("referenceAnswer") or "").strip()
    keywords = payload.get("keywords") or []

    if not module_id:
        errors["moduleId"] = "Module is required."
    if not text:
        errors["text"] = "Question text is required."

    if question_type not in QUESTION_TYPE_TO_DB:
        errors["type"] = "Invalid question type."
    if difficulty not in QUESTION_DIFFICULTY_TO_DB:
        errors["difficulty"] = "Invalid difficulty."
    if status not in QUESTION_STATUS_TO_DB:
        errors["status"] = "Invalid status."

    teacher_module_ids = _teacher_module_ids(teacher_id)
    try:
        module_id_int = int(module_id)
    except (TypeError, ValueError):
        errors["moduleId"] = "Module is invalid."
        module_id_int = None
    if module_id_int and module_id_int not in teacher_module_ids:
        errors["moduleId"] = "You can only use modules assigned to you."

    topic_id_int = None
    if topic_id not in ("", None):
        try:
            topic_id_int = int(topic_id)
        except (TypeError, ValueError):
            errors["topicId"] = "Topic is invalid."
        if topic_id_int and not Topic.objects.filter(id=topic_id_int, module_id=module_id_int).exists():
            errors["topicId"] = "Topic must belong to selected module."

    normalized_keywords = []
    if question_type == "Descriptive":
        if not reference_answer:
            errors["referenceAnswer"] = "Reference answer is required for descriptive questions."
        if not keywords:
            errors["keywords"] = "At least one keyword is required."
        for keyword in keywords:
            text_value = (keyword.get("text") or "").strip()
            if not text_value:
                continue
            try:
                weight = float(keyword.get("weight", 1))
            except (TypeError, ValueError):
                weight = 1
            normalized_keywords.append({"text": text_value, "weight": max(0.1, weight)})
    else:
        reference_answer = ""
        normalized_keywords = []

    normalized_options = []
    normalized_correct_options = []
    if question_type in {"MCQ", "SCQ"}:
        normalized_options = [str(option).strip() for option in options if str(option).strip()]
        if len(normalized_options) < 2:
            errors["options"] = "At least two options are required."
        if question_type == "SCQ":
            if not isinstance(correct_answer, str) or not correct_answer.strip():
                errors["correctAnswer"] = "A correct answer is required."
            else:
                normalized_correct_options = [correct_answer.strip()]
        else:
            if isinstance(correct_answer, list):
                normalized_correct_options = [str(item).strip() for item in correct_answer if str(item).strip()]
            elif isinstance(correct_answer, str) and correct_answer.strip():
                normalized_correct_options = [correct_answer.strip()]
            if not normalized_correct_options:
                errors["correctAnswer"] = "At least one correct answer is required."
        for answer in normalized_correct_options:
            if answer not in normalized_options:
                errors["correctAnswer"] = "Correct answer must match one of the options."
                break
    elif question_type == "True/False":
        normalized_options = ["True", "False"]
        if str(correct_answer) not in {"True", "False"}:
            errors["correctAnswer"] = "Correct answer must be True or False."
        else:
            normalized_correct_options = [str(correct_answer)]

    return {
        "errors": errors,
        "module_id": module_id_int,
        "topic_id": topic_id_int,
        "text": text,
        "question_type": question_type,
        "db_question_type": QUESTION_TYPE_TO_DB.get(question_type, "MCQ"),
        "db_difficulty": QUESTION_DIFFICULTY_TO_DB.get(difficulty, "MEDIUM"),
        "db_status": QUESTION_STATUS_TO_DB.get(status, "DRAFT"),
        "points": DIFFICULTY_DEFAULT_POINTS.get(
            QUESTION_DIFFICULTY_TO_DB.get(difficulty, "MEDIUM"), 2.0
        ),
        "reference_answer": reference_answer,
        "options": normalized_options,
        "correct_options": normalized_correct_options,
        "keywords": normalized_keywords,
    }


@login_required
@user_passes_test(is_teacher)
@require_http_methods(["GET", "POST"])
def teacher_questions(request):
    teacher_id = request.user.id
    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return JsonResponse({"detail": "Invalid JSON body"}, status=400)

        parsed = _validate_question_payload(payload, teacher_id)
        if parsed["errors"]:
            return JsonResponse({"detail": "Validation failed", "errors": parsed["errors"]}, status=400)

        now = timezone.now()
        question = Question.objects.create(
            content=parsed["text"],
            type=parsed["db_question_type"],
            difficulty=parsed["db_difficulty"],
            module_id=parsed["module_id"],
            topic_id=parsed["topic_id"],
            created_by_id=teacher_id,
            status=parsed["db_status"],
            explanation=parsed["reference_answer"],
            default_points=parsed["points"],
            approved_by_id=teacher_id if parsed["db_status"] == "APPROVED" else None,
            approved_at=now if parsed["db_status"] == "APPROVED" else None,
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
        Choice.objects.filter(question_id=question.id).delete()
        for index, option in enumerate(parsed["options"], start=1):
            Choice.objects.create(
                question_id=question.id,
                content=option,
                is_correct=option in parsed["correct_options"],
                sort_order=index,
                created_at=now,
                updated_at=now,
            )
        QuestionKeyword.objects.filter(question_id=question.id).delete()
        for keyword in parsed["keywords"]:
            QuestionKeyword.objects.create(
                question_id=question.id,
                keyword=keyword["text"],
                weight=keyword["weight"],
                is_active=True,
                created_at=now,
                updated_at=now,
            )
            for synonym in payload.get("keywords", []):
                if synonym.get("text") == keyword["text"]:
                    for item in synonym.get("synonyms", []):
                        synonym_value = str(item).strip()
                        if synonym_value:
                            QuestionKeyword.objects.create(
                                question_id=question.id,
                                keyword=synonym_value,
                                weight=keyword["weight"],
                                is_active=True,
                                created_at=now,
                                updated_at=now,
                            )

        return JsonResponse({"question": {"id": str(question.id)}}, status=201)

    query = _teacher_visible_questions_queryset(teacher_id)
    module_id = request.GET.get("module_id")
    topic_id = request.GET.get("topic_id")
    question_type = request.GET.get("type")
    search = (request.GET.get("search") or "").strip()
    sort = (request.GET.get("sort") or "newest").strip()
    page = _parse_int(request.GET.get("page"), 1)
    page_size = min(_parse_int(request.GET.get("page_size"), 20), 100)

    if module_id:
        query = query.filter(module_id=module_id)
    if topic_id:
        query = query.filter(topic_id=topic_id)
    if question_type in QUESTION_TYPE_TO_DB:
        query = query.filter(type=QUESTION_TYPE_TO_DB[question_type])
    if search:
        query = query.filter(content__icontains=search)

    if sort == "alphabetical_asc":
        query = query.order_by("content", "-id")
    elif sort == "alphabetical_desc":
        query = query.order_by("-content", "-id")
    elif sort == "year_asc":
        query = query.order_by("created_at", "id")
    elif sort == "year_desc":
        query = query.order_by("-created_at", "-id")
    else:
        query = query.order_by("-created_at", "-id")

    total = query.count()
    offset = (page - 1) * page_size
    items = list(query[offset : offset + page_size])
    question_ids = [item.id for item in items]
    choices = list(Choice.objects.filter(question_id__in=question_ids).order_by("sort_order", "id"))
    keywords = list(
        QuestionKeyword.objects.filter(question_id__in=question_ids, is_active=True).order_by("id")
    )
    topics_by_id = {topic.id: topic for topic in Topic.objects.filter(id__in=[q.topic_id for q in items if q.topic_id])}
    choices_by_question_id = defaultdict(list)
    keywords_by_question_id = defaultdict(list)
    for choice in choices:
        choices_by_question_id[choice.question_id].append(choice)
    for keyword in keywords:
        keywords_by_question_id[keyword.question_id].append(keyword)

    return JsonResponse(
        {
            "questions": [
                _serialize_question(question, choices_by_question_id, keywords_by_question_id, topics_by_id)
                for question in items
            ],
            "pagination": {
                "page": page,
                "pageSize": page_size,
                "total": total,
                "totalPages": (total + page_size - 1) // page_size,
            },
        }
    )


@csrf_exempt
@login_required
@user_passes_test(is_teacher)
@require_http_methods(["GET", "POST"])
def teacher_assessments(request):
    teacher_id = request.user.id
    module_ids = _teacher_module_ids(teacher_id)

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return JsonResponse({"detail": "Invalid JSON body"}, status=400)

        parsed = _validate_assessment_payload(payload, teacher_id)
        if parsed["errors"]:
            return JsonResponse({"detail": "Validation failed", "errors": parsed["errors"]}, status=400)

        now = timezone.now()
        initial_status = (
            ASSESSMENT_STATUS_TO_DB["Scheduled"]
            if parsed["start_time"]
            else ASSESSMENT_STATUS_TO_DB["Draft"]
        )
        with transaction.atomic():
            assessment = Assessment.objects.create(
                title=parsed["title"],
                description=parsed["instructions"] or None,
                instructions=parsed["instructions"] or None,
                module_id=parsed["module_id"],
                created_by_id=teacher_id,
                duration_minutes=parsed["duration"],
                start_time=parsed["start_time"],
                end_time=parsed["end_time"],
                status=initial_status,
                shuffle_questions=parsed["randomize"],
                shuffle_choices=parsed["shuffle_answers"],
                auto_submit=parsed["auto_submit_on_timeout"],
                tab_warning=parsed["tab_switch_warning"],
                max_attempts=1,
                show_result_immediately=False,
                allow_review=True,
                access_code=None,
                total_points=parsed["total_points"],
                created_at=now,
                updated_at=now,
                deleted_at=None,
            )
            _set_assessment_tab_switch_threshold_seconds(
                assessment.id,
                parsed["tab_switch_threshold_seconds"],
            )

            refresh_assessment_lifecycle(assessment)

            question_map = {
                question.id: question
                for question in Question.objects.filter(id__in=parsed["question_ids"], deleted_at__isnull=True)
            }
            for index, question_id in enumerate(parsed["question_ids"], start=1):
                question = question_map.get(question_id)
                if not question:
                    continue
                AssessmentQuestion.objects.create(
                    assessment_id=assessment.id,
                    question_id=question_id,
                    points=question.default_points,
                    sort_order=index,
                    created_at=now,
                    updated_at=now,
                )

        can_modify_status = _is_lecturer_for_module(teacher_id, assessment.module_id)
        return JsonResponse(
            {"assessment": _serialize_assessment(assessment, can_modify_status=can_modify_status)},
            status=201,
        )

    assessments = list(
        Assessment.objects.filter(Q(created_by_id=teacher_id) | Q(module_id__in=module_ids), deleted_at__isnull=True)
        .select_related("module")
        .order_by("-created_at")
    )
    rows = list(
        AssessmentQuestion.objects.filter(assessment_id__in=[assessment.id for assessment in assessments])
        .order_by("sort_order", "id")
        .values("assessment_id", "question_id")
    )
    questions_by_assessment_id = defaultdict(list)
    for row in rows:
        questions_by_assessment_id[row["assessment_id"]].append(row["question_id"])

    for assessment in assessments:
        refresh_assessment_lifecycle(assessment)

    return JsonResponse(
        {
            "assessments": [
                _serialize_assessment(
                    assessment,
                    questions_by_assessment_id,
                    can_modify_status=_is_lecturer_for_module(teacher_id, assessment.module_id),
                )
                for assessment in assessments
            ]
        }
    )


@csrf_exempt
@login_required
@user_passes_test(is_teacher)
@require_http_methods(["GET", "PATCH"])
def teacher_assessment_detail(request, assessment_id):
    teacher_id = request.user.id
    module_ids = _teacher_module_ids(teacher_id)
    try:
        assessment = Assessment.objects.select_related("module").get(id=assessment_id, deleted_at__isnull=True)
    except Assessment.DoesNotExist:
        return JsonResponse({"detail": "Assessment not found"}, status=404)

    if not (assessment.created_by_id == teacher_id or assessment.module_id in module_ids):
        return JsonResponse({"detail": "Not allowed for this assessment"}, status=403)

    refresh_assessment_lifecycle(assessment)

    if request.method == "GET":
        return JsonResponse(
            {
                "assessment": _serialize_assessment(
                    assessment,
                    can_modify_status=_is_lecturer_for_module(teacher_id, assessment.module_id),
                )
            }
        )

    if assessment.created_by_id != teacher_id:
        return JsonResponse({"detail": "Only the creator can edit this assessment"}, status=403)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"detail": "Invalid JSON body"}, status=400)

    parsed = _validate_assessment_payload(payload, teacher_id)
    if parsed["errors"]:
        return JsonResponse({"detail": "Validation failed", "errors": parsed["errors"]}, status=400)

    now = timezone.now()
    assessment.title = parsed["title"]
    assessment.description = parsed["instructions"] or None
    assessment.instructions = parsed["instructions"] or None
    assessment.module_id = parsed["module_id"]
    assessment.duration_minutes = parsed["duration"]
    assessment.start_time = parsed["start_time"]
    assessment.end_time = parsed["end_time"]
    assessment.shuffle_questions = parsed["randomize"]
    assessment.shuffle_choices = parsed["shuffle_answers"]
    assessment.auto_submit = parsed["auto_submit_on_timeout"]
    assessment.tab_warning = parsed["tab_switch_warning"]
    assessment.total_points = parsed["total_points"]
    if (assessment.status or "").upper() == "DRAFT" and parsed["start_time"]:
        assessment.status = ASSESSMENT_STATUS_TO_DB["Scheduled"]
    assessment.updated_at = now
    assessment.save()
    refresh_assessment_lifecycle(assessment)
    _set_assessment_tab_switch_threshold_seconds(
        assessment.id,
        parsed["tab_switch_threshold_seconds"],
    )

    with transaction.atomic():
        AssessmentQuestion.objects.filter(assessment_id=assessment.id).delete()
        question_map = {
            question.id: question
            for question in Question.objects.filter(id__in=parsed["question_ids"], deleted_at__isnull=True)
        }
        for index, question_id in enumerate(parsed["question_ids"], start=1):
            question = question_map.get(question_id)
            if not question:
                continue
            AssessmentQuestion.objects.create(
                assessment_id=assessment.id,
                question_id=question_id,
                points=question.default_points,
                sort_order=index,
                created_at=now,
                updated_at=now,
            )

    return JsonResponse(
        {
            "assessment": _serialize_assessment(
                assessment,
                can_modify_status=_is_lecturer_for_module(teacher_id, assessment.module_id),
            )
        }
    )


@csrf_exempt
@login_required
@user_passes_test(is_teacher)
@require_http_methods(["PATCH"])
def teacher_assessment_status_update(request, assessment_id):
    teacher_id = request.user.id
    try:
        assessment = Assessment.objects.get(id=assessment_id, deleted_at__isnull=True)
    except Assessment.DoesNotExist:
        return JsonResponse({"detail": "Assessment not found"}, status=404)

    if not _is_lecturer_for_module(teacher_id, assessment.module_id):
        return JsonResponse({"detail": "Only the lecturer can update assessment status"}, status=403)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"detail": "Invalid JSON body"}, status=400)

    status_label = payload.get("status")
    if status_label not in {"Draft", "Scheduled", "Active", "Closed", "Published"}:
        return JsonResponse(
            {"detail": "Invalid status. Use Draft, Scheduled, Active, Closed, or Published."},
            status=400,
        )

    assessment.status = ASSESSMENT_STATUS_TO_DB[status_label]
    assessment.updated_at = timezone.now()
    assessment.save(update_fields=["status", "updated_at"])
    return JsonResponse(
        {"assessment": _serialize_assessment(assessment, can_modify_status=True)}
    )


@login_required
@user_passes_test(is_teacher)
@require_GET
def teacher_assessment_submissions(request, assessment_id):
    teacher_id = request.user.id

    try:
        assessment = Assessment.objects.select_related("module").get(
            id=assessment_id, deleted_at__isnull=True
        )
    except Assessment.DoesNotExist:
        return JsonResponse({"detail": "Assessment not found"}, status=404)

    module_ids = _teacher_module_ids(teacher_id)
    if assessment.module_id not in module_ids and assessment.created_by_id != teacher_id:
        return JsonResponse({"detail": "Not allowed for this assessment"}, status=403)

    refresh_assessment_lifecycle(assessment)
    status_upper = (assessment.status or "").upper()
    if status_upper == "DRAFT":
        return JsonResponse(
            {
                "detail": "Submissions are available after the assessment is scheduled with a start time (not while it is still a draft).",
            },
            status=409,
        )

    enrollment_rows = list(
        StudentGroup.objects.filter(group__module_id=assessment.module_id)
        .select_related("student", "group")
        .order_by("student__last_name", "student__first_name", "student_id")
    )
    student_ids = [row.student_id for row in enrollment_rows]

    latest_submission_by_student = {}
    submission_stats_by_id = {}
    if student_ids:
        try:
            placeholders = ", ".join(["%s"] * len(student_ids))
            submission_query = f"""
                SELECT id, student_id, submitted_at
                FROM submission
                WHERE assessment_id = %s
                  AND student_id IN ({placeholders})
                ORDER BY submitted_at DESC NULLS LAST, id DESC
            """
            with connection.cursor() as cursor:
                cursor.execute(submission_query, [assessment.id, *student_ids])
                for submission_id, student_id, submitted_at in cursor.fetchall():
                    if student_id not in latest_submission_by_student:
                        latest_submission_by_student[student_id] = {
                            "id": submission_id,
                            "submitted_at": submitted_at,
                        }

            submission_ids = [item["id"] for item in latest_submission_by_student.values()]
            if submission_ids:
                stat_placeholders = ", ".join(["%s"] * len(submission_ids))
                stats_query = f"""
                    SELECT
                        submission_id,
                        COUNT(*) AS answer_count,
                        COUNT(score) AS scored_count,
                        SUM(score) AS total_score
                    FROM answer_submission
                    WHERE submission_id IN ({stat_placeholders})
                    GROUP BY submission_id
                """
                with connection.cursor() as cursor:
                    cursor.execute(stats_query, submission_ids)
                    for submission_id, answer_count, scored_count, total_score in cursor.fetchall():
                        submission_stats_by_id[submission_id] = {
                            "answer_count": int(answer_count or 0),
                            "scored_count": int(scored_count or 0),
                            "total_score": to_float(total_score) if total_score is not None else None,
                        }
        except Exception:
            # Keep endpoint resilient across partially migrated schemas.
            latest_submission_by_student = {}
            submission_stats_by_id = {}

    # Fallback for environments where attempts data exists but submission tables are incomplete.
    attempts = list(
        Attempt.objects.filter(assessment_id=assessment.id, student_id__in=student_ids).order_by(
            "-attempt_number", "-id"
        )
    )
    latest_attempt_by_student = {}
    for attempt in attempts:
        if attempt.student_id not in latest_attempt_by_student:
            latest_attempt_by_student[attempt.student_id] = attempt

    points_total = sum(
        to_float(points)
        for points in AssessmentQuestion.objects.filter(assessment_id=assessment.id).values_list(
            "points", flat=True
        )
    )

    _ensure_proctoring_tables()
    attempt_ids = [attempt.id for attempt in attempts]
    proctoring_summary_by_attempt_id = {}
    if attempt_ids:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    attempt_id,
                    COUNT(*)::INT AS leave_count,
                    COALESCE(SUM(duration_seconds), 0)::INT AS total_outside_seconds
                FROM proctoring_tab_activity
                WHERE attempt_id = ANY(%s)
                GROUP BY attempt_id
                """,
                [attempt_ids],
            )
            for attempt_id, leave_count, total_outside_seconds in cursor.fetchall():
                proctoring_summary_by_attempt_id[int(attempt_id)] = {
                    "leaveCount": int(leave_count or 0),
                    "totalOutsideSeconds": int(total_outside_seconds or 0),
                }

    rows = []
    for row in enrollment_rows:
        submission = latest_submission_by_student.get(row.student_id)
        attempt = latest_attempt_by_student.get(row.student_id)
        if submission is None and attempt is None:
            rows.append(
                {
                    "submissionId": f"pending-{assessment.id}-{row.student_id}",
                    "studentId": str(row.student_id),
                    "studentName": f"{row.student.first_name} {row.student.last_name}".strip(),
                    "studentEmail": row.student.email,
                    "group": row.group.name if row.group_id else None,
                    "status": "Not Started",
                    "score": None,
                    "maxScore": points_total,
                    "submittedAt": None,
                }
            )
            continue

        if submission is not None:
            stats = submission_stats_by_id.get(submission["id"], {})
            answer_count = stats.get("answer_count", 0)
            scored_count = stats.get("scored_count", 0)
            status = "Graded" if answer_count > 0 and scored_count == answer_count else "Submitted"
            rows.append(
                {
                    "submissionId": str(submission["id"]),
                    "studentId": str(row.student_id),
                    "studentName": f"{row.student.first_name} {row.student.last_name}".strip(),
                    "studentEmail": row.student.email,
                    "group": row.group.name if row.group_id else None,
                    "status": status,
                    "score": stats.get("total_score"),
                    "maxScore": points_total,
                    "submittedAt": submission["submitted_at"].isoformat() if submission["submitted_at"] else None,
                }
            )
            continue

        mode_label = _attempt_submission_mode_label(attempt)
        attempt_row = {
            "submissionId": str(attempt.id),
            "studentId": str(row.student_id),
            "studentName": f"{row.student.first_name} {row.student.last_name}".strip(),
            "studentEmail": row.student.email,
            "group": row.group.name if row.group_id else None,
            "status": _submission_status_label_for_assessment(attempt, assessment),
            "score": to_float(attempt.score) if attempt.score is not None else None,
            "maxScore": points_total,
            "submittedAt": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
            "proctoring": proctoring_summary_by_attempt_id.get(
                attempt.id,
                {"leaveCount": 0, "totalOutsideSeconds": 0},
            ),
        }
        if mode_label is not None:
            attempt_row["submissionMode"] = mode_label
        rows.append(attempt_row)

    return JsonResponse(
        {
            "assessment": {
                "id": str(assessment.id),
                "title": assessment.title,
                "moduleId": str(assessment.module_id),
                "moduleCode": assessment.module.code,
            },
            "thresholdSeconds": _assessment_tab_switch_threshold_seconds(assessment.id),
            "rows": rows,
        }
    )


@csrf_exempt
@login_required
@user_passes_test(is_teacher)
@require_http_methods(["GET", "PATCH"])
def teacher_submission_detail(request, submission_id):
    teacher_id = request.user.id

    attempt = Attempt.objects.filter(id=submission_id).select_related("assessment__module", "student").first()
    if attempt:
        assessment = attempt.assessment
    else:
        assessment = None
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT s.student_id, s.assessment_id, s.submitted_at, a.title, a.module_id
                    FROM submission s
                    JOIN assessments a ON a.id = s.assessment_id
                    WHERE s.id = %s
                    """,
                    [submission_id],
                )
                row = cursor.fetchone()
                if row:
                    student_id, assessment_id, submitted_at, title, module_id = row
                    assessment = Assessment.objects.select_related("module").filter(id=assessment_id).first()
                    attempt = type(
                        "SubmissionProxy",
                        (),
                        {
                            "id": int(submission_id),
                            "student_id": student_id,
                            "submitted_at": submitted_at,
                            "assessment": assessment,
                            "score": None,
                            "status": "SUBMITTED",
                            "student": User.objects.filter(id=student_id).first(),
                        },
                    )()
        except Exception:
            assessment = None

    if not attempt or not assessment:
        return JsonResponse({"detail": "Submission not found"}, status=404)

    module_ids = _teacher_module_ids(teacher_id)
    if assessment.module_id not in module_ids and assessment.created_by_id != teacher_id:
        return JsonResponse({"detail": "Not allowed for this submission"}, status=403)

    if request.method == "GET":
        _ensure_proctoring_tables()
        threshold_seconds = _assessment_tab_switch_threshold_seconds(assessment.id)
        proctoring_events = []
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT switched_at, returned_at, duration_seconds
                FROM proctoring_tab_activity
                WHERE attempt_id = %s
                ORDER BY switched_at ASC
                """,
                [getattr(attempt, "id", 0)],
            )
            for switched_at, returned_at, duration_seconds in cursor.fetchall():
                duration_value = int(duration_seconds or 0)
                is_suspicious_event = duration_value >= threshold_seconds
                proctoring_events.append(
                    {
                        "switchedAt": switched_at.isoformat() if switched_at else None,
                        "returnedAt": returned_at.isoformat() if returned_at else None,
                        "durationSeconds": duration_value,
                        "isSuspicious": is_suspicious_event,
                    }
                )
        suspicious_count = len([item for item in proctoring_events if item["isSuspicious"]])
        total_outside_seconds = sum(int(item["durationSeconds"] or 0) for item in proctoring_events)
        proctoring_summary = {
            "leaveCount": len(proctoring_events),
            "totalOutsideSeconds": total_outside_seconds,
            "thresholdSeconds": threshold_seconds,
            "suspiciousEventCount": suspicious_count,
            "isSuspicious": suspicious_count > 0 or total_outside_seconds >= threshold_seconds,
            "events": proctoring_events,
        }
        answer_rows = list(
            Answer.objects.filter(attempt_id=getattr(attempt, "id", 0))
            .select_related("question")
            .order_by("id")
        )

        if answer_rows:
            points_by_question = {
                row.question_id: to_float(row.points)
                for row in AssessmentQuestion.objects.filter(assessment_id=assessment.id)
            }
            keywords_by_question_id = defaultdict(list)
            for keyword in QuestionKeyword.objects.filter(
                question_id__in=[row.question_id for row in answer_rows],
                is_active=True,
            ).order_by("id"):
                keywords_by_question_id[keyword.question_id].append(
                    {"text": keyword.keyword, "weight": to_float(keyword.weight)}
                )
            feedback_by_answer = {
                item.answer_id: item
                for item in Feedback.objects.filter(answer_id__in=[a.id for a in answer_rows])
            }
            analysis_by_answer = defaultdict(lambda: {"detected": [], "missing": []})
            analysis_rows = (
                AnswerKeywordAnalysis.objects.filter(answer_id__in=[a.id for a in answer_rows])
                .select_related("question_keyword")
                .order_by("id")
            )
            for analysis in analysis_rows:
                keyword_text = (
                    analysis.keyword_snapshot
                    or (analysis.question_keyword.keyword if analysis.question_keyword_id else None)
                )
                if not keyword_text:
                    continue
                if analysis.is_detected:
                    analysis_by_answer[analysis.answer_id]["detected"].append(keyword_text)
                else:
                    analysis_by_answer[analysis.answer_id]["missing"].append(keyword_text)

            answers_payload = []
            for row in answer_rows:
                detected_keywords = analysis_by_answer[row.id]["detected"]
                missing_keywords = analysis_by_answer[row.id]["missing"]

                if row.question.type == "DESCRIPTIVE" and keywords_by_question_id.get(row.question_id):
                    try:
                        ai_url = (
                            getattr(settings, "AI_SERVICE_URL", "http://127.0.0.1:5000/api/ai/generate")
                            .replace("/generate", "/evaluate")
                        )
                        ai_request = urllib.request.Request(
                            ai_url,
                            data=json.dumps(
                                {
                                    "answer_text": row.text_answer or "",
                                    "keywords": keywords_by_question_id[row.question_id],
                                    "max_points": points_by_question.get(row.question_id, 1.0),
                                }
                            ).encode("utf-8"),
                            method="POST",
                            headers={"Content-Type": "application/json"},
                        )
                        with urllib.request.urlopen(ai_request, timeout=25) as ai_response:
                            ai_raw = ai_response.read().decode("utf-8")
                            ai_payload = json.loads(ai_raw) if ai_raw else {}
                        ai_score = to_float(ai_payload.get("score", row.auto_score or 0))
                        detected_keywords = ai_payload.get("detected_keywords") or detected_keywords
                        missing_keywords = ai_payload.get("missing_keywords") or missing_keywords

                        row.auto_score = ai_score
                        row.updated_at = timezone.now()
                        row.save(update_fields=["auto_score", "updated_at"])
                    except Exception:
                        ai_score = to_float(row.auto_score) if row.auto_score is not None else 0.0
                    else:
                        ai_analysis = []
                        for kw in detected_keywords:
                            keyword_obj = QuestionKeyword.objects.filter(
                                question_id=row.question_id,
                                keyword=kw,
                            ).first()
                            if keyword_obj:
                                ai_analysis.append((keyword_obj.id, True, kw))
                        for kw in missing_keywords:
                            keyword_obj = QuestionKeyword.objects.filter(
                                question_id=row.question_id,
                                keyword=kw,
                            ).first()
                            if keyword_obj:
                                ai_analysis.append((keyword_obj.id, False, kw))
                        if ai_analysis:
                            AnswerKeywordAnalysis.objects.filter(answer_id=row.id).delete()
                            for keyword_id, is_detected, keyword_snapshot in ai_analysis:
                                AnswerKeywordAnalysis.objects.create(
                                    answer_id=row.id,
                                    question_keyword_id=keyword_id,
                                    keyword_snapshot=keyword_snapshot,
                                    is_detected=is_detected,
                                    confidence=None,
                                    created_at=timezone.now(),
                                )
                else:
                    ai_score = to_float(row.auto_score) if row.auto_score is not None else 0.0

                current_score = row.final_score if row.final_score is not None else row.manual_score
                if current_score is None:
                    current_score = ai_score
                answers_payload.append(
                    {
                        "questionId": str(row.question_id),
                        "questionText": row.question.content,
                        "questionType": row.question.type,
                        "points": points_by_question.get(row.question_id, 0.0),
                        "answer": row.text_answer or "",
                        "autoScore": ai_score,
                        "currentScore": to_float(current_score) if current_score is not None else 0.0,
                        "isCorrect": bool(row.is_correct) if row.is_correct is not None else None,
                        "detectedKeywords": detected_keywords,
                        "missingKeywords": missing_keywords,
                        "teacherComment": feedback_by_answer.get(row.id).teacher_comment
                        if feedback_by_answer.get(row.id)
                        else None,
                    }
                )
            max_score = sum(points_by_question.values()) or to_float(assessment.total_points)
            computed_submission_score = round(
                sum(to_float(item["currentScore"]) for item in answers_payload),
                2,
            )
            if to_float(attempt.score) != computed_submission_score:
                attempt.score = computed_submission_score
                attempt.updated_at = timezone.now()
                attempt.save(update_fields=["score", "updated_at"])
            grading_submission_payload = {
                "id": str(attempt.id),
                "status": _submission_status_label_for_assessment(attempt, assessment),
                "score": computed_submission_score,
                "maxScore": max_score,
                "submittedAt": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
                "feedback": next(
                    (item["teacherComment"] for item in answers_payload if item["teacherComment"]),
                    "",
                ),
                "answers": answers_payload,
                "proctoring": proctoring_summary,
            }
            grading_mode = _attempt_submission_mode_label(attempt)
            if grading_mode is not None:
                grading_submission_payload["submissionMode"] = grading_mode
            return JsonResponse(
                {
                    "assessment": {
                        "id": str(assessment.id),
                        "title": assessment.title,
                        "moduleId": str(assessment.module_id),
                        "moduleCode": assessment.module.code,
                    },
                    "student": {
                        "id": str(attempt.student_id),
                        "name": f"{attempt.student.first_name} {attempt.student.last_name}".strip()
                        if attempt.student
                        else "Student",
                    },
                    "submission": grading_submission_payload,
                }
            )

        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT aq.id, aq.question_id, q.content, q.type, aq.points, ans.answer_text, ans.selected_option, ans.score
                    FROM answer_submission ans
                    JOIN assessment_questions aq ON aq.id = ans.assessment_question_id
                    JOIN questions q ON q.id = aq.question_id
                    WHERE ans.submission_id = %s
                    ORDER BY aq.sort_order, aq.id
                    """,
                    [submission_id],
                )
                rows = cursor.fetchall()
        except Exception:
            rows = []

        answers_payload = [
            {
                "questionId": str(question_id),
                "questionText": question_text,
                "questionType": question_type,
                "points": to_float(points),
                "answer": answer_text or selected_option or "",
                "autoScore": to_float(score) if score is not None else 0.0,
                "currentScore": to_float(score) if score is not None else 0.0,
                "isCorrect": None,
                "detectedKeywords": [],
                "missingKeywords": [],
                "teacherComment": None,
            }
            for _, question_id, question_text, question_type, points, answer_text, selected_option, score in rows
        ]
        max_score = sum(to_float(item["points"]) for item in answers_payload) or to_float(assessment.total_points)
        return JsonResponse(
            {
                "assessment": {
                    "id": str(assessment.id),
                    "title": assessment.title,
                    "moduleId": str(assessment.module_id),
                    "moduleCode": assessment.module.code,
                },
                "student": {
                    "id": str(attempt.student_id),
                    "name": f"{attempt.student.first_name} {attempt.student.last_name}".strip()
                    if attempt.student
                    else "Student",
                },
                "submission": {
                    "id": str(attempt.id),
                    "status": "Submitted",
                    "submissionMode": "submitted",
                    "score": round(sum(to_float(item["autoScore"]) for item in answers_payload), 2)
                    if answers_payload
                    else None,
                    "maxScore": max_score,
                    "submittedAt": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
                    "feedback": "",
                    "answers": answers_payload,
                    "proctoring": proctoring_summary,
                },
            }
        )

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"detail": "Invalid JSON body"}, status=400)

    scores = payload.get("scores") or {}
    feedback_text = (payload.get("feedback") or "").strip()
    question_feedback = payload.get("questionFeedback") or {}
    action = (payload.get("action") or "save").strip().lower()
    now = timezone.now()

    answer_rows = list(Answer.objects.filter(attempt_id=getattr(attempt, "id", 0)).order_by("id"))
    if answer_rows:
        for answer in answer_rows:
            score_raw = scores.get(str(answer.question_id))
            if score_raw is None:
                update_fields = []
            else:
                try:
                    parsed_score = float(score_raw)
                except (TypeError, ValueError):
                    parsed_score = None
                update_fields = []
                if parsed_score is not None:
                    answer.manual_score = parsed_score
                    answer.final_score = parsed_score
                    update_fields.extend(["manual_score", "final_score"])

            answer_comment = str(question_feedback.get(str(answer.question_id), "")).strip()
            existing_feedback = Feedback.objects.filter(answer_id=answer.id).first()
            if answer_comment:
                Feedback.objects.update_or_create(
                    answer_id=answer.id,
                    defaults={
                        "teacher_comment": answer_comment,
                        "graded_by_id": teacher_id,
                        "graded_at": now,
                        "private_note": None,
                        "created_at": existing_feedback.created_at if existing_feedback else now,
                        "updated_at": now,
                    },
                )
            elif existing_feedback and str(existing_feedback.teacher_comment or "").strip():
                existing_feedback.teacher_comment = ""
                existing_feedback.graded_by_id = teacher_id
                existing_feedback.graded_at = now
                existing_feedback.updated_at = now
                existing_feedback.save(
                    update_fields=["teacher_comment", "graded_by_id", "graded_at", "updated_at"]
                )

            answer.updated_at = now
            update_fields.append("updated_at")
            answer.save(update_fields=list(dict.fromkeys(update_fields)))

        total_score = sum(
            to_float(answer.final_score if answer.final_score is not None else answer.auto_score)
            for answer in answer_rows
        )
        attempt.score = total_score
        attempt.status = "FINALIZED" if action == "publish" else "MANUALLY_GRADED"
        attempt.updated_at = now
        if action == "publish" and not attempt.submitted_at:
            attempt.submitted_at = now
        attempt.save(update_fields=["score", "status", "updated_at", "submitted_at"])

        if feedback_text and not question_feedback:
            first_answer = answer_rows[0]
            Feedback.objects.update_or_create(
                answer_id=first_answer.id,
                defaults={
                    "teacher_comment": feedback_text,
                    "graded_by_id": teacher_id,
                    "graded_at": now,
                    "private_note": None,
                    "created_at": now,
                    "updated_at": now,
                },
            )
    else:
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT aq.id, aq.question_id
                    FROM answer_submission ans
                    JOIN assessment_questions aq ON aq.id = ans.assessment_question_id
                    WHERE ans.submission_id = %s
                    """,
                    [submission_id],
                )
                mapping = cursor.fetchall()
            mapping_by_question = {str(question_id): assessment_question_id for assessment_question_id, question_id in mapping}
            with connection.cursor() as cursor:
                for question_id, value in scores.items():
                    assessment_question_id = mapping_by_question.get(str(question_id))
                    if assessment_question_id is None:
                        continue
                    try:
                        parsed_score = float(value)
                    except (TypeError, ValueError):
                        continue
                    cursor.execute(
                        """
                        UPDATE answer_submission
                        SET score = %s
                        WHERE submission_id = %s AND assessment_question_id = %s
                        """,
                        [parsed_score, submission_id, assessment_question_id],
                    )
        except Exception:
            pass

    return JsonResponse({"saved": True})


@csrf_exempt
@login_required
@user_passes_test(is_teacher)
@require_http_methods(["GET", "PATCH", "DELETE"])
def teacher_question_detail(request, question_id):
    teacher_id = request.user.id
    try:
        question = _teacher_visible_questions_queryset(teacher_id).get(id=question_id)
    except Question.DoesNotExist:
        return JsonResponse({"detail": "Question not found"}, status=404)

    if request.method == "DELETE":
        if question.created_by_id != teacher_id:
            return JsonResponse({"detail": "Only the creator can delete this question"}, status=403)
        question.deleted_at = timezone.now()
        question.updated_at = timezone.now()
        question.save(update_fields=["deleted_at", "updated_at"])
        return JsonResponse({"deleted": True})

    if request.method == "PATCH":
        if question.created_by_id != teacher_id:
            return JsonResponse({"detail": "Only the creator can update this question"}, status=403)
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return JsonResponse({"detail": "Invalid JSON body"}, status=400)
        parsed = _validate_question_payload(payload, teacher_id, is_update=True)
        if parsed["errors"]:
            return JsonResponse({"detail": "Validation failed", "errors": parsed["errors"]}, status=400)

        now = timezone.now()
        question.content = parsed["text"]
        question.type = parsed["db_question_type"]
        question.difficulty = parsed["db_difficulty"]
        question.status = parsed["db_status"]
        question.module_id = parsed["module_id"]
        question.topic_id = parsed["topic_id"]
        question.explanation = parsed["reference_answer"]
        question.default_points = parsed["points"]
        question.approved_by_id = teacher_id if parsed["db_status"] == "APPROVED" else None
        question.approved_at = now if parsed["db_status"] == "APPROVED" else None
        question.updated_at = now
        question.save()

        Choice.objects.filter(question_id=question.id).delete()
        for index, option in enumerate(parsed["options"], start=1):
            Choice.objects.create(
                question_id=question.id,
                content=option,
                is_correct=option in parsed["correct_options"],
                sort_order=index,
                created_at=now,
                updated_at=now,
            )
        QuestionKeyword.objects.filter(question_id=question.id).delete()
        for keyword in parsed["keywords"]:
            QuestionKeyword.objects.create(
                question_id=question.id,
                keyword=keyword["text"],
                weight=keyword["weight"],
                is_active=True,
                created_at=now,
                updated_at=now,
            )
            for synonym in payload.get("keywords", []):
                if synonym.get("text") == keyword["text"]:
                    for item in synonym.get("synonyms", []):
                        synonym_value = str(item).strip()
                        if synonym_value:
                            QuestionKeyword.objects.create(
                                question_id=question.id,
                                keyword=synonym_value,
                                weight=keyword["weight"],
                                is_active=True,
                                created_at=now,
                                updated_at=now,
                            )

        return JsonResponse({"question": {"id": str(question.id)}})

    choices = list(Choice.objects.filter(question_id=question.id).order_by("sort_order", "id"))
    keywords = list(QuestionKeyword.objects.filter(question_id=question.id, is_active=True).order_by("id"))
    topics_by_id = {topic.id: topic for topic in Topic.objects.filter(id=question.topic_id)} if question.topic_id else {}
    return JsonResponse(
        {
            "question": _serialize_question(
                question,
                {question.id: choices},
                {question.id: keywords},
                topics_by_id,
            )
        }
    )


@csrf_exempt
@login_required
@user_passes_test(is_teacher)
@require_http_methods(["POST"])
def teacher_ai_generate(request):
    """Proxy to the Flask AI service (ai_mvp). Body: { question, options: { answer, keywords, improve } }."""
    url = getattr(settings, "AI_SERVICE_URL", "http://127.0.0.1:5000/api/ai/generate")
    req = urllib.request.Request(
        url,
        data=request.body,
        method="POST",
        headers={
            "Content-Type": request.headers.get("Content-Type", "application/json; charset=utf-8"),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=35) as resp:
            raw = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        status = e.code
    except urllib.error.URLError:
        return JsonResponse(
            {
                "error": "AI service is not reachable. Start the Flask app in ai_mvp/ (python app.py) or set AI_SERVICE_URL.",
                "improved_question": "",
                "answer": "",
                "keywords": [],
            },
            status=503,
        )

    try:
        data = json.loads(raw) if raw else {}
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid response from AI service"}, status=502)

    if not isinstance(data, dict):
        return JsonResponse({"error": "Invalid response from AI service"}, status=502)

    return JsonResponse(data, status=status)