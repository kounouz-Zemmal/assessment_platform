from django.urls import path

from . import views


urlpatterns = [
    path("admin/users", views.list_users, name="list-users"),
    path("admin/users/create", views.create_user, name="create-user"),
    path("admin/users/import-csv", views.import_students_csv, name="import-students-csv"),
    path("admin/users/<int:user_id>/delete", views.delete_user, name="delete-user"),
]