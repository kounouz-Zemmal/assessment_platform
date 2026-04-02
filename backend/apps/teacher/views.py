import json
from collections import defaultdict

from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.models import User
from apps.academics.models import ModuleTeacher
from apps.assessments.models import (
    Answer,
    Assessment,
    AssessmentQuestion,
    AssessmentResultVisibility,
    Attempt,
    QuestionStat,
)
from apps.common.utils import (
    assessment_status,
    required_int,
    to_float,
    to_percentage,
    visibility_payload,
)


@require_GET
def teacher_profile(request):
    teacher_id, error = required_int(request, "user_id")
    if error:
        return error

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


@require_GET
def teacher_result_visibility_list(request):
    teacher_id, error = required_int(request, "teacher_id")
    if error:
        return error

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
@require_http_methods(["PATCH"])
def teacher_result_visibility_update(request, assessment_id):
    teacher_id, error = required_int(request, "teacher_id")
    if error:
        return error

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


@require_GET
def teacher_analytics(request):
    teacher_id, error = required_int(request, "teacher_id")
    if error:
        return error

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
