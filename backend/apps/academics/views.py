from django.http import JsonResponse
from django.views.decorators.http import require_http_methods, require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required, user_passes_test
from django.core.exceptions import ValidationError
from django.utils import timezone
import json

from apps.accounts.models import User, Role
from apps.academics.models import Module, ModuleTeacher, Group, StudentGroup, Topic


def is_admin(user):
    return user.role.name.lower() == "admin"


@csrf_exempt
# @login_required
# @user_passes_test(is_admin)
@require_http_methods(["GET", "POST"])
def list_modules(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            name = data.get("name")
            code = data.get("code")
            description = data.get("description", "")

            if not name or not code:
                return JsonResponse({"detail": "Name and code are required"}, status=400)

            module = Module.objects.create(
                name=name,
                code=code,
                description=description,
                semester_id=1,
                is_active=True,
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )

            # Create topics if provided
            topics_data = data.get("topics", [])
            created_topics = []
            for topic_data in topics_data:
                topic_name = topic_data.get("name")
                if topic_name:
                    topic = Topic.objects.create(
                        name=topic_name,
                        module=module,
                        is_active=True,
                        created_at=timezone.now(),
                        updated_at=timezone.now(),
                    )
                    created_topics.append({
                        "id": topic.id,
                        "name": topic.name
                    })

            return JsonResponse({
                "success": True,
                "data": {
                    "module": {
                        "id": module.id,
                        "name": module.name,
                        "code": module.code,
                        "description": module.description,
                        "topics": created_topics
                    }
                }
            }, status=201)
        except Exception as e:
            return JsonResponse({"detail": str(e)}, status=500)

    modules = Module.objects.filter(is_active=True, deleted_at__isnull=True)
    data = []
    for module in modules:
        topics = Topic.objects.filter(module=module, is_active=True)
        data.append({
            "id": module.id,
            "name": module.name,
            "code": module.code,
            "description": module.description,
            "topics": [{"id": t.id, "name": t.name} for t in topics]
        })
    return JsonResponse({"success": True, "data": {"modules": data}})


@csrf_exempt
@login_required
@user_passes_test(is_admin)
@require_http_methods(["PATCH"])
def update_module(request, module_id):
    try:
        module = Module.objects.get(id=module_id, is_active=True, deleted_at__isnull=True)
    except Module.DoesNotExist:
        return JsonResponse({"detail": "Module not found"}, status=404)

    try:
        data = json.loads(request.body)
        name = data.get("name")
        code = data.get("code")
        description = data.get("description", "")

        if not name or not code:
            return JsonResponse({"detail": "Name and code are required"}, status=400)

        module.name = name
        module.code = code
        module.description = description
        module.updated_at = timezone.now()
        module.save()

        # Update topics
        topics_data = data.get("topics", [])
        # Simple approach: deactivate old topics and create new ones, or sync them.
        # Given the current model, let's just create ones that don't exist.
        # But wait, the frontend sends the whole list.
        # Better approach: 
        existing_topic_ids = list(Topic.objects.filter(module=module, is_active=True).values_list('id', flat=True))
        incoming_topic_ids = [t.get('id') for t in topics_data if t.get('id') and not str(t.get('id')).startswith('t')]
        
        # Deactivate topics not in incoming list
        Topic.objects.filter(module=module, id__in=[tid for tid in existing_topic_ids if tid not in incoming_topic_ids]).update(is_active=False)
        
        # Create new topics or update existing
        for t_data in topics_data:
            t_id = t_data.get('id')
            t_name = t_data.get('name')
            if not t_name: continue
            
            if not t_id or str(t_id).startswith('t'):
                Topic.objects.create(
                    name=t_name,
                    module=module,
                    is_active=True,
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )
            else:
                Topic.objects.filter(id=t_id, module=module).update(name=t_name, updated_at=timezone.now())

        final_topics = Topic.objects.filter(module=module, is_active=True)

        return JsonResponse({
            "success": True,
            "data": {
                "module": {
                    "id": module.id,
                    "name": module.name,
                    "code": module.code,
                    "description": module.description,
                    "topics": [{"id": t.id, "name": t.name} for t in final_topics]
                }
            }
        })
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)


@csrf_exempt
@login_required
@user_passes_test(is_admin)
@require_http_methods(["DELETE"])
def delete_module(request, module_id):
    try:
        module = Module.objects.get(id=module_id, is_active=True, deleted_at__isnull=True)
    except Module.DoesNotExist:
        return JsonResponse({"detail": "Module not found"}, status=404)

    module.deleted_at = timezone.now()
    module.is_active = False
    module.save()
    return JsonResponse({"success": True, "data": {}})


@login_required
@user_passes_test(is_admin)
@require_GET
def list_module_teachers(request, module_id):
    try:
        module = Module.objects.get(id=module_id, is_active=True, deleted_at__isnull=True)
    except Module.DoesNotExist:
        return JsonResponse({"detail": "Module not found"}, status=404)

    teachers = ModuleTeacher.objects.filter(module=module).select_related("user")
    data = []
    for mt in teachers:
        data.append({
            "id": mt.id,
            "userId": mt.user.id,
            "name": f"{mt.user.first_name} {mt.user.last_name}",
            "email": mt.user.email,
            "roleInModule": mt.role_in_module,
            "isResponsible": mt.is_responsible,
        })
    return JsonResponse({"success": True, "data": {"teachers": data}})


@csrf_exempt
@login_required
@user_passes_test(is_admin)
@require_POST
def assign_teacher_to_module(request, module_id):
    try:
        module = Module.objects.get(id=module_id, is_active=True, deleted_at__isnull=True)
    except Module.DoesNotExist:
        return JsonResponse({"detail": "Module not found"}, status=404)

    try:
        data = json.loads(request.body)
        user_id = data.get("userId")
        role_in_module = data.get("roleInModule")  # "Lecturer", "Tutorial Instructor", "Lab Instructor"
        is_responsible = data.get("isResponsible", False)

        if not user_id or not role_in_module:
            return JsonResponse({"detail": "userId and roleInModule required"}, status=400)

        user = User.objects.get(id=user_id, role__name__iexact="teacher", is_active=True)

        # Check if already assigned
        if ModuleTeacher.objects.filter(user=user, module=module).exists():
            return JsonResponse({"detail": "Teacher already assigned to this module"}, status=400)

        mt = ModuleTeacher.objects.create(
            user=user,
            module=module,
            role_in_module=role_in_module,
            is_responsible=is_responsible,
            can_add_questions=True,  # Default permissions
            can_send_assessments=True,
            can_manage_materials=True,
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )

        return JsonResponse({
            "success": True,
            "data": {
                "assignment": {
                    "id": mt.id,
                    "userId": mt.user.id,
                    "name": f"{mt.user.first_name} {mt.user.last_name}",
                    "roleInModule": mt.role_in_module,
                    "isResponsible": mt.is_responsible,
                }
            }
        }, status=201)

    except User.DoesNotExist:
        return JsonResponse({"detail": "Teacher not found"}, status=404)
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)


@csrf_exempt
@login_required
@user_passes_test(is_admin)
@require_http_methods(["DELETE"])
def delete_module_assignment(request, module_id, assignment_id):
    try:
        module = Module.objects.get(id=module_id, is_active=True, deleted_at__isnull=True)
    except Module.DoesNotExist:
        return JsonResponse({"detail": "Module not found"}, status=404)

    try:
        assignment = ModuleTeacher.objects.get(id=assignment_id, module=module)
        assignment.delete()
        return JsonResponse({"success": True, "data": {}})
    except ModuleTeacher.DoesNotExist:
        return JsonResponse({"detail": "Assignment not found"}, status=404)
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)


@login_required
@user_passes_test(is_admin)
@require_GET
def list_enrollments(request, module_id):
    try:
        module = Module.objects.get(id=module_id, is_active=True, deleted_at__isnull=True)
    except Module.DoesNotExist:
        return JsonResponse({"detail": "Module not found"}, status=404)

    # Get all groups for this module
    groups = Group.objects.filter(module=module)
    enrollments = []

    for group in groups:
        student_groups = StudentGroup.objects.filter(group=group).select_related('student')
        for sg in student_groups:
            enrollments.append({
                "id": f"{sg.student.id}-{group.id}",
                "studentId": sg.student.id,
                "moduleId": module.id,
                "group": group.name,
                "studentName": f"{sg.student.first_name} {sg.student.last_name}",
                "studentEmail": sg.student.email,
            })

    return JsonResponse({"success": True, "data": {"enrollments": enrollments}})


@csrf_exempt
@login_required
@user_passes_test(is_admin)
@require_POST
def enroll_student(request, module_id):
    try:
        module = Module.objects.get(id=module_id, is_active=True, deleted_at__isnull=True)
    except Module.DoesNotExist:
        return JsonResponse({"detail": "Module not found"}, status=404)

    try:
        data = json.loads(request.body)
        student_id = data.get("studentId")
        group_name = data.get("group", "Default")

        if not student_id:
            return JsonResponse({"detail": "studentId required"}, status=400)

        student = User.objects.get(id=student_id, role__name__iexact="student", is_active=True)

        # Get or create group
        group, created = Group.objects.get_or_create(
            module=module,
            name=group_name,
            defaults={
                'description': f'Group for {group_name}',
                'created_at': timezone.now(),
                'updated_at': timezone.now(),
            }
        )

        # Check if already enrolled
        if StudentGroup.objects.filter(student=student, group=group).exists():
            return JsonResponse({"detail": "Student already enrolled in this group"}, status=400)

        sg = StudentGroup.objects.create(
            student=student,
            group=group,
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )

        return JsonResponse({
            "success": True,
            "data": {
                "enrollment": {
                    "id": f"{sg.student.id}-{sg.group.id}",
                    "studentId": sg.student.id,
                    "moduleId": module.id,
                    "group": sg.group.name,
                    "studentName": f"{sg.student.first_name} {sg.student.last_name}",
                    "studentEmail": sg.student.email,
                }
            }
        }, status=201)

    except User.DoesNotExist:
        return JsonResponse({"detail": "Student not found"}, status=404)
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)


@csrf_exempt
@login_required
@user_passes_test(is_admin)
@require_http_methods(["DELETE"])
def unenroll_student(request, module_id, enrollment_id):
    try:
        module = Module.objects.get(id=module_id, is_active=True, deleted_at__isnull=True)
    except Module.DoesNotExist:
        return JsonResponse({"detail": "Module not found"}, status=404)

    try:
        # enrollment_id is in format "student_id-group_id"
        student_id, group_id = enrollment_id.split('-')
        student = User.objects.get(id=student_id)
        group = Group.objects.get(id=group_id, module=module)

        enrollment = StudentGroup.objects.get(student=student, group=group)
        enrollment.delete()

        return JsonResponse({"success": True, "data": {}})
    except (ValueError, User.DoesNotExist, Group.DoesNotExist, StudentGroup.DoesNotExist):
        return JsonResponse({"detail": "Enrollment not found"}, status=404)
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)