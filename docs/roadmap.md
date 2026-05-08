# Roadmap

This roadmap outlines strategic product and technical milestones for VerboTech.

## Phase 1 — Foundation

- Establish browser-based audio + vision telemetry capture.
- Implement FastAPI gateway and Celery worker architecture.
- Build initial confidence scoring pipeline with HuBERT and TCN fusion.
- Deliver session history, feedback capture, and user profile capabilities.
- Validate local development flow and document the architecture.

## Phase 2 — Production Hardening

- Migrate the backend to PostgreSQL for scalable analytics.
- Deploy the frontend to a CDN host like Vercel.
- Deploy backend and worker services to a managed cloud environment.
- Add real authentication and authorization with Firebase JWT.
- Introduce comprehensive monitoring, logging, and error tracking.

## Phase 3 — AI Maturity

- Replace heuristic calibration with learned score normalization.
- Add semantic transcription analysis and speaking structure feedback.
- Add support for multi-language confidence modeling.
- Develop model explainability outputs for each session.
- Introduce adaptive personalization and baseline drift tracking.

## Phase 4 — Growth and Differentiation

- Add team analytics and cohort performance dashboards.
- Support enterprise-grade admin controls and audit logging.
- Add mobile-first capture experiences and offline mode.
- Add integrations with calendar, learning management, and hiring platforms.

## Prioritized Technical Initiatives

1. **Production-grade deployment** — move off SQLite, use PostgreSQL and managed Redis.
2. **Observability** — expose metrics for queue latency, inference duration, and session quality.
3. **Secure auth** — enforce token-based access for both REST and WebSocket APIs.
4. **Model pipeline refinement** — move from heuristic score adjustments to model-driven calibration.
5. **Developer experience** — add CI/CD, tests, and developer onboarding documentation.

## Long-Term Vision

- VerboTech becomes the platform for actionable speaking feedback at scale.
- The platform supports live coaching, interview training, and executive presence analytics.
- The underlying multimodal pipeline evolves into a general-purpose confidence and engagement engine.
- The product delivers measurable improvement across public speaking, sales, and leadership training.
