# UC03 — Report Wildlife and Poaching Incident

**Owner:** KALMADU H L G (IT23701014) · **Branch:** `feature/incident-reporting`

Implemented as a ranger-only, idempotent reporting module using the project's layered architecture.

## Backend

- `WildlifeIncident` stores the report and has a unique `clientId`.
- `IncidentPhoto` stores photo data separately, so list/detail responses stay lightweight.
- `incident.service.js` owns time, park/zone, ownership, idempotency and alert rules.
- Actionable incidents call the shared `alertService.raise` inside the same transaction.
- An identical retry returns the stored incident; different data with the same id returns `CLIENT_ID_REUSED`.

Routes:

- `POST /api/incidents`
- `GET /api/incidents/mine`
- `GET /api/incidents/:id`

## Frontend and offline behaviour

The screens live in `frontend/src/features/incidents`. A three-step mobile form saves reports and compressed photos to a user-scoped Dexie database before uploading. The queue retries automatically while the app is open and online and also provides manual retry. `vite-plugin-pwa` precaches the application shell; authenticated API responses are not cached by the service worker.

See `docs/design/UC03-incident-reporting.md` for the development plan and accepted limitations.
