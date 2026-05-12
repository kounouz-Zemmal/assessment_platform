"""
Supabase -> Local PostgreSQL data migration script.
Run from the project root: python migrate_supabase_data.py
"""
import os
import sys

# ---------------------------------------------------------------------------
# Connection config
# ---------------------------------------------------------------------------
SUPABASE = {
    "host": "aws-1-eu-west-1.pooler.supabase.com",
    "port": 5432,
    "dbname": "postgres",
    "user": "postgres.kbmgahdyzkrejlmefkkg",
    "password": "957asgVOdor4eA9W",
    "sslmode": "require",
}

LOCAL = {
    "host": "localhost",
    "port": 5433,
    "dbname": "assessment_db",
    "user": "postgres",
    "password": "postgres",
}

# Custom app tables in FK-dependency order (Django's own tables are excluded)
TABLES = [
    "roles",
    "permissions",
    "academic_years",
    "users",
    "role_permissions",
    "semesters",
    "modules",
    "topics",
    "groups",
    "module_teachers",
    "student_groups",
    "assessments",
    "assessment_proctoring_config",
    "assessment_result_visibility",
    "assessment_targets",
    "questions",
    "choices",
    "question_keywords",
    "question_stats",
    "assessment_questions",
    "materials",
    "attempts",
    "answers",
    "answer_choices",
    "answer_keyword_analysis",
    "feedback",
    "proctoring_tab_activity",
]

# Tables with GENERATED ALWAYS AS IDENTITY id columns (need OVERRIDING SYSTEM VALUE)
IDENTITY_TABLES = {
    "roles", "permissions", "academic_years", "users", "role_permissions",
    "semesters", "modules", "topics", "groups", "module_teachers",
    "student_groups", "assessments", "assessment_questions",
    "assessment_result_visibility", "assessment_targets", "questions",
    "choices", "question_keywords", "question_stats", "materials",
    "attempts", "answers", "answer_choices", "answer_keyword_analysis",
    "feedback",
}


def migrate():
    try:
        import psycopg
    except ImportError:
        print("ERROR: psycopg not found. Run: pip install psycopg[binary]")
        sys.exit(1)

    print("Connecting to Supabase...")
    supa_conn = psycopg.connect(**SUPABASE)
    print("Connecting to local PostgreSQL...")
    local_conn = psycopg.connect(**LOCAL)

    supa = supa_conn.cursor()
    local = local_conn.cursor()

    total_rows = 0

    # Disable FK checks for the session so we can truncate/insert freely
    local.execute("SET session_replication_role = 'replica'")

    # Truncate all tables at once (reverse order isn't needed with FK checks off)
    print("Clearing local tables...")
    for table in reversed(TABLES):
        local.execute(f'TRUNCATE TABLE public."{table}" RESTART IDENTITY CASCADE')

    for table in TABLES:
        print(f"\n  [{table}]", end="", flush=True)

        # Fetch all rows from Supabase
        supa.execute(f'SELECT * FROM public."{table}"')
        rows = supa.fetchall()
        if not rows:
            print(" — empty, skipping")
            continue

        cols = [desc[0] for desc in supa.description]
        col_list = ", ".join(f'"{c}"' for c in cols)

        # Build parameterised INSERT
        placeholders = ", ".join(["%s"] * len(cols))
        if table in IDENTITY_TABLES and "id" in cols:
            sql = (
                f'INSERT INTO public."{table}" ({col_list}) '
                f'OVERRIDING SYSTEM VALUE VALUES ({placeholders})'
            )
        else:
            sql = f'INSERT INTO public."{table}" ({col_list}) VALUES ({placeholders})'

        local.executemany(sql, rows)
        print(f" — {len(rows)} rows copied")
        total_rows += len(rows)

    # Reset all sequences so new inserts don't collide with imported IDs
    print("\nResetting sequences...", flush=True)
    local.execute("""
        SELECT
            pg_get_serial_sequence(tbl.relname::text, col.attname::text) AS seq,
            tbl.relname AS tbl,
            col.attname AS col
        FROM pg_attribute col
        JOIN pg_class tbl ON tbl.oid = col.attrelid
        WHERE col.attnum > 0
          AND NOT col.attisdropped
          AND tbl.relkind = 'r'
          AND tbl.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
          AND pg_get_serial_sequence(tbl.relname::text, col.attname::text) IS NOT NULL
    """)
    seq_rows = local.fetchall()
    for seq_name, tbl_name, col_name in seq_rows:
        local.execute(
            f'SELECT setval(%s, COALESCE((SELECT MAX("{col_name}") FROM "{tbl_name}"), 1))',
            [seq_name]
        )
    print(f"  {len(seq_rows)} sequences reset")

    # Re-enable FK checks
    local.execute("SET session_replication_role = 'origin'")

    local_conn.commit()
    supa_conn.close()
    local_conn.close()

    print(f"\nDone. {total_rows} total rows migrated across {len(TABLES)} tables.")


if __name__ == "__main__":
    migrate()
