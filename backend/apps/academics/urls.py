from django.urls import path

from . import views


urlpatterns = [
    path("admin/modules", views.list_modules, name="list-modules"),
    path("admin/modules/<int:module_id>", views.update_module, name="update-module"),
    path("admin/modules/<int:module_id>/delete", views.delete_module, name="delete-module"),
    path("admin/modules/<int:module_id>/teachers", views.list_module_teachers, name="list-module-teachers"),
    path("admin/modules/<int:module_id>/assign-teacher", views.assign_teacher_to_module, name="assign-teacher-to-module"),
    path("admin/modules/<int:module_id>/assign-teacher/<int:assignment_id>", views.delete_module_assignment, name="delete-module-assignment"),
    path("admin/modules/<int:module_id>/enrollments", views.list_enrollments, name="list-enrollments"),
    path("admin/modules/<int:module_id>/enroll-student", views.enroll_student, name="enroll-student"),
    path("admin/modules/<int:module_id>/enrollments/<str:enrollment_id>", views.unenroll_student, name="unenroll-student"),
]