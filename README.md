# Assessment Platform

Full-stack assessment and exam management platform with:

- `frontend/`: React + Vite UI
- `backend/`: Django REST backend
- `services/ai_mvp/`: Flask AI helper service
- `docs/`: project notes, guidelines, and attribution files
- `scripts/`: maintenance and verification helpers

## Repository Layout

```text
assessment_platform/
|-- frontend/
|   |-- index.html
|   |-- vite.config.ts
|   `-- src/
|-- backend/
|-- services/
|   `-- ai_mvp/
|-- docs/
`-- scripts/
```

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- PostgreSQL for the Django backend

## Frontend

Install dependencies from the repository root:

```bash
npm install
```

Run the Vite app:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Backend

Create a virtual environment, install Django dependencies, and run the API:

```bash
cd backend
pip install -r requirements.txt
python manage.py runserver
```

The backend reads its environment from the root or backend `.env` file via `python-dotenv`.

## AI Service

The AI microservice lives in `services/ai_mvp/` and exposes:

- `POST /api/ai/generate`
- `POST /api/ai/evaluate`

Start it separately when you want AI-assisted question generation or evaluation:

```bash
cd services/ai_mvp
pip install -r requirements.txt
python app.py
```

## Helpful Scripts

- `scripts/check_db.py` inspects the Django database tables
- `scripts/test_api.py` sends a quick POST request to the backend admin module endpoint

## Notes

- The frontend dev server proxies `/api` requests to `http://127.0.0.1:8000`.
- Update `AI_SERVICE_URL` if your Flask service is not running on `http://127.0.0.1:5000`.
- Backend SQL schema and patch files live under `backend/` for reference and database setup.
