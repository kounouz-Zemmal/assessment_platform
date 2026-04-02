from apps.auth_demo.views import demo_login_user
from apps.student.views import student_dashboard, student_history, student_results
from apps.teacher.views import (
    teacher_analytics,
    teacher_profile,
    teacher_result_visibility_list,
    teacher_result_visibility_update,
)


__all__ = [
    "demo_login_user",
    "teacher_profile",
    "teacher_result_visibility_list",
    "teacher_result_visibility_update",
    "teacher_analytics",
    "student_dashboard",
    "student_history",
    "student_results",
]
