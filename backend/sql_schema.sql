-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.academic_years (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL UNIQUE,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT academic_years_pkey PRIMARY KEY (id)
);
CREATE TABLE public.answer_choices (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  answer_id integer NOT NULL,
  choice_id integer NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT answer_choices_pkey PRIMARY KEY (id),
  CONSTRAINT fk_answer_choices_answer FOREIGN KEY (answer_id) REFERENCES public.answers(id),
  CONSTRAINT fk_answer_choices_choice FOREIGN KEY (choice_id) REFERENCES public.choices(id)
);
CREATE TABLE public.answer_keyword_analysis (
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
CREATE TABLE public.answers (
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
CREATE TABLE public.assessment_questions (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  assessment_id integer NOT NULL,
  question_id integer NOT NULL,
  points numeric NOT NULL DEFAULT 1.00 CHECK (points >= 0::numeric),
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT assessment_questions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_assessment_questions_assessment FOREIGN KEY (assessment_id) REFERENCES public.assessments(id),
  CONSTRAINT fk_assessment_questions_question FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.assessment_result_visibility (
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
CREATE TABLE public.assessment_targets (
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
CREATE TABLE public.assessments (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  title character varying NOT NULL,
  description text,
  instructions text,
  module_id integer NOT NULL,
  created_by integer NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  start_time timestamp without time zone,
  end_time timestamp without time zone,
  status character varying NOT NULL DEFAULT 'DRAFT'::character varying CHECK (status::text = ANY (ARRAY['DRAFT'::character varying, 'SCHEDULED'::character varying, 'ACTIVE'::character varying, 'CLOSED'::character varying, 'PUBLISHED'::character varying]::text[])),
  shuffle_questions boolean NOT NULL DEFAULT false,
  shuffle_choices boolean NOT NULL DEFAULT false,
  max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts > 0),
  show_result_immediately boolean NOT NULL DEFAULT false,
  allow_review boolean NOT NULL DEFAULT true,
  access_code character varying,
  total_points numeric NOT NULL DEFAULT 0.00 CHECK (total_points >= 0::numeric),
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp without time zone,
  CONSTRAINT assessments_pkey PRIMARY KEY (id),
  CONSTRAINT fk_assessments_module FOREIGN KEY (module_id) REFERENCES public.modules(id),
  CONSTRAINT fk_assessments_created_by FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.attempts (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id integer NOT NULL,
  assessment_id integer NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  status character varying NOT NULL DEFAULT 'IN_PROGRESS'::character varying CHECK (status::text = ANY (ARRAY['IN_PROGRESS'::character varying, 'SUBMITTED'::character varying, 'AUTO_GRADED'::character varying, 'MANUALLY_GRADED'::character varying, 'FINALIZED'::character varying]::text[])),
  start_time timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time timestamp without time zone,
  submitted_at timestamp without time zone,
  auto_submitted boolean NOT NULL DEFAULT false,
  last_activity_at timestamp without time zone,
  score numeric CHECK (score IS NULL OR score >= 0::numeric),
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attempts_pkey PRIMARY KEY (id),
  CONSTRAINT fk_attempts_assessment FOREIGN KEY (assessment_id) REFERENCES public.assessments(id),
  CONSTRAINT fk_attempts_student FOREIGN KEY (student_id) REFERENCES public.users(id)
);
CREATE TABLE public.auth_group (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL UNIQUE,
  CONSTRAINT auth_group_pkey PRIMARY KEY (id)
);
CREATE TABLE public.auth_group_permissions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  group_id integer NOT NULL,
  permission_id integer NOT NULL,
  CONSTRAINT auth_group_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT auth_group_permissions_group_id_b120cbf9_fk_auth_group_id FOREIGN KEY (group_id) REFERENCES public.auth_group(id),
  CONSTRAINT auth_group_permissio_permission_id_84c5c92e_fk_auth_perm FOREIGN KEY (permission_id) REFERENCES public.auth_permission(id)
);
CREATE TABLE public.auth_permission (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL,
  content_type_id integer NOT NULL,
  codename character varying NOT NULL,
  CONSTRAINT auth_permission_pkey PRIMARY KEY (id),
  CONSTRAINT auth_permission_content_type_id_2f476e4b_fk_django_co FOREIGN KEY (content_type_id) REFERENCES public.django_content_type(id)
);
CREATE TABLE public.auth_user (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  password character varying NOT NULL,
  last_login timestamp with time zone,
  is_superuser boolean NOT NULL,
  username character varying NOT NULL UNIQUE,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  email character varying NOT NULL,
  is_staff boolean NOT NULL,
  is_active boolean NOT NULL,
  date_joined timestamp with time zone NOT NULL,
  CONSTRAINT auth_user_pkey PRIMARY KEY (id)
);
CREATE TABLE public.auth_user_groups (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id integer NOT NULL,
  group_id integer NOT NULL,
  CONSTRAINT auth_user_groups_pkey PRIMARY KEY (id),
  CONSTRAINT auth_user_groups_user_id_6a12ed8b_fk_auth_user_id FOREIGN KEY (user_id) REFERENCES public.auth_user(id),
  CONSTRAINT auth_user_groups_group_id_97559544_fk_auth_group_id FOREIGN KEY (group_id) REFERENCES public.auth_group(id)
);
CREATE TABLE public.auth_user_user_permissions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id integer NOT NULL,
  permission_id integer NOT NULL,
  CONSTRAINT auth_user_user_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT auth_user_user_permissions_user_id_a95ead1b_fk_auth_user_id FOREIGN KEY (user_id) REFERENCES public.auth_user(id),
  CONSTRAINT auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm FOREIGN KEY (permission_id) REFERENCES public.auth_permission(id)
);
CREATE TABLE public.choices (
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
CREATE TABLE public.django_admin_log (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  action_time timestamp with time zone NOT NULL,
  object_id text,
  object_repr character varying NOT NULL,
  action_flag smallint NOT NULL CHECK (action_flag >= 0),
  change_message text NOT NULL,
  content_type_id integer,
  user_id integer NOT NULL,
  CONSTRAINT django_admin_log_pkey PRIMARY KEY (id),
  CONSTRAINT django_admin_log_content_type_id_c4bce8eb_fk_django_co FOREIGN KEY (content_type_id) REFERENCES public.django_content_type(id),
  CONSTRAINT django_admin_log_user_id_c564eba6_fk_auth_user_id FOREIGN KEY (user_id) REFERENCES public.auth_user(id)
);
CREATE TABLE public.django_content_type (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  app_label character varying NOT NULL,
  model character varying NOT NULL,
  CONSTRAINT django_content_type_pkey PRIMARY KEY (id)
);
CREATE TABLE public.django_migrations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  app character varying NOT NULL,
  name character varying NOT NULL,
  applied timestamp with time zone NOT NULL,
  CONSTRAINT django_migrations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.django_session (
  session_key character varying NOT NULL,
  session_data text NOT NULL,
  expire_date timestamp with time zone NOT NULL,
  CONSTRAINT django_session_pkey PRIMARY KEY (session_key)
);
CREATE TABLE public.feedback (
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
CREATE TABLE public.groups (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL,
  module_id integer NOT NULL,
  description text,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT fk_groups_module FOREIGN KEY (module_id) REFERENCES public.modules(id)
);
CREATE TABLE public.materials (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  title character varying NOT NULL,
  file_url character varying NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['PDF'::character varying, 'DOC'::character varying, 'SLIDE'::character varying, 'IMAGE'::character varying, 'VIDEO'::character varying, 'LINK'::character varying, 'OTHER'::character varying]::text[])),
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
CREATE TABLE public.module_teachers (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id integer NOT NULL,
  module_id integer NOT NULL,
  role_in_module character varying NOT NULL CHECK (role_in_module::text = ANY (ARRAY['LECTURER'::character varying, 'TD_TEACHER'::character varying, 'LAB_TEACHER'::character varying, 'ASSISTANT'::character varying]::text[])),
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
CREATE TABLE public.modules (
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
CREATE TABLE public.permissions (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL UNIQUE,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.question_keywords (
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
CREATE TABLE public.question_stats (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_id integer NOT NULL UNIQUE,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  avg_score numeric NOT NULL DEFAULT 0.00 CHECK (avg_score >= 0::numeric),
  success_rate numeric NOT NULL DEFAULT 0.00 CHECK (success_rate >= 0::numeric AND success_rate <= 100::numeric),
  last_calculated_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT question_stats_pkey PRIMARY KEY (id),
  CONSTRAINT fk_question_stats_question FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.questions (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  content text NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['MCQ'::character varying, 'SCQ'::character varying, 'TRUE_FALSE'::character varying, 'DESCRIPTIVE'::character varying]::text[])),
  difficulty character varying NOT NULL DEFAULT 'MEDIUM'::character varying CHECK (difficulty::text = ANY (ARRAY['EASY'::character varying, 'MEDIUM'::character varying, 'HARD'::character varying]::text[])),
  module_id integer NOT NULL,
  topic_id integer,
  created_by integer NOT NULL,
  status character varying NOT NULL DEFAULT 'DRAFT'::character varying CHECK (status::text = ANY (ARRAY['DRAFT'::character varying, 'PENDING_REVIEW'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying]::text[])),
  explanation text,
  default_points numeric NOT NULL DEFAULT 1.00 CHECK (default_points >= 0::numeric),
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
CREATE TABLE public.role_permissions (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  role_id integer NOT NULL,
  permission_id integer NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
);
CREATE TABLE public.roles (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL UNIQUE,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.semesters (
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
CREATE TABLE public.student_groups (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id integer NOT NULL,
  group_id integer NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT student_groups_pkey PRIMARY KEY (id),
  CONSTRAINT fk_student_groups_student FOREIGN KEY (student_id) REFERENCES public.users(id),
  CONSTRAINT fk_student_groups_group FOREIGN KEY (group_id) REFERENCES public.groups(id)
);
CREATE TABLE public.topics (
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
CREATE TABLE public.users (
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