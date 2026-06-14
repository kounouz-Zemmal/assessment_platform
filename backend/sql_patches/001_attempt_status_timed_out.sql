-- Run once on existing databases that were created before TIMED_OUT was added.
-- PostgreSQL names unnamed CHECK constraints as {table}_{column}_check

ALTER TABLE attempts DROP CONSTRAINT IF EXISTS attempts_status_check;

ALTER TABLE attempts
  ADD CONSTRAINT attempts_status_check
  CHECK (
    status::text = ANY (
      ARRAY[
        'IN_PROGRESS'::character varying,
        'SUBMITTED'::character varying,
        'AUTO_GRADED'::character varying,
        'MANUALLY_GRADED'::character varying,
        'FINALIZED'::character varying,
        'TIMED_OUT'::character varying
      ]::text[]
    )
  );
