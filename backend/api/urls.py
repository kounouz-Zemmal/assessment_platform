from django.urls import include, path


urlpatterns = [
    path("", include("apps.auth_demo.urls")),
    path("", include("apps.accounts.urls")),
    path("", include("apps.academics.urls")),
    path("", include("apps.teacher.urls")),
    path("", include("apps.student.urls")),
]