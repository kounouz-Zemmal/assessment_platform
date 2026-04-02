from django.urls import path

from . import views


urlpatterns = [
    path("student/dashboard", views.student_dashboard, name="student-dashboard"),
    path("student/history", views.student_history, name="student-history"),
    path(
        "student/results/<int:assessment_id>",
        views.student_results,
        name="student-results",
    ),
]
