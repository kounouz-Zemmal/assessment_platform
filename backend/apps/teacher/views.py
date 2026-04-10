import json
import urllib.error
import urllib.request
from collections import defaultdict

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from django.contrib.auth.decorators import login_required, user_passes_test
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.models import User
from apps.academics.models import Module, ModuleTeacher, Topic
from apps.assessments.models import (
    Answer,
    Assessment,
    AssessmentQuestion,
    AssessmentResultVisibility,
    Attempt,
    Choice,
    Question,
    QuestionKeyword,
    QuestionStat,
)
from apps.common.utils import (
    assessment_status,
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
        with urllib.request.urlopen(req, timeout=120) as resp:
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
