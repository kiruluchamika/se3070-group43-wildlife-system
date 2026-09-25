# WildGuard API

Base URL: `/api` (frontend `VITE_API_URL`). Every request and response body is JSON.

## Conventions

- **Authentication.** Send `Authorization: Bearer <token>`. The token comes from `/api/auth/login` or `/api/auth/register` and expires after `JWT_EXPIRES_IN` (default 8h).
- **Errors.** Every failure returns the same format:
  ```json
  { "message": "Human-readable explanation", "code": "MACHINE_CODE", "details": [{ "field": "email", "message": "…" }] }
  ```
  | Status | Meaning |
  |---|---|
  | 400 | Validation error (`VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_ID`) |
  | 401 | Not signed in, or the session expired |
  | 403 | Your role is not permitted (`ACCESS_DENIED`) |
  | 404 | Record not found |
  | 409 | State conflict: someone else changed the record, or the action is not allowed in its current state |
  | 422 | A business rule was violated |
  | 500 | Unexpected server error |
- **Ids.** Responses use `id`, never `_id`. Ids are 24-character hexadecimal strings.
- **Roles.** `villager`, `ranger`, `liaison-officer`, `park-manager`, `data-analyst`. The backend checks the role on every route; hiding a button is not enough.

## Shared endpoints

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/health` | public | Health check |
| POST | `/api/auth/register` | public | `{ name, email, password, phone? }`. Always creates a **villager** |
| POST | `/api/auth/login` | public | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | any | The current user |
| GET | `/api/parks` | any | Parks, including each park's `coveragePolicy` |
| GET | `/api/teams?parkId=` | park-manager, liaison-officer, data-analyst | Ranger teams with their status and members |
| GET | `/api/alerts?parkId=&status=open\|all\|active\|acknowledged\|dispatched\|resolved` | park-manager | Alerts, most severe first |
| PATCH | `/api/alerts/:id/acknowledge` | park-manager | Changes an alert from active to acknowledged |
| GET | `/api/notifications/me` | any | `{ notifications, unreadCount }` |
| PATCH | `/api/notifications/:id/read` | any | Marks one notification as read |
| PATCH | `/api/notifications/read-all` | any | Marks all notifications as read |

## Module endpoints

Each member documents their own endpoints below, using the same table format.

### UC04 Patrol management (HETTIGE K.C.)

See [design/UC04-patrol-management.md](design/UC04-patrol-management.md) for the rules.

| Method | Path | Roles | Body / query | Result |
|---|---|---|---|---|
| GET | `/api/patrol/coverage?parkId=` | park-manager | — | `{ park, policy, generatedAt, summary, zones[], routes[], teams[] }`. Each zone has `status`, `coveragePercent`, `hoursSinceLastPatrol`, `effectiveRisk`, `reasons`, `recommendedAction`, `priorityScore` |
| GET | `/api/patrol/teams?parkId=&zoneId=` | park-manager | — | Teams with `currentAssignment`, plus `distanceKm` / `etaMinutes` to the zone |
| GET | `/api/patrol/assignments?parkId=` | park-manager | — | Active assignments |
| POST | `/api/patrol/assignments` | park-manager | `{ zoneId, teamId, notes? }` | 201 `{ assignment, team, zone }`. 409 `TEAM_NOT_AVAILABLE`, 422 `TEAM_PARK_MISMATCH` |
| POST | `/api/patrol/assignments/reassign` | park-manager | `{ zoneId, teamId, reason, notes?, override? }` | 201 `{ assignment, team, zone, vacatedZone }`. 409 `PRIORITY_DOWNGRADE`, `TEAM_RESPONDING`, `SAME_ZONE`, `TEAM_IS_AVAILABLE` |
| PATCH | `/api/patrol/assignments/:id/complete` | park-manager | — | Ends the patrol, records it and frees the team |
| PATCH | `/api/patrol/assignments/:id/acknowledge` | ranger (team member) | — | 403 `NOT_TEAM_MEMBER` |
| GET | `/api/patrol/my-assignment` | ranger | — | `{ team, assignment }` |
| GET | `/api/patrol/emergency-dispatches/recommendations?alertId=` | park-manager | — | `{ alert, mode (available / divert / none), recommended, available[], divertible[] }` |
| POST | `/api/patrol/emergency-dispatches` | park-manager | `{ alertId, teamId?, notes? }` | 201 `{ dispatch, assignment, team, alert, diverted }`. 409 `NO_TEAM_AVAILABLE`, 422 `ALERT_NOT_ELIGIBLE` |
| GET | `/api/patrol/decisions?parkId=` | park-manager | — | Allocation history, newest first |

- **UC01 Conflict response (WITTAHACHCHI D.K.G):** *to be added*
- **UC02 Analysis and reports (JALATHGE C.A.J):** *to be added*
- **UC03 Incident reporting (KALMADU H L G):** *to be added*
