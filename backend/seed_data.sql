-- Seed data: roles required by the application
-- Run this after local_schema.sql

INSERT INTO public.roles (name) VALUES
  ('ADMIN'),
  ('TEACHER'),
  ('STUDENT')
ON CONFLICT (name) DO NOTHING;
