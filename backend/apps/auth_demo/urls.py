from django.urls import path

from . import views


urlpatterns = [
    path("auth/demo-user", views.demo_login_user, name="demo-login-user"),
]
