# Setup & Onboarding

This guide helps new engineers get VerboTech running locally and understand the developer workflow.

## Prerequisites

- Windows / macOS / Linux
- Node.js 20.x or newer
- npm 10.x or newer
- Python 3.11
- Git
- Redis for local worker queueing

## Local Environment Setup

### 1. Clone the repository

```bash
git clone https://github.com/ashuthoshreddy10/VerboTech.git
cd VerboTech
```

### 2. Backend setup

```powershell
cd confidence-backend
python -m venv ..\.venv
..\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 3. Frontend setup

```bash
cd ../confidence-speaker
npm install
```

### 4. Redis setup

- Install Redis locally or use Docker.
- Start Redis on `localhost:6379`.

### 5. Environment variables

Copy the frontend `.env` file and configure runtime secrets.

```bash
cd ../confidence-speaker
copy .env .env.local
```

Then confirm the following values:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

For backend development, create a `.env` file with:

```env
REDIS_URL=redis://localhost:6379/0
DATABASE_URL=sqlite:///./confidence.db
ENVIRONMENT=development
```

## Running Locally

### Start the backend

```powershell
cd confidence-backend
..\.venv\Scripts\Activate.ps1
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Start the frontend

```bash
cd ../confidence-speaker
npm run dev -- --host 0.0.0.0
```

### Start the worker

```powershell
cd confidence-backend
..\.venv\Scripts\Activate.ps1
..\.venv\Scripts\python.exe -m celery -A workers.celery_app worker --loglevel=info
```

## Developer Onboarding Instructions

### First day checklist

- [ ] Review `docs/architecture.md`
- [ ] Run the frontend and backend locally
- [ ] Validate WebSocket connectivity and API health
- [ ] Inspect `workers/tasks.py` and the fusion model design
- [ ] Explore `confidence-speaker/src/utils` for telemetry capture logic

### Recommended workflow

1. Create a feature branch from `main`
2. Run linting and tests locally
3. Open a pull request with summary, architecture impact, and testing notes
4. Seek review from one backend and one frontend engineer

## Key Local Commands

| Area | Command | Purpose |
|---|---|---|
| Frontend | `npm run dev -- --host 0.0.0.0` | Start dev server |
| Backend | `uvicorn main:app --reload --host 0.0.0.0 --port 8000` | Start API |
| Worker | `celery -A workers.celery_app worker --loglevel=info` | Start Celery worker |
| Backend | `pip install -r requirements.txt` | Install backend deps |
| Frontend | `npm install` | Install frontend deps |

## Onboarding Notes for Engineers

- `confidence-backend/main.py` is the gateway entrypoint.
- `workers/tasks.py` contains the core asynchronous scoring workflow.
- `ml/models/fusion.py` is the prototype multimodal fusion model.
- `confidence-speaker/src/screens/` contains the main user experiences.
- `confidence-speaker/src/utils/` contains capture and analytics helpers.

## Recommended Local Improvements

- Enable a local `.env.example` file for both frontend and backend.
- Add `prestart` and `test` scripts for consistency.
- Add a `docker-compose.override.yml` for local developer tooling.
