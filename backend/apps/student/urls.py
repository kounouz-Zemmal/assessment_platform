from django.urls import path

from . import views


urlpatterns = [
    path("student/dashboard", views.student_dashboard, name="student-dashboard"),
    path("student/assessments", views.student_assessments, name="student-assessments"),
    path(
        "student/assessments/<int:assessment_id>/instructions",
        views.student_assessment_instructions,
        name="student-assessment-instructions",
    ),
    path(
        "student/assessments/<int:assessment_id>/attempt/start",
        views.student_attempt_start,
        name="student-attempt-start",
    ),
    path(
        "student/assessments/<int:assessment_id>/attempt",
        views.student_attempt_detail,
        name="student-attempt-detail",
    ),
    path(
        "student/assessments/<int:assessment_id>/attempt/save",
        views.student_attempt_save,
        name="student-attempt-save",
    ),
    path(
        "student/assessments/<int:assessment_id>/attempt/proctoring",
        views.student_attempt_proctoring_event,
        name="student-attempt-proctoring",
    ),
    path(
        "student/assessments/<int:assessment_id>/attempt/submit",
        views.student_attempt_submit,
        name="student-attempt-submit",
    ),
    path("student/history", views.student_history, name="student-history"),
    path(
        "student/results/<int:assessment_id>",
        views.student_results,
        name="student-results",
    ),
]
