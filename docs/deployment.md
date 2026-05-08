# Deployment

This document outlines the recommended production deployment strategy for VerboTech, including environment topology, containerization, scaling, monitoring, and CI/CD.

## Production Architecture

VerboTech splits into two production services:

1. **Frontend** — static React assets served from a CDN or edge host.
2. **Backend** — FastAPI gateway with Celery workers and persistent storage.

**Recommended production components**

- Frontend: Vercel, Netlify, or Cloudflare Pages
- Backend: Render, Fly.io, AWS ECS / Fargate, or Google Cloud Run
- Database: PostgreSQL
- Broker: Redis (managed service)
- Artifact storage: AWS S3, GCP Cloud Storage, or Azure Blob
- Logging/monitoring: Datadog / New Relic / Prometheus + Grafana

## Deployment Topology

```mermaid
flowchart LR
  subgraph CDN
    FE[React Static Site]
  end
  subgraph API
    API[FastAPI Gateway]
    Redis[Redis Broker]
    PG[PostgreSQL]
    Worker[Celery Worker Pool]
  end
  subgraph Storage
    S3[Blob Storage]
  end

  FE -->|REST/WebSocket| API
  API -->|Queue| Redis
  Worker -->|Read/Write| PG
  Worker -->|Artifacts| S3
  API -->|Metadata| PG
```

## Production Deployment Instructions

### Option 1: Docker + Docker Compose

A containerized deployment provides repeatable infrastructure and simpler local parity.

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: verbotech
      POSTGRES_PASSWORD: changeme
      POSTGRES_DB: verbotech
    ports:
      - 5432:5432

  backend:
    build: ./confidence-backend
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ./confidence-backend:/app
    environment:
      REDIS_URL: redis://redis:6379/0
      DATABASE_URL: postgres://verbotech:changeme@db:5432/verbotech
    ports:
      - 8000:8000
    depends_on:
      - redis
      - db

  worker:
    build: ./confidence-backend
    command: celery -A workers.celery_app worker --loglevel=info
    environment:
      REDIS_URL: redis://redis:6379/0
      DATABASE_URL: postgres://verbotech:changeme@db:5432/verbotech
    depends_on:
      - redis
      - db
```

### Option 2: Managed Hosting

- Frontend: deploy `confidence-speaker` on Vercel using `npm run build`
- Backend: deploy `confidence-backend` on Render or Cloud Run with `uvicorn main:app`
- Workers: deploy as separate worker services using the same `confidence-backend` image
- Redis: use managed Redis (e.g. AWS ElastiCache, Redis Cloud)
- Database: use managed PostgreSQL for reliability

## Build and Release Workflow

1. Build frontend artifacts
   - `cd confidence-speaker && npm ci && npm run build`
2. Build backend container
   - `cd confidence-backend && docker build -t verbo-backend .`
3. Deploy backend and worker services separately
4. Connect backend to managed Redis and PostgreSQL
5. Validate the `/` health endpoint and WebSocket flow

## CI/CD Recommendations

A mature pipeline should include:

- **Linting** — ESLint for frontend, Python linting for backend.
- **Type & schema validation** — React type checking and Pydantic model validation.
- **Security scanning** — dependency vulnerability checks for `npm` and Python.
- **Integration tests** — API smoke tests and WebSocket smoke tests.
- **Artifact publishing** — frontend build artifacts deployed to CDN.
- **Deployment gating** — require passing pipeline before production.

## Monitoring and Logging

### Backend telemetry

- Use structured logs for API request IDs, session IDs, and errors.
- Capture WebSocket connection lifecycle events.
- Publish metrics for queue length, task latency, and inference duration.

### Worker observability

- Monitor Celery task success, retry, and failure rates.
- Observe Redis queue depth and worker availability.
- Track model inference time and backpressure.

### Suggested tools

- Prometheus + Grafana
- Sentry or Rollbar
- Datadog or New Relic
- Loki for centralized log storage

## Performance Optimization

- Serve frontend statically from edge CDN.
- Enable HTTP/2 and TLS termination at the load balancer.
- Use a managed Redis for low-latency queueing.
- Consider model distillation or ONNX export for inference.
- Cache static metadata and session lookup queries.

## Troubleshooting

### Common issues

- `WebSocket failed to connect`
  - verify backend host, CORS config, and firewall rules.
- `Celery worker not processing tasks`
  - verify `REDIS_URL`, worker logs, and queue status.
- `Database connection refused`
  - verify `DATABASE_URL` and database readiness.
- `Static frontend assets missing`
  - confirm frontend build output and deployment path.

### Debugging checklist

1. Confirm backend reachable at `http://<host>:8000/`
2. Confirm Redis is reachable from backend and worker
3. Confirm worker logs show `process_multimodal_session` execution
4. Validate `POST /api/sessions` and `GET /api/sessions/{user_id}`

## Production Hardening

- Use secrets management for all keys and database credentials.
- Enforce HTTPS across all endpoints.
- Apply rate limiting to the gateway.
- Separate analytics storage from operational storage.
- Add feature flags for experimental ML pipelines.
