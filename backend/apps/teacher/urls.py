from django.urls import path

from . import views


urlpatterns = [
    path("teacher/profile", views.teacher_profile, name="teacher-profile"),
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
