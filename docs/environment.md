# Environment Variables

This document describes the environment variables used by VerboTech in development and production.

## Frontend Variables

The frontend uses Vite environment variables and expects them to be prefixed with `VITE_`.

| Variable | Description | Required | Example |
|---|---|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase project API key for authentication and app initialization | yes | `AIza...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | yes | `verbotech-a6953.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | yes | `verbotech-a6953` |
| `VITE_FIREBASE_APP_ID` | Firebase application identifier | yes | `1:290443785030:web:...` |

## Backend Variables

| Variable | Description | Required | Example |
|---|---|---|---|
| `REDIS_URL` | Redis broker URL for Celery tasks | yes | `redis://localhost:6379/0` |
| `DATABASE_URL` | SQLAlchemy connection string for session persistence | yes | `sqlite:///./confidence.db` or `postgresql://user:pass@host:5432/db` |
| `ENVIRONMENT` | Deployment environment name | no | `development`, `staging`, `production` |
| `AWS_S3_BUCKET` | S3 bucket name for raw session artifact storage | no | `verbotech-artifacts` |
| `AWS_ACCESS_KEY_ID` | AWS access key ID for object storage | no | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key for object storage | no | `*****` |
| `JWT_SECRET` | Secret used for signing auth tokens in future secured endpoints | no | `super-secret-key` |

## Recommended Environment Setup

### Frontend

Create a local environment file in `confidence-speaker`:

```env
VITE_FIREBASE_API_KEY=<your-firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<your-firebase-auth-domain>
VITE_FIREBASE_PROJECT_ID=<your-firebase-project-id>
VITE_FIREBASE_APP_ID=<your-firebase-app-id>
```

### Backend

Save backend runtime configuration in `confidence-backend/.env` or in a secure secrets store:

```env
REDIS_URL=redis://localhost:6379/0
DATABASE_URL=sqlite:///./confidence.db
ENVIRONMENT=development
```

## Secrets Management

- Do not commit `.env` files to source control.
- Use `.gitignore` to exclude local secrets.
- In production, store credentials in a managed secrets service (AWS Secrets Manager, GCP Secret Manager, or similar).

## Notes on Local Defaults

- The repository currently uses SQLite for local development.
- Production deployments should migrate to PostgreSQL.
- Redis is required for asynchronous worker orchestration and should be available at `REDIS_URL`.

## Future Environment Variables

Future production-ready builds may include:

- `SENTRY_DSN` for crash and error reporting
- `PROMETHEUS_URL` for metrics export
- `FIREBASE_DATABASE_URL` for Firebase-backed session sync
- `MODEL_CACHE_PATH` for storing loaded model weights locally
