from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.utils import timezone


class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "roles"

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, email, first_name, last_name, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, first_name=first_name, last_name=last_name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, first_name, last_name, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, first_name, last_name, password, **extra_fields)


class User(AbstractBaseUser):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.CharField(max_length=255, unique=True)
    password = models.CharField(max_length=255, db_column='password_hash')
    role = models.ForeignKey(Role, models.DO_NOTHING)
    is_active = models.BooleanField(default=True)
    last_login = models.DateTimeField(blank=True, null=True, db_column='last_login_at')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    deleted_at = models.DateTimeField(blank=True, null=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        managed = False
        db_table = "users"

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"

    @property
    def is_staff(self):
        return self.role.name.upper() == "ADMIN"

    @property
    def is_superuser(self):
        return self.role.name.upper() == "ADMIN"

    def has_perm(self, perm, obj=None):
        return self.role.name.upper() == "ADMIN"

    def has_module_perms(self, app_label):
        return self.role.name.upper() == "ADMIN"
