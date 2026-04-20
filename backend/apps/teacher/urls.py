from django.urls import path

from . import views


urlpatterns = [
    path("teacher/profile", views.teacher_profile, name="teacher-profile"),
    path("teacher/dashboard", views.teacher_dashboard, name="teacher-dashboard"),
    path("teacher/modules", views.teacher_modules, name="teacher-modules"),
    path("teacher/topics", views.teacher_create_topic, name="teacher-create-topic"),
    path("teacher/questions", views.teacher_questions, name="teacher-questions"),
    path("teacher/assessments", views.teacher_assessments, name="teacher-assessments"),
    path(
        "teacher/assessments/<int:assessment_id>",
        views.teacher_assessment_detail,
        name="teacher-assessment-detail",
    ),
    path(
        "teacher/assessments/<int:assessment_id>/status",
        views.teacher_assessment_status_update,
        name="teacher-assessment-status-update",
    ),
    path(
        "teacher/assessments/<int:assessment_id>/submissions",
        views.teacher_assessment_submissions,
        name="teacher-assessment-submissions",
    ),
    path(
        "teacher/submissions/<int:submission_id>",
        views.teacher_submission_detail,
        name="teacher-submission-detail",
    ),
    path(
        "teacher/questions/<int:question_id>",
        views.teacher_question_detail,
        name="teacher-question-detail",
    ),
    path("teacher/analytics", views.teacher_analytics, name="teacher-analytics"),
    path(
        "teacher/result-visibility",
        views.teacher_result_visibility_list,
        name="teacher-result-visibility-list",
    ),
    path(
        "teacher/result-visibility/<int:assessment_id>",
        views.teacher_result_visibility_update,
        name="teacher-result-visibility-update",
    ),
    path("teacher/ai/generate", views.teacher_ai_generate, name="teacher-ai-generate"),
]
