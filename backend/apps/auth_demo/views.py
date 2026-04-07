from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
import json


@csrf_exempt
@require_POST
def login_view(request):
    try:
        data = json.loads(request.body)
        email = data.get("email")
        password = data.get("password")
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    if not email or not password:
        return JsonResponse({"success": False, "error": "Email and password required"}, status=400)

    user = authenticate(request, username=email, password=password)
    if user is not None:
        login(request, user)
        return JsonResponse({
            "success": True,
            "data": {
                "user": {
                    "id": user.id,
                    "firstName": user.first_name,
                    "lastName": user.last_name,
                    "name": f"{user.first_name} {user.last_name}".strip(),
                    "email": user.email,
                    "role": (user.role.name or "").lower(),
                    "status": "active" if user.is_active else "inactive",
                    "createdAt": user.created_at.isoformat(),
                }
            }
        })
    else:
        return JsonResponse({"success": False, "error": "Invalid credentials"}, status=401)


@require_POST
@login_required
def logout_view(request):
    logout(request)
    return JsonResponse({"success": True, "data": {"message": "Logged out successfully"}})


@require_GET
@login_required
def current_user(request):
    user = request.user
    return JsonResponse({
        "success": True,
        "data": {
            "user": {
                "id": user.id,
                "firstName": user.first_name,
                "lastName": user.last_name,
                "name": f"{user.first_name} {user.last_name}".strip(),
                "email": user.email,
                "role": (user.role.name or "").lower(),
                "status": "active" if user.is_active else "inactive",
                "createdAt": user.created_at.isoformat(),
            }
        }
    })


@require_GET
def csrf_token(request):
    """Get CSRF token for frontend"""
    from django.middleware.csrf import get_token
    token = get_token(request)
    return JsonResponse({"success": True, "data": {"csrfToken": token}})
