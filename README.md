# UpHill
AI-powered personal operating system that combines planning, habit tracking, and behavioral analysis to improve discipline and execution.

**Live app:** [up-hill-three.vercel.app](https://up-hill-three.vercel.app)

## Running locally

**Option A — Docker Compose** (Mongo, backend, and frontend together):

```bash
docker compose up
```

Frontend: http://localhost:5173 · Backend: http://localhost:5000. The backend reads secrets (`JWT_SECRET`, `GEMINI_API_KEY`) from `backend/.env` — copy `backend/.env.example` first if you don't have one.

**Option B — bare metal** (requires a local or remote MongoDB):

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR: a backend smoke check (every route/model/middleware module must load cleanly) and a frontend lint + production build.
