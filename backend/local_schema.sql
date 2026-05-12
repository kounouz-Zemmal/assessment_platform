-- Local PostgreSQL schema for assessment_platform
-- Custom application tables only (Django built-in tables are created by 'manage.py migrate')
-- Tables ordered to satisfy all foreign-key dependencies

-- 1. Independent lookup tables
CREATE TABLE IF NOT EXISTS public.roles (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL UNIQUE,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL UNIQUE,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.academic_years (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL UNIQUE,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT academic_years_pkey PRIMARY KEY (id)
);

-- 2. Tables depending on the above
CREATE TABLE IF NOT EXISTS public.users (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  role_id integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp without time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES public.roles(id)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  role_id integer NOT NULL,
  permission_id integer NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
);

CREATE TABLE IF NOT EXISTS public.semesters (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL,
  academic_year_id integer NOT NULL,
  start_date date,
  end_date date,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT semesters_pkey PRIMARY KEY (id),
  CONSTRAINT fk_semesters_academic_year FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id)
);

-- 3. Tables depending on semesters
CREATE TABLE IF NOT EXISTS public.modules (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL,
  code character varying UNIQUE,
  description text,
  semester_id integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp without time zone,
  CONSTRAINT modules_pkey PRIMARY KEY (id),
  CONSTRAINT fk_modules_semester FOREIGN KEY (semester_id) REFERENCES public.semesters(id)
);

-- 4. Tables depending on modules
CREATE TABLE IF NOT EXISTS public.topics (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL,
  module_id integer NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT topics_pkey PRIMARY KEY (id),
  CONSTRAINT fk_topics_module FOREIGN KEY (module_id) REFERENCES public.modules(id)
);

CREATE TABLE IF NOT EXISTS public.groups (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL,
  module_id integer NOT NULL,
  description text,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT fk_groups_module FOREIGN KEY (module_id) REFERENCES public.modules(id)
);

CREATE TABLE IF NOT EXISTS public.module_teachers (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id integer NOT NULL,
  module_id integer NOT NULL,
  role_in_module character varying NOT NULL CHECK (role_in_module IN ('LECTURER','TD_TEACHER','LAB_TEACHER','ASSISTANT')),
  is_responsible boolean NOT NULL DEFAULT false,
  can_add_questions boolean NOT NULL DEFAULT false,
  can_send_assessments boolean NOT NULL DEFAULT false,
  can_manage_materials boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT module_teachers_pkey PRIMARY KEY (id),
  CONSTRAINT fk_module_teachers_user FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT fk_module_teachers_module FOREIGN KEY (module_id) REFERENCES public.modules(id)
);

CREATE TABLE IF NOT EXISTS public.student_groups (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id integer NOT NULL,
  group_id integer NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT student_groups_pkey PRIMARY KEY (id),
  CONSTRAINT fk_student_groups_student FOREIGN KEY (student_id) REFERENCES public.users(id),
  CONSTRAINT fk_student_groups_group FOREIGN KEY (group_id) REFERENCES public.groups(id)
);

-- 5. Assessments (depends on modules, users)
CREATE TABLE IF NOT EXISTS public.assessments (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  title character varying NOT NULL,
  description text,
  instructions text,
  module_id integer NOT NULL,
  created_by integer NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  start_time timestamp without time zone,
  end_time timestamp without time zone,
  status character varying NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SCHEDULED','ACTIVE','CLOSED','PUBLISHED')),
  shuffle_questions boolean NOT NULL DEFAULT false,
  shuffle_choices boolean NOT NULL DEFAULT false,
  max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts > 0),
  show_result_immediately boolean NOT NULL DEFAULT false,
  allow_review boolean NOT NULL DEFAULT true,
  access_code character varying,
  total_points numeric NOT NULL DEFAULT 0.00 CHECK (total_points >= 0),
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp without time zone,
  auto_submit boolean,
  tab_warning boolean,
  CONSTRAINT assessments_pkey PRIMARY KEY (id),
  CONSTRAINT fk_assessments_module FOREIGN KEY (module_id) REFERENCES public.modules(id),
  CONSTRAINT fk_assessments_created_by FOREIGN KEY (created_by) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.assessment_proctoring_config (
  assessment_id bigint NOT NULL,
  tab_switch_threshold_seconds integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assessment_proctoring_config_pkey PRIMARY KEY (assessment_id),
  CONSTRAINT assessment_proctoring_config_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id)
);

CREATE TABLE IF NOT EXISTS public.assessment_result_visibility (
  assessment_id integer NOT NULL,
  show_final_score boolean NOT NULL DEFAULT true,
  show_score_breakdown boolean NOT NULL DEFAULT true,
  show_teacher_feedback boolean NOT NULL DEFAULT true,
  show_ai_keyword_analysis boolean NOT NULL DEFAULT true,
  show_per_question_details boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT assessment_result_visibility_pkey PRIMARY KEY (assessment_id),
  CONSTRAINT fk_arv_assessment FOREIGN KEY (assessment_id) REFERENCES public.assessments(id)
);

CREATE TABLE IF NOT EXISTS public.assessment_targets (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  assessment_id integer NOT NULL,
  group_id integer,
  student_id integer,
  assigned_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT assessment_targets_pkey PRIMARY KEY (id),
  CONSTRAINT fk_assessment_targets_assessment FOREIGN KEY (assessment_id) REFERENCES public.assessments(id),
  CONSTRAINT fk_assessment_targets_group FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT fk_assessment_targets_student FOREIGN KEY (student_id) REFERENCES public.users(id)
);

-- 6. Questions (depends on modules, topics, users)
CREATE TABLE IF NOT EXISTS public.questions (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  content text NOT NULL,
  type character varying NOT NULL CHECK (type IN ('MCQ','SCQ','TRUE_FALSE','DESCRIPTIVE')),
  difficulty character varying NOT NULL DEFAULT 'MEDIUM' CHECK (difficulty IN ('EASY','MEDIUM','HARD')),
  module_id integer NOT NULL,
  topic_id integer,
  created_by integer NOT NULL,
  status character varying NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_REVIEW','APPROVED','REJECTED')),
  explanation text,
  default_points numeric NOT NULL DEFAULT 1.00 CHECK (default_points >= 0),
  approved_by integer,
  approved_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp without time zone,
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_questions_module FOREIGN KEY (module_id) REFERENCES public.modules(id),
  CONSTRAINT fk_questions_topic FOREIGN KEY (topic_id) REFERENCES public.topics(id),
  CONSTRAINT fk_questions_created_by FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT fk_questions_approved_by FOREIGN KEY (approved_by) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.choices (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_id integer NOT NULL,
  content text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT choices_pkey PRIMARY KEY (id),
  CONSTRAINT fk_choices_question FOREIGN KEY (question_id) REFERENCES public.questions(id)
);

CREATE TABLE IF NOT EXISTS public.question_keywords (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_id integer NOT NULL,
  keyword character varying NOT NULL,
  weight numeric NOT NULL DEFAULT 1.00,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT question_keywords_pkey PRIMARY KEY (id),
  CONSTRAINT fk_question_keywords_question FOREIGN KEY (question_id) REFERENCES public.questions(id)
);

CREATE TABLE IF NOT EXISTS public.question_stats (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_id integer NOT NULL UNIQUE,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  avg_score numeric NOT NULL DEFAULT 0.00 CHECK (avg_score >= 0),
  success_rate numeric NOT NULL DEFAULT 0.00 CHECK (success_rate >= 0 AND success_rate <= 100),
  last_calculated_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT question_stats_pkey PRIMARY KEY (id),
  CONSTRAINT fk_question_stats_question FOREIGN KEY (question_id) REFERENCES public.questions(id)
);

CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  assessment_id integer NOT NULL,
  question_id integer NOT NULL,
  points numeric NOT NULL DEFAULT 1.00 CHECK (points >= 0),
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT assessment_questions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_assessment_questions_assessment FOREIGN KEY (assessment_id) REFERENCES public.assessments(id),
  CONSTRAINT fk_assessment_questions_question FOREIGN KEY (question_id) REFERENCES public.questions(id)
);

CREATE TABLE IF NOT EXISTS public.materials (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  title character varying NOT NULL,
  file_url character varying NOT NULL,
  type character varying NOT NULL CHECK (type IN ('PDF','DOC','SLIDE','IMAGE','VIDEO','LINK','OTHER')),
  module_id integer NOT NULL,
  topic_id integer,
  uploaded_by integer NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT materials_pkey PRIMARY KEY (id),
  CONSTRAINT fk_materials_module FOREIGN KEY (module_id) REFERENCES public.modules(id),
  CONSTRAINT fk_materials_topic FOREIGN KEY (topic_id) REFERENCES public.topics(id),
  CONSTRAINT fk_materials_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);

-- 7. Attempts & answers (depend on users, assessments, questions)
CREATE TABLE IF NOT EXISTS public.attempts (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id integer NOT NULL,
  assessment_id integer NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  status character varying NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS','SUBMITTED','AUTO_GRADED','MANUALLY_GRADED','FINALIZED')),
  start_time timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time timestamp without time zone,
  submitted_at timestamp without time zone,
  auto_submitted boolean NOT NULL DEFAULT false,
  last_activity_at timestamp without time zone,
  score numeric CHECK (score IS NULL OR score >= 0),
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attempts_pkey PRIMARY KEY (id),
  CONSTRAINT fk_attempts_assessment FOREIGN KEY (assessment_id) REFERENCES public.assessments(id),
  CONSTRAINT fk_attempts_student FOREIGN KEY (student_id) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.answers (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  attempt_id integer NOT NULL,
  question_id integer NOT NULL,
  text_answer text,
  is_correct boolean,
  auto_score numeric,
  manual_score numeric,
  final_score numeric,
  answered_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT answers_pkey PRIMARY KEY (id),
  CONSTRAINT fk_answers_attempt FOREIGN KEY (attempt_id) REFERENCES public.attempts(id),
  CONSTRAINT fk_answers_question FOREIGN KEY (question_id) REFERENCES public.questions(id)
);

CREATE TABLE IF NOT EXISTS public.answer_choices (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  answer_id integer NOT NULL,
  choice_id integer NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT answer_choices_pkey PRIMARY KEY (id),
  CONSTRAINT fk_answer_choices_answer FOREIGN KEY (answer_id) REFERENCES public.answers(id),
  CONSTRAINT fk_answer_choices_choice FOREIGN KEY (choice_id) REFERENCES public.choices(id)
);

CREATE TABLE IF NOT EXISTS public.answer_keyword_analysis (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  answer_id integer NOT NULL,
  question_keyword_id integer NOT NULL,
  keyword_snapshot character varying,
  is_detected boolean NOT NULL DEFAULT false,
  confidence numeric,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT answer_keyword_analysis_pkey PRIMARY KEY (id),
  CONSTRAINT fk_answer_keyword_analysis_answer FOREIGN KEY (answer_id) REFERENCES public.answers(id),
  CONSTRAINT fk_answer_keyword_analysis_question_keyword FOREIGN KEY (question_keyword_id) REFERENCES public.question_keywords(id)
);

CREATE TABLE IF NOT EXISTS public.feedback (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  answer_id integer NOT NULL UNIQUE,
  teacher_comment text NOT NULL,
  graded_by integer NOT NULL,
  graded_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  private_note text,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT fk_feedback_answer FOREIGN KEY (answer_id) REFERENCES public.answers(id),
  CONSTRAINT fk_feedback_graded_by FOREIGN KEY (graded_by) REFERENCES public.users(id)
);

-- 8. Proctoring (depends on assessments, attempts, users)
CREATE SEQUENCE IF NOT EXISTS public.proctoring_tab_activity_id_seq;

CREATE TABLE IF NOT EXISTS public.proctoring_tab_activity (
  id bigint NOT NULL DEFAULT nextval('public.proctoring_tab_activity_id_seq'),
  assessment_id bigint NOT NULL,
  attempt_id bigint NOT NULL,
  student_id bigint NOT NULL,
  switched_at timestamp with time zone NOT NULL,
  returned_at timestamp with time zone,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT proctoring_tab_activity_pkey PRIMARY KEY (id),
  CONSTRAINT proctoring_tab_activity_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id),
  CONSTRAINT proctoring_tab_activity_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.attempts(id),
  CONSTRAINT proctoring_tab_activity_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id)
);
