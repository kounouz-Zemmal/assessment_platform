from django.db import models


class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "roles"


class User(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.CharField(max_length=255, unique=True)
    password_hash = models.CharField(max_length=255)
    role = models.ForeignKey(Role, models.DO_NOTHING)
    is_active = models.BooleanField()
    last_login_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "users"


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


class Assessment(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    instructions = models.TextField(blank=True, null=True)
    module = models.ForeignKey(Module, models.DO_NOTHING)
    created_by = models.ForeignKey(User, models.DO_NOTHING, db_column="created_by")
    duration_minutes = models.IntegerField()
    start_time = models.DateTimeField(blank=True, null=True)
    end_time = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=30)
    shuffle_questions = models.BooleanField()
    shuffle_choices = models.BooleanField()
    max_attempts = models.IntegerField()
    show_result_immediately = models.BooleanField()
    allow_review = models.BooleanField()
    access_code = models.CharField(max_length=100, blank=True, null=True)
    total_points = models.DecimalField(max_digits=8, decimal_places=2)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "assessments"


class Question(models.Model):
    content = models.TextField()
    type = models.CharField(max_length=30)
    difficulty = models.CharField(max_length=20)
    module = models.ForeignKey(Module, models.DO_NOTHING)
    topic_id = models.IntegerField(blank=True, null=True)
    created_by = models.ForeignKey(User, models.DO_NOTHING, db_column="created_by", related_name="created_questions")
    status = models.CharField(max_length=30)
    explanation = models.TextField(blank=True, null=True)
    default_points = models.DecimalField(max_digits=8, decimal_places=2)
    approved_by = models.ForeignKey(User, models.DO_NOTHING, db_column="approved_by", related_name="approved_questions", blank=True, null=True)
    approved_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "questions"


class AssessmentQuestion(models.Model):
    assessment = models.ForeignKey(Assessment, models.DO_NOTHING)
    question = models.ForeignKey(Question, models.DO_NOTHING)
    points = models.DecimalField(max_digits=8, decimal_places=2)
    sort_order = models.IntegerField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "assessment_questions"
        unique_together = (("assessment", "question"), ("assessment", "sort_order"))


class Attempt(models.Model):
    student = models.ForeignKey(User, models.DO_NOTHING)
    assessment = models.ForeignKey(Assessment, models.DO_NOTHING)
    attempt_number = models.IntegerField()
    status = models.CharField(max_length=30)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(blank=True, null=True)
    submitted_at = models.DateTimeField(blank=True, null=True)
    auto_submitted = models.BooleanField()
    last_activity_at = models.DateTimeField(blank=True, null=True)
    score = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "attempts"
        unique_together = (("student", "assessment", "attempt_number"),)


class Answer(models.Model):
    attempt = models.ForeignKey(Attempt, models.DO_NOTHING)
    question = models.ForeignKey(Question, models.DO_NOTHING)
    text_answer = models.TextField(blank=True, null=True)
    is_correct = models.BooleanField(blank=True, null=True)
    auto_score = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    manual_score = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    final_score = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    answered_at = models.DateTimeField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "answers"
        unique_together = (("attempt", "question"),)


class Feedback(models.Model):
    answer = models.OneToOneField(Answer, models.DO_NOTHING)
    teacher_comment = models.TextField()
    graded_by = models.ForeignKey(User, models.DO_NOTHING, db_column="graded_by")
    graded_at = models.DateTimeField()
    private_note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "feedback"


class AssessmentResultVisibility(models.Model):
    assessment = models.OneToOneField(Assessment, models.DO_NOTHING, primary_key=True)
    show_final_score = models.BooleanField(default=True)
    show_score_breakdown = models.BooleanField(default=True)
    show_teacher_feedback = models.BooleanField(default=True)
    show_ai_keyword_analysis = models.BooleanField(default=True)
    show_per_question_details = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "assessment_result_visibility"


class QuestionStat(models.Model):
    question = models.OneToOneField(Question, models.DO_NOTHING)
    attempt_count = models.IntegerField()
    avg_score = models.DecimalField(max_digits=8, decimal_places=2)
    success_rate = models.DecimalField(max_digits=5, decimal_places=2)
    last_calculated_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "question_stats"
