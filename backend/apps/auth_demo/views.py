from django.http import JsonResponse
from django.views.decorators.http import require_GET

from apps.accounts.models import User


@require_GET
def demo_login_user(request):
    email = request.GET.get("email")
    if not email:
        return JsonResponse({"detail": "Missing query param: email"}, status=400)

    try:
        user = User.objects.select_related("role").get(email=email, is_active=True)
    except User.DoesNotExist:
        return JsonResponse({"detail": "User not found or inactive"}, status=404)

    return JsonResponse(
        {
            "user": {
                "id": str(user.id),
                "firstName": user.first_name,
                "lastName": user.last_name,
                "name": f"{user.first_name} {user.last_name}".strip(),
                "email": user.email,
                "role": (user.role.name or "").lower(),
                "status": "active",
                "createdAt": user.created_at.isoformat(),
            },
        }
    )
