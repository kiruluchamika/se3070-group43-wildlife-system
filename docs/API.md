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

### UC01 Conflict response (WITTAHACHCHI D.K.G)

See [design/UC01-conflict-response.md](design/UC01-conflict-response.md) for the rules. Officers and managers with a home park only see that park (`OUTSIDE_ASSIGNED_PARK`); villagers only their own reports (`NOT_REPORT_OWNER`); rangers only their team's tasks (`NOT_TEAM_MEMBER`).

| Method | Path | Roles | Body / query | Result |
|---|---|---|---|---|
| POST | `/api/conflicts` | villager | `{ parkId, conflictType, village, landmark?, occurredAt, description, contactName, contactPhone, location?, immediateDanger?, damage?, evidence?[] }` | 201 `{ report }` with `reference`, `suggestedPriority`, `locationAdequate`. 400 when crop/property damage lacks damage fields |
| GET | `/api/conflicts/mine` | villager | — | `{ reports }` (photo data left out) |
| PATCH | `/api/conflicts/:id/information` | villager (owner) | `{ response, landmark?, location? }` | A3 reply. 409 `INFORMATION_NOT_REQUESTED` |
| GET | `/api/conflicts/:id` | villager (owner), liaison-officer, park-manager, ranger (assigned team) | — | `{ report, tasks, actions, suggestedReview }` |
| GET | `/api/conflicts?view=new|pending-information|active|review|closed|all&parkId=` | liaison-officer | — | `{ park, view, reports, counts }` |
| PATCH | `/api/conflicts/:id/validation` | liaison-officer | `{ decision: valid|invalid, priority?, notes? }` | 422 `LOCATION_INADEQUATE`, 409 `INVALID_TRANSITION` / `CONCURRENT_UPDATE` |
| PATCH | `/api/conflicts/:id/information-request` | liaison-officer | `{ message }` | A3 |
| GET | `/api/conflicts/:id/duplicates` | liaison-officer | — | `{ candidates: [{ report, match: { rule, distanceKm } }] }` |
| PATCH | `/api/conflicts/:id/duplicate` | liaison-officer | `{ primaryReportId, notes? }` | A4. 422 `SELF_LINK`, `PARK_MISMATCH`, `PRIMARY_CLOSED` |
| GET | `/api/conflicts/:id/teams` | liaison-officer | — | `{ route, available[], busy[], recommended }` with `distanceKm` / `etaMinutes` |
| POST | `/api/conflicts/:id/deployments` | liaison-officer | `{ teamId, instructions?, additionalResources? }` | 201 `{ task, route: direct|approval|emergency }`. 409 `TEAM_NOT_AVAILABLE`, `TASK_EXISTS`, `REPORT_NOT_DEPLOYABLE` |
| PATCH | `/api/conflicts/:id/escalation` | liaison-officer | `{ reason }` | A5. Raises a UC04 alert (`source: conflict-report`) |
| PATCH | `/api/conflicts/:id/review` | liaison-officer | `{ result: resolved|monitoring|escalated, notes?, followUpAt? }` | 409 `REVIEW_NOT_READY`, 422 `FOLLOW_UP_IN_PAST` |
| POST | `/api/conflicts/:id/contact-retry` | liaison-officer | — | E3 `{ reached, attempts, report }` |
| POST | `/api/conflicts/:id/alternative-contact` | liaison-officer | `{ method, contactedPerson?, notes }` | E2 |
| GET | `/api/response-tasks/approvals?parkId=` | park-manager | — | `{ tasks }` awaiting approval |
| PATCH | `/api/response-tasks/:id/approval` | park-manager | `{ decision: approve|reject, teamId?, notes? }` | Reject needs `notes`. 409 `APPROVAL_ALREADY_DECIDED`, `TEAM_NOT_AVAILABLE` |
| GET | `/api/response-tasks/mine` | ranger | — | `{ team, tasks }`, each task with its `actions` |
| PATCH | `/api/response-tasks/:id/acknowledge` | ranger (team member) | — | Repeating is harmless |
| POST | `/api/response-tasks/:id/actions` | ranger (team member) | `{ clientUpdateId, type, note?, location?, recordedAt, recordedOffline? }` | 201 new, 200 `{ duplicate: true }` for a retried id. 409 `TASK_CLOSED`, `CLIENT_ID_REUSED` |
| PATCH | `/api/response-tasks/:id/complete` | ranger (team member) | `{ clientUpdateId, outcome, notes?, completedAt }` | Frees the team; idempotent per `clientUpdateId`. 409 `TASK_ALREADY_COMPLETED` |
- **UC02 Analysis and reports (JALATHGE C.A.J):** *to be added*

### UC03 Incident reporting (KALMADU H L G)

See [design/UC03-incident-reporting.md](design/UC03-incident-reporting.md) for the offline and idempotency rules. All routes are ranger-only. Incident list/detail responses contain photo metadata but never the stored photo data URLs.

| Method | Path | Roles | Body / query | Result |
|---|---|---|---|---|
| POST | `/api/incidents` | ranger | `{ clientId, parkId, zoneId?, type, severity?, description, observedAt, deviceCreatedAt, location?, locationNote?, recordedOffline?, photos?[] }` | `201` `{ incident, alert, duplicate: false }`; an identical retry returns `200` with `duplicate: true`. Reusing the client id for different data returns `409 CLIENT_ID_REUSED` |
| GET | `/api/incidents/mine` | ranger | — | `{ incidents }`, newest observation first |
| GET | `/api/incidents/:id` | ranger (owner) | — | `{ incident, photos }`; another ranger receives `404 INCIDENT_NOT_FOUND` |
