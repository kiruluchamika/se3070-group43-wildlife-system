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

### UC02 Analysis retrieval (Stage 2)

| Method | Path | Roles | Query | Result |
|---|---|---|---|---|
| GET | `/api/analytics/options` | data-analyst | None | `{ parks, incidentTypes, species: [{ id, label }] }`; parks restricted to the current account's assigned park, or all parks if none is assigned |
| GET | `/api/analytics` | data-analyst | Required `parkId`, `startDate`, `endDate` (YYYY-MM-DD); optional `incidentType`, `species` | `{ filters, retrievedAt, period, park, zones, records: { alerts, conflicts, patrolRecords }, freshness, limitations }` |

Dates include both days in Asia/Colombo. Linked UC03 alerts use the incident
`observedAt`; conflicts use their actual event field `occurredAt`; patrols use
`startTime` within the selected interval. Camera/collar and unlinked legacy
alerts retain `createdAt` because no separate event time exists. Alert projections
include derived `eventAt`; `dateBasis` states this mapping on screen and in new
report snapshots. No source timestamp is rewritten. Incident type restricts
alerts/conflicts only. Species is an optional normalized name (maximum 80
characters); a selected species matches structured Alert.species and excludes
conflicts without species. Empty species includes unspecified records. Invalid
filters return 400. Unauthorized park selection returns 403;
unknown parks return 404; over 5,000 matches in a source returns 422
`ANALYTICS_RANGE_TOO_LARGE`. Records are never silently truncated.

`freshness.requiresConfirmation` is true only for retrieved patrol records
explicitly marked `syncStatus: pending`. The modal displays their source and
last successful sync as "Not recorded", since no such timestamp exists on
that model. Camera/GPS alert freshness is unknown; age alone never warns.
No report endpoints or analysis calculations are implemented in Stage 2.

### UC02 Conservation reports (Stage 7)

| Method | Path | Role | Input | Result |
|---|---|---|---|---|
| POST | `/api/reports` | data-analyst | `{ requestId: UUID, status: draft\|finalized, title, findings, recommendations, snapshot, replaceDraft?: { id, revision } }` | 201 `{ report }`; identical retries return the same report |
| GET | `/api/reports?page=1&status=draft` | data-analyst, park-manager | Page (default 1), optional status (`draft` or `finalized`), filtered before pagination | `{ reports, page, hasMore }`, 20 summaries per page |
| GET | `/api/reports/:id` | data-analyst | Report ID | `{ report }`, including its saved analysis snapshot |

Analysts access owned reports, further restricted by their current assigned
park. Deleted accounts and changed roles are rechecked. Managers cannot access
unshared reports. Unsupported status, blank/overlong title, overlong narratives,
inconsistent filters/period/park or invalid source references return 400. Reusing
a request ID for different content/status returns 409 `REPORT_SAVE_CONFLICT`.
Missing/not-owned reports return 404. Server-generated ownership and timestamps
cannot be supplied by clients. Draft has `finalizedAt: null`; Finalized records
the server's finalization time. Finalized report content is read-only. Stage 9
adds the sharing/export endpoints below.

`snapshot` contains context, statistics, analysis (trends/hotspots/coverage), and
`sourceReferences`. It preserves the analyst-submitted calculation, not a fresh
query of changing source records. Narrative fields are plain text. Title limit:
200 characters; findings/recommendations: 5,000 each. The frontend rejects save
payloads over 950,000 UTF-8 bytes rather than truncating; the API retains its 1 MiB
JSON limit. See the analytics README and `conservation-report.schemas.js` for the
bounded snapshot contract and traceability limitations.

### UC02 Draft editing and re-analysis (Stage 8)

| Method | Path | Role | Input | Result |
|---|---|---|---|---|
| PATCH | `/api/reports/:id` | data-analyst | `{ title, findings, recommendations, revision }` | `{ report }`, still Draft; increments revision |
| GET | `/api/reports/:id/reanalysis` | data-analyst | Report ID | `{ draft: { id, revision, title, filters } }` from the saved snapshot; no writes |

Both require current ownership and permitted-park access. Finalized reports
return 409 `REPORT_READ_ONLY`; missing/not-owned reports return 404. PATCH rejects
extra fields, invalid revision, blank title, title over 200 or narrative over
5,000 characters. It cannot change status, filters or analysis results. Drafts
created before Stage 8 start at revision 0. Stale concurrent edits return 409
`DRAFT_CHANGED`; an identical immediately preceding retry is safe.

Re-analysis restores editable filters into the normal analytics flow. Draft
Save as Finalized and re-analysis Preview saves use POST `/api/reports` with
`replaceDraft: { id, revision }`. Creation of the replacement and deletion of the
original Draft commit in one transaction, after checking ownership, all original
and selected parks, Draft status and revision. Cancellation or failure preserves
the original. Identical retries return the replacement; retired creation keys are
retained internally to prevent delayed retries resurrecting old Drafts. Omitting
`replaceDraft` preserves normal new-report creation. No finalized report can be
replaced. Status filtering applies before pagination for both roles; managers
still only receive explicitly shared finalized reports.

### UC02 Finalized sharing and export (Stage 9)

| Method | Path | Role | Input/result |
|---|---|---|---|
| GET | `/api/reports/:id/recipients` | owning data-analyst | `{ managers: [{ id, name }] }`, active same-park and park-unassigned managers |
| POST | `/api/reports/:id/share` | owning data-analyst | `{ recipients: [managerId, ...] }` (1–100); returns `{ sharedCount, newlySharedCount }` |
| GET | `/api/reports/:id/export` | owning data-analyst or shared park-manager | `application/pdf`, downloadable attachment generated from the saved snapshot |

All require authentication, current-role/park authorization and Finalized status.
Draft requests return 409 `REPORT_NOT_FINALIZED`. Invalid recipient selection
returns 403 `INVALID_REPORT_RECIPIENT`; an empty array returns 400. Sharing grants
and in-app notifications commit in one transaction. Duplicate recipients/retries
are idempotent. Content/status/timestamps remain unchanged. Managers cannot share.

GET `/api/reports` and `/:id` now also accept park-managers, returning only reports
explicitly shared with them and still within their current permitted park. They
cannot edit/re-analyze reports. Export returns no unrelated user/source documents,
does not write to the database. The server generates a PDF using headless Chromium;
the browser downloads the file without a print dialog. All report responses use `Cache-Control: no-store`.

### UC03 Incident reporting (KALMADU H L G)

See [design/UC03-incident-reporting.md](design/UC03-incident-reporting.md) for the offline and idempotency rules. All routes are ranger-only. Incident list/detail responses contain photo metadata but never the stored photo data URLs.

| Method | Path | Roles | Body / query | Result |
|---|---|---|---|---|
| POST | `/api/incidents` | ranger | `{ clientId, parkId, zoneId?, type, severity?, species?, description, observedAt, deviceCreatedAt, location?, locationNote?, recordedOffline?, photos?[] }` | `201` `{ incident, alert, duplicate: false }`; an identical retry returns `200` with `duplicate: true`. Reusing the client id for different data returns `409 CLIENT_ID_REUSED` |
| GET | `/api/incidents/mine` | ranger | — | `{ incidents }`, newest observation first |
| GET | `/api/incidents/:id` | ranger (owner) | — | `{ incident, photos }`; another ranger receives `404 INCIDENT_NOT_FOUND` |


### Optional structured species (UC03 / UC02)

`POST /api/incidents` accepts optional `species`: an explicit name, at most 80
characters, normalized by trimming, collapsing whitespace and lowercasing.
The canonical name is the stable identifier and label; options use `{ id, label }`
with that value in both fields. No taxonomy, inferred names or seed data is added.
Omission/empty means unspecified and remains compatible with old offline retries.
Species is stored on WildlifeIncident and copied into actionable incident alerts.

`GET /api/analytics/options` derives species from incidents in the current
analyst's permitted parks. Options are not restricted by the selected date range;
a species may have no matching alert events for the chosen park/period.
Analytics still counts alerts and conflicts, never raw incidents a second time.
Sightings without operational alerts are not event records in UC02.
Patrols remain unfiltered by species. Species persists in `snapshot.context.filters`
and draft re-analysis, preview and PDF export; missing/empty legacy values mean
All species. Authorization, report immutability and freshness rules are unchanged.
