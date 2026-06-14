from django.urls import path

from . import views


urlpatterns = [
    path("auth/login", views.login_view, name="login"),
    path("auth/logout", views.logout_view, name="logout"),
    path("auth/me", views.current_user, name="current-user"),
    path("auth/change-password", views.change_password, name="change-password"),
    path("auth/csrf-token", views.csrf_token, name="csrf-token"),
]
