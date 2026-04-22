from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required, user_passes_test
from django.core.exceptions import ValidationError
from django.db import transaction, models
from django.utils import timezone
import json
import csv
import io

from apps.accounts.models import User, Role


def is_admin(user):
    return user.role.name.lower() == "admin"


@login_required
@user_passes_test(is_admin)
@require_GET
def list_users(request):
    # Filtering
    role_filter = (request.GET.get("role") or "").strip()
    search = request.GET.get('search')
    is_active = request.GET.get('is_active')

    users = User.objects.select_related("role").filter(deleted_at__isnull=True)

    if role_filter and role_filter.lower() != "all":
        users = users.filter(role__name__iexact=role_filter)
    if search:
        users = users.filter(
            models.Q(first_name__icontains=search) |
            models.Q(last_name__icontains=search) |
            models.Q(email__icontains=search)
        )
    if is_active is not None:
        users = users.filter(is_active=is_active.lower() == 'true')

    # Pagination
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 20))
    start = (page - 1) * page_size
    end = start + page_size

    total = users.count()
    users_page = users[start:end]

    data = []
    for user in users_page:
        data.append({
            "id": user.id,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "email": user.email,
            "role": user.role.name,
            "isActive": user.is_active,
            "createdAt": user.created_at.isoformat(),
        })

    return JsonResponse({
        "success": True,
        "data": {
            "users": data,
            "pagination": {
                "page": page,
                "pageSize": page_size,
                "total": total,
                "totalPages": (total + page_size - 1) // page_size
            }
        }
    })


@login_required
@user_passes_test(is_admin)
@csrf_exempt
@require_POST
def create_user(request):
    try:
        data = json.loads(request.body)
        first_name = data.get("firstName")
        last_name = data.get("lastName")
        email = data.get("email")
        password = data.get("password")
        role_name = data.get("role")  # "admin", "teacher", "student"
        teacher_type = data.get("teacherType")  # "lecturer", "tutorial", "lab" for teachers

        if not all([first_name, last_name, email, password, role_name]):
            return JsonResponse({"detail": "All fields required"}, status=400)

        role = Role.objects.get(name__iexact=role_name)
        user = User.objects.create_user(
            email=email,
            first_name=first_name,
            last_name=last_name,
            password=password,
            role=role,
            is_active=True
        )

        # If teacher, assign teacher type via ModuleTeacher if needed, but for now, just create user
        # Teacher type assignment can be done separately when assigning to modules

        return JsonResponse({
            "success": True,
            "data": {
                "user": {
                    "id": user.id,
                    "firstName": user.first_name,
                    "lastName": user.last_name,
                    "email": user.email,
                    "role": user.role.name,
                    "isActive": user.is_active,
                    "createdAt": user.created_at.isoformat(),
                }
            }
        }, status=201)

    except Role.DoesNotExist:
        return JsonResponse({"detail": "Invalid role"}, status=400)
    except ValidationError as e:
        return JsonResponse({"detail": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"detail": "Error creating user"}, status=500)


@login_required
@user_passes_test(is_admin)
@require_http_methods(["DELETE"])
def delete_user(request, user_id):
    try:
        user = User.objects.get(id=user_id, deleted_at__isnull=True)
        user.deleted_at = timezone.now()
        user.is_active = False
        user.save()
        return JsonResponse({"success": True, "data": {}})
    except User.DoesNotExist:
        return JsonResponse({"detail": "User not found"}, status=404)
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)


@login_required
@user_passes_test(is_admin)
@csrf_exempt
@require_POST
def import_students_csv(request):
    if "file" not in request.FILES:
        return JsonResponse({"success": False, "error": "No file provided"}, status=400)

    csv_file = request.FILES["file"]
    if not csv_file.name.endswith(".csv"):
        return JsonResponse({"success": False, "error": "File must be CSV"}, status=400)

    try:
        decoded_file = csv_file.read().decode("utf-8")
        io_string = io.StringIO(decoded_file)
        reader = csv.DictReader(io_string)

        student_role = Role.objects.get(name__iexact="student")
        created_users = []
        errors = []

        with transaction.atomic():
            for row in reader:
                try:
                    first_name = row.get("first_name")
                    last_name = row.get("last_name")
                    email = row.get("email")

                    if not all([first_name, last_name, email]):
                        errors.append(f"Missing fields for {email}")
                        continue

                    # Generate password or use default
                    password = row.get("password", "defaultpassword123")

                    user = User.objects.create_user(
                        email=email,
                        first_name=first_name,
                        last_name=last_name,
                        password=password,
                        role=student_role,
                        is_active=True
                    )
                    created_users.append({
                        "id": user.id,
                        "email": user.email,
                        "name": f"{user.first_name} {user.last_name}"
                    })

                except Exception as e:
                    errors.append(f"Error for {row.get('email')}: {str(e)}")

        return JsonResponse({
            "success": True,
            "data": {
                "created": created_users,
                "errors": errors
            }
        })

    except Exception as e:
        return JsonResponse({"success": False, "error": f"Error processing file: {str(e)}"}, status=500)
