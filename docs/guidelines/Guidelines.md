# Project Guidelines

## Frontend

- Keep UI components small and reusable.
- Prefer responsive layout primitives such as flexbox and grid.
- Keep route, page, and component names descriptive.
- Avoid introducing extra dependencies unless they solve a clear problem.

## Backend

- Keep Django app responsibilities separated by domain.
- Put API behavior in views or service helpers, not in models.
- Prefer explicit request validation and clear error messages.
- Keep SQL scripts and schema changes under `backend/`.

## AI Service

- Treat the Flask service as a separate runtime from Django.
- Keep request and response payloads stable because the backend proxies them.
- Update README instructions whenever the service location or port changes.

## Repository Hygiene

- Put reusable scripts in `scripts/`.
- Put documentation in `docs/`.
- Avoid committing generated files such as local databases or build output.
