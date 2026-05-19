# Supabase → Local PostgreSQL Migration Report

**Date:** 2026-05-12  
**Project:** Assessment Platform (Django + React)  
**Performed by:** Claude Code

---

## Summary

Migrated the Django backend database connection from Supabase (cloud-hosted PostgreSQL) to a local portable PostgreSQL 16 instance. Zero code refactoring was required — only configuration files changed.

---

## What Changed

### 1. `backend/.env` — Database connection

**Before (Supabase):**
```
DB_NAME=postgres
DB_USER=postgres.kbmgahdyzkrejlmefkkg
DB_PASSWORD=957asgVOdor4eA9W
DB_HOST=aws-1-eu-west-1.pooler.supabase.com
DB_PORT=5432
```

**After (local):**
```
DB_NAME=assessment_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5433
```

Port 5433 (instead of the default 5432) was chosen to avoid future conflicts if a system-wide PostgreSQL is ever installed.

---

### 2. `backend/config/settings.py` — SSL removed

**Before:**
```python
"OPTIONS": {
    "sslmode": "require",
},
```

**After:** (deleted — local connections don't use SSL)

Supabase requires SSL for all remote connections. A local server running on localhost doesn't, and `psycopg` raises an error if `sslmode=require` is sent to a server that doesn't have SSL configured.

---

### 3. Virtual environment — `psycopg[binary]` added

The project uses `psycopg==3.3.3` (pure package). This package needs `libpq.dll` (the PostgreSQL C client library) to be discoverable on the system PATH at runtime. Without the binary extra, every developer machine would need a PostgreSQL install just for the client library.

```
pip install psycopg[binary]==3.3.3
```

`psycopg[binary]` bundles a pre-compiled `libpq` inside the wheel so no PATH manipulation is needed. The pure `psycopg` package is also still installed (it's the base dependency) — the binary extra simply provides the missing C library.

---

## New Files Created

| File | Purpose |
|---|---|
| `backend/local_schema.sql` | Custom application tables in correct FK-dependency order. Run this to recreate the schema from scratch. |
| `backend/seed_data.sql` | Minimum seed data: roles (ADMIN, TEACHER, STUDENT). |
| `start_local.bat` | One-click startup: starts PostgreSQL then Django. |
| `stop_local.bat` | Gracefully stops the PostgreSQL server. |

---

## PostgreSQL Setup (portable — no admin required)

Location: `C:\Users\chaab\postgresql16\`

```
postgresql16/
├── pgsql/          ← PostgreSQL 16 binaries (EDB zip, no installer needed)
│   ├── bin/        ← postgres.exe, pg_ctl.exe, psql.exe, etc.
│   ├── lib/        ← DLL libraries
│   └── share/      ← SQL templates (required by initdb)
├── data/           ← Database cluster (created by initdb)
├── pg.log          ← Server log file
└── pg16.zip        ← Original download (can be deleted to save space)
```

**Commands used:**

```bat
REM 1. Initialize cluster (one-time, already done)
pgsql\bin\initdb.exe -D data -U postgres -A trust --encoding=UTF8

REM 2. Start server
pgsql\bin\pg_ctl.exe -D data -l pg.log -o "-p 5433" start

REM 3. Stop server
pgsql\bin\pg_ctl.exe -D data stop
```

`-A trust` means local connections don't need a password. This is fine for local development but must NOT be used in production.

---

## Database Details

| Property | Value |
|---|---|
| Database | `assessment_db` |
| Superuser | `postgres` |
| Password | `postgres` (trust auth, password is ignored locally) |
| Host | `localhost` |
| Port | `5433` |

**Application admin account:**
- Email: `admin@ensia.edu.dz`
- Password: `admin1234`

---

## Why It Worked Without Code Refactoring

The key architectural decision that made this trivial was that **all Django models have `managed = False`**. This means Django's ORM is purely a query interface — it does not own or manage the database schema. The schema was managed by Supabase via raw SQL.

This means:
1. No Django migrations needed to be written or deleted
2. The models map directly to existing table names
3. All we needed to do was point the connection string at a different host

The only required steps were:
- New connection credentials in `.env`
- Remove SSL requirement from `settings.py`
- Recreate the schema in the local database using `local_schema.sql`
- Run `python manage.py migrate` for Django's own internal tables (sessions, admin log, content types, permissions) — these are the only tables Django manages

---

## Why It Could Have Been Harder

In other scenarios, this migration would have been significantly more complex:

1. **If models had `managed = True`** (the default): Django owns the schema via migrations. Migrating to a new database would require running all migrations against the new database. If there were hundreds of migrations, this could take minutes and might hit version-specific issues.

2. **If Supabase-specific features were used**: Row Level Security (RLS), Supabase Edge Functions, Supabase Storage, Supabase Auth (separate from Django auth), PostgREST auto-generated APIs, or Supabase Realtime would all break because these are Supabase-only features that vanilla PostgreSQL doesn't have.

3. **If data needed to be migrated**: The `retrieve_role_based_and_assessment_data.sql` snippet mentioned in the request appears to be a Supabase data export query (for migrating existing rows). We did NOT import existing data — we started with a fresh database. If you need the existing data (users, assessments, questions, etc.) from Supabase, use pg_dump on the Supabase database and pg_restore locally.

4. **If `psycopg2` (not `psycopg` v3) was used**: `psycopg2-binary` bundles libpq but `psycopg2` (non-binary) requires a full PostgreSQL dev install with headers. The project wisely uses `psycopg` v3 which has a cleaner binary distribution story.

5. **If connection pooling (PgBouncer) was configured**: Supabase's pooler changes some behaviors around `SET LOCAL` transactions and prepared statements. Code written specifically for pooled connections may need adjustments when connecting to a non-pooled local server.

---

## How to Use Tomorrow

### Starting the app
Double-click `start_local.bat` (or run it in a terminal):
```bat
start_local.bat
```
This starts PostgreSQL on port 5433, then starts Django on port 8000.

### If PostgreSQL is already running (e.g., second terminal)
```bat
cd backend
python manage.py runserver
```

### Stopping PostgreSQL
```bat
stop_local.bat
```

### Connecting to the database directly (for debugging)
```bat
%USERPROFILE%\postgresql16\pgsql\bin\psql.exe -h localhost -p 5433 -U postgres -d assessment_db
```
