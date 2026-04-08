from collections import defaultdict

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from apps.accounts.models import User
from apps.academics.models import StudentGroup
from apps.assessments.models import (
    Answer,
    AnswerKeywordAnalysis,
    Assessment,
    AssessmentQuestion,
    AssessmentResultVisibility,
    Attempt,
    Feedback,
)
from apps.common.utils import (
    assessment_status,
    attempt_status,
    extract_keyword_analysis,
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

    attempt = (
        Attempt.objects.filter(student_id=student_id, assessment_id=assessment_id)
        .order_by("-attempt_number")
        .first()
    )
    if not attempt:
        return JsonResponse({"detail": "Results not found"}, status=404)

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
        detected_keywords = analysis_by_answer[row.id]["detected"]
        missing_keywords = analysis_by_answer[row.id]["missing"]
        if not detected_keywords and not missing_keywords:
            detected_keywords, missing_keywords = extract_keyword_analysis(
                feedback_item.private_note if feedback_item else None
            )
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
                "detectedKeywords": detected_keywords,
                "missingKeywords": missing_keywords,
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
