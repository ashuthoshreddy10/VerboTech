# Contributing

This document defines the contribution workflow and quality expectations for VerboTech.

## Contribution Principles

VerboTech follows a culture of clean code, clear architectural intent, and collaborative review.

- Keep changes scoped and incremental.
- Prefer readability over cleverness.
- Document any architectural changes in `docs/architecture.md`.
- Ship features with tests, or clearly note why a test cannot be added.

## Branching Strategy

- `main` — production-ready code.
- `develop` — integration branch for in-progress work.
- feature branches — `feature/<area>-<short-description>`.
- bugfix branches — `bugfix/<issue>-<short-description>`.

## Pull Request Workflow

1. Create a branch from `main` or `develop`.
2. Push your branch to the repository.
3. Open a PR with:
   - summary of changes
   - architecture impact
   - testing performed
   - deployment considerations
4. Request reviews from at least one backend and one frontend engineer for cross-cutting changes.
5. Address review feedback and iterate.

## Coding Standards

### Backend

- Use Python 3.11 idioms.
- Prefer explicit typing and Pydantic models.
- Keep API routes thin.
- Put inference and business logic into `workers/` and `ml/` modules.
- Keep database schema changes backward compatible.

### Frontend

- Follow React functional component patterns.
- Keep logic in `src/utils/` for telemetry and reuse.
- Keep presentation in `src/screens/`.
- Use descriptive variable names and avoid deep nesting.

## Testing and Validation

- Run frontend `npm run lint` and unit tests if available.
- Run backend linting and validation with your preferred Python tooling.
- Test WebSocket paths and REST endpoints locally.

## Issue Reporting

When opening an issue, include:

- a concise title
- reproduction steps
- expected behavior
- actual behavior
- any error logs or screenshots

## Documentation Updates

If you modify system behavior, update the documentation in one or more of the following files:

- `docs/architecture.md`
- `docs/api.md`
- `docs/ml-pipeline.md`
- `docs/deployment.md`
- `README.md`

## Release Notes

Include a short changelog summary in each PR. Highlight:

- new features
- bug fixes
- architecture changes
- deployment and environment updates
