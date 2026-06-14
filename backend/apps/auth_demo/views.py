from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone
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
def logout_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Authentication required"}, status=401)

    logout(request)
    return JsonResponse({"success": True, "data": {"message": "Logged out successfully"}})


@require_GET
def current_user(request):
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Authentication required"}, status=401)

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


@require_POST
def change_password(request):
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Authentication required"}, status=401)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    current_password = (data.get("currentPassword") or "").strip()
    new_password = (data.get("newPassword") or "").strip()
    confirm_password = (data.get("confirmPassword") or "").strip()

    if not current_password or not new_password or not confirm_password:
        return JsonResponse(
            {"success": False, "error": "Current password, new password, and confirmation are required"},
            status=400,
        )

    if not request.user.check_password(current_password):
        return JsonResponse({"success": False, "error": "Current password is incorrect"}, status=400)

    if new_password != confirm_password:
        return JsonResponse({"success": False, "error": "New password and confirmation do not match"}, status=400)

    if current_password == new_password:
        return JsonResponse({"success": False, "error": "New password must be different from current password"}, status=400)

    try:
        validate_password(new_password, user=request.user)
    except ValidationError as exc:
        return JsonResponse({"success": False, "error": " ".join(exc.messages)}, status=400)

    request.user.set_password(new_password)
    if hasattr(request.user, "updated_at"):
        request.user.updated_at = timezone.now()
        request.user.save(update_fields=["password", "updated_at"])
    else:
        request.user.save(update_fields=["password"])

    # Keep user logged in after password change
    update_session_auth_hash(request, request.user)

    return JsonResponse(
        {
            "success": True,
            "data": {
                "message": "Password updated successfully"
            },
        }
    )


@require_GET
def csrf_token(request):
    """Get CSRF token for frontend"""
    from django.middleware.csrf import get_token
    token = get_token(request)
    return JsonResponse({"success": True, "data": {"csrfToken": token}})
