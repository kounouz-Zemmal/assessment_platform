from django.db import models

from apps.accounts.models import User


class Module(models.Model):
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, unique=True, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    semester_id = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "modules"
        unique_together = (("name", "semester_id"),)


class Topic(models.Model):
    name = models.CharField(max_length=150)
    module = models.ForeignKey(Module, models.DO_NOTHING)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "topics"


class ModuleTeacher(models.Model):
    user = models.ForeignKey(User, models.DO_NOTHING)
    module = models.ForeignKey(Module, models.DO_NOTHING)
    role_in_module = models.CharField(max_length=30)
    is_responsible = models.BooleanField()
    can_add_questions = models.BooleanField()
    can_send_assessments = models.BooleanField()
    can_manage_materials = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "module_teachers"
        unique_together = (("user", "module"),)


class Group(models.Model):
    name = models.CharField(max_length=100)
    module = models.ForeignKey(Module, models.DO_NOTHING)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "groups"
        unique_together = (("name", "module"),)


class StudentGroup(models.Model):
    student = models.ForeignKey(User, models.DO_NOTHING)
    group = models.ForeignKey(Group, models.DO_NOTHING)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "student_groups"
        unique_together = (("student", "group"),)
