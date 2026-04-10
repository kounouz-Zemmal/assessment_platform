from django.urls import path

from . import views


urlpatterns = [
    path("teacher/profile", views.teacher_profile, name="teacher-profile"),
    path("teacher/dashboard", views.teacher_dashboard, name="teacher-dashboard"),
    path("teacher/modules", views.teacher_modules, name="teacher-modules"),
    path("teacher/topics", views.teacher_create_topic, name="teacher-create-topic"),
    path("teacher/questions", views.teacher_questions, name="teacher-questions"),
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
]
