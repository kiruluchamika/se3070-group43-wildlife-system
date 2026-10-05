# UC03 Development Plan — Report Wildlife and Poaching Incident

**Owner:** KALMADU H L G (IT23701014)  
**Branch:** `feature/incident-reporting`  
**Source:** Group 41 report, pp. 36–43  
**Primary actor:** Ranger  
**Delivery style:** Mobile-first, offline-capable Progressive Web App (PWA)

## 1. Goal

Give a ranger a fast and dependable way to record wildlife or poaching evidence in the field, even with no network connection. A saved report must remain on the device, synchronise when the app is open and online, and create no duplicate records when a request is retried.

The experience should answer three questions clearly:

1. **Was my report saved?** — show a local confirmation immediately.
2. **Has it reached the server?** — show a visible sync status and last attempt.
3. **Does it need urgent action?** — automatically raise an operational alert for actionable evidence.

## 2. Scope and success criteria

### In scope

- A mobile-first incident form for authenticated rangers.
- Incident type, time, description, park/zone, GPS or manual location, and photo evidence.
- Review before saving to reduce field-entry mistakes.
- Local storage of reports and photos in IndexedDB through Dexie.
- Automatic synchronisation while the application is open, plus a manual **Retry** action.
- Server-side idempotency using a client-generated `clientId` with a unique index.
- Operational alert creation for snare, carcass, illegal-camp and footprint reports.
- A pending-report screen with clear saved, syncing, failed and synced states.
- PWA installation and cached application shell.
- Validation, role checks, tests, seed data and documentation.

### Out of scope

- Background synchronisation while the browser is closed.
- Live video upload, satellite messaging or real SMS delivery.
- Official GIS boundaries or automatic legal-case management.
- Editing shared alert schemas without the group leader's review.

### Definition of success

- A ranger can complete and save a report in a usable offline application.
- Closing and reopening the app does not lose the queued report or its photos.
- Reconnection starts synchronisation automatically while the app is open.
- Repeated submissions of one `clientId` produce one incident and at most one alert.
- A qualifying synced incident appears on the UC04 Alerts screen.
- A non-ranger receives `403 ACCESS_DENIED` from every UC03 route.
- UC03 backend coverage is at least 80%, and backend tests, lint and frontend build pass.

## 3. User-friendly field journey

Use a short, three-step flow rather than one long form.

| Step | Screen content | User-friendly behaviour |
|---|---|---|
| 1. What happened? | Incident type, observed time, short description and urgency | Large tap targets; plain labels; sensible current-time default; important categories shown first |
| 2. Where and what evidence? | Park, zone, GPS/manual coordinates and photos | One-tap **Use my location**; camera capture on phones; photo preview, remove and retake controls |
| 3. Check and save | A readable summary of all details | **Edit** links for each section; one clear **Save report** action; warn about missing GPS without blocking a valid manual location |

After saving, show one of these messages rather than the vague word “submitted”:

- **Saved on this device — waiting for connection**
- **Sending report…**
- **Report received — reference INC-…**
- **Could not send — your report is still safe on this device**

The Pending Reports page should group reports under **Needs attention**, **Waiting to sync**, and **Sent**. Each item shows incident type, time, location, photo count and the latest sync message. Failed items have a prominent **Retry** button; synced items show their server reference.

Accessibility requirements:

- Never communicate status using colour alone; use an icon and text badge.
- Keep all controls keyboard accessible and visibly focused.
- Associate validation messages with their fields.
- Use minimum 44 px touch targets on field screens.
- Provide meaningful image preview alt text and respect reduced-motion settings.

## 4. Proposed domain rules

These rules are implementation-ready proposals and must be checked against Group 41 pp. 36–43 before the model is frozen.

| Rule | Proposed behaviour |
|---|---|
| Actor | Only a signed-in `ranger` can create or view their incident reports |
| Incident time | Required; cannot be more than five minutes in the future |
| Description | Required, 10–1,000 characters |
| Location | GPS is preferred; if unavailable, park plus zone/manual location remains possible |
| Photos | Up to three compressed images; validate file type and size before storing |
| Client identity | Generate one UUID when the local draft becomes a queued report; never regenerate it during retries |
| Ownership | Store the authenticated ranger from the token; never accept a ranger ID from the browser |
| Server duplicate | The same `clientId` from the same report returns the existing record instead of inserting again |
| Retry conflict | Reuse of a `clientId` with a different payload returns `409 CLIENT_ID_REUSED` |
| Alert creation | Create the incident and its alert in one MongoDB transaction |
| Audit time | Keep `observedAt`, device `createdAt`, server `receivedAt`, and `syncedAt` separate |

### Incident-to-alert mapping

The shared alert model currently has no `footprint` alert type. Keep the richer type on the incident and map it to an existing operational alert type unless the collection owner approves a shared schema change.

| Incident type | Alert type | Suggested severity | Reason |
|---|---|---|---|
| snare | `snare` | high | Immediate animal and poaching risk |
| carcass | `carcass` | high | Requires investigation |
| illegal-camp | `illegal-camp` | critical | Strong evidence of active illegal activity |
| footprint | `poaching` | medium | Suspicious evidence; exact meaning stays on the incident |
| injured-wildlife | no automatic alert initially | — | Confirm expected workflow from the source use case |
| wildlife-sighting | no automatic alert initially | — | Record for analysis without overloading operations |
| fire | `fire` | critical | Existing shared alert type; confirm whether UC03 includes it |
| other | no automatic alert | — | Ranger description remains available for review |

## 5. Data design

### `wildlifeincidents`

| Field | Purpose |
|---|---|
| `clientId` | UUID generated once on the device; unique and indexed |
| `reference` | Human-readable server reference such as `INC-20261004-0012` |
| `ranger` | Authenticated user reference |
| `park`, `zone` | Shared park and optional zone references |
| `type`, `severity` | Classification and operational importance |
| `description` | Ranger's field notes |
| `location` | `{ lat, lng, accuracy? }` |
| `observedAt` | When the ranger observed the incident |
| `deviceCreatedAt` | When the report was saved locally |
| `receivedAt` | When the server accepted it |
| `recordedOffline` | Whether the report spent time in the offline queue |
| `alert` | Optional reference to the generated operational alert |
| timestamps | Mongoose `createdAt` and `updatedAt` |

### `incidentphotos`

Store photos separately from the incident so list endpoints stay lightweight. Each record contains the incident reference, content type, size, caption/order and storage data or URL. The implementation must document the prototype storage choice and avoid returning photo bodies from list endpoints.

For this assignment, compress photos in the browser and enforce an overall request limit that fits the current API body-size policy. If multipart upload is selected instead, add the dependency and security limits explicitly rather than mixing both formats.

### Local Dexie database

Use a user-scoped queue so reports from one signed-in ranger cannot appear in another ranger's session.

```text
pendingIncidents
  clientId, userId, payload, photos, status,
  attempts, lastAttemptAt, lastError, createdAt, serverResult
```

Allowed local status transitions:

```text
draft → queued → syncing → synced
                   └────→ failed → syncing
```

Only one synchronisation worker may process a queue item at a time. A failed network request keeps the item; a successful response stores the server reference before removing or archiving the payload.

## 6. API plan

All routes use `authenticate`, `requireRole('ranger')` and Zod validation, and return the shared `{ message, code, details }` error shape.

| Method | Route | Purpose | Important result |
|---|---|---|---|
| `POST` | `/api/incidents` | Synchronise one locally saved report | `201` for new; `200` with `duplicate: true` for an identical retry |
| `GET` | `/api/incidents/mine` | List the current ranger's recent reports | Metadata only; newest first |
| `GET` | `/api/incidents/:id` | Open one owned report | Incident plus photo metadata |

The `POST` service flow is:

1. Validate the payload and authenticated role.
2. Check whether the `clientId` already exists.
3. If it exists with the same owner and payload identity, return it as a safe retry.
4. If the identifier was reused for different data, return `409 CLIENT_ID_REUSED`.
5. In one transaction, create the incident, store photo records, and raise the qualifying alert.
6. Return the incident reference and alert summary.
7. Also handle a unique-index race so two simultaneous requests still create only one incident.

## 7. Code structure

### Backend

```text
backend/src/modules/incidents/
  wildlife-incident.model.js
  incident-photo.model.js
  incident.schemas.js
  incident.repository.js
  incident.service.js
  incident.controller.js
  incident.routes.js
  incident.service.test.js
  incident.api.test.js
```

Register the two models, repository, service and `/api/incidents` router in `backend/src/container.js`. Inject `alertService`, `transactionRunner` and `clock` into the service; do not import them globally.

### Frontend

```text
frontend/src/features/incidents/
  api/incidentApi.js
  components/IncidentFormSteps.jsx
  components/IncidentCard.jsx
  components/SyncStatusBadge.jsx
  lib/incident.js
  lib/device.js
  offline/incidentDb.js
  offline/incidentQueue.js
  offline/useIncidentSync.js
  pages/NewIncidentPage.jsx
  pages/PendingIncidentsPage.jsx
```

Add both pages to `PAGES` in `App.jsx` and set the UC03 navigation items to `ready: true`. Reuse `PageHeader`, `Card`, `Field`, `Button`, `Badge`, `Feedback`, toasts and the existing motion settings.

### PWA

- Install and configure `vite-plugin-pwa` in `frontend/vite.config.js`.
- Add a manifest with WildGuard name, short name, theme/background colours and installable icons.
- Cache the application shell and static assets; do not blindly cache authenticated API responses.
- Cache the minimum public user profile (`id`, `name`, `role`, `park`, `team`) after a successful login so a previously authenticated ranger can reopen protected field screens offline. The backend remains authoritative: reconnecting revalidates the JWT, and a `401` clears the cached session.
- Show an update prompt when a new service worker is ready.
- Test first online load, installed launch, offline reload and recovery after reconnection.

## 8. Delivery plan

Work in vertical slices so each checkpoint leaves a demonstrable result.

| Phase | Deliverable | Completion check |
|---|---|---|
| 0. Confirm | Extract main, alternative and exception flows from pp. 36–43; agree on types, photos, urgency and location rules | Traceability table has no unknown mandatory step |
| 1. Domain | Models, validation, repository and service idempotency | Service tests pass for new, retry, conflict and invalid reports |
| 2. Integration | Router/container registration and alert transaction | API test proves one incident creates the correct UC04 alert |
| 3. Field UI | Three-step report flow with GPS, photos, validation and review | Ranger can save a valid report on a phone-sized viewport |
| 4. Offline | Dexie queue, status screen, automatic/manual retry | Offline report survives reload and syncs once after reconnecting |
| 5. PWA | Manifest, service worker, icons and offline app shell | Installed app opens without a connection after one online visit |
| 6. Quality | Error/empty states, accessibility, seed data and full test matrix | Lint/build/tests pass and UC03 coverage is at least 80% |
| 7. Handoff | API docs, README, screenshots, prompt log and PR to `dev` | Reviewer can reproduce the integration scenario from a fresh clone |

### Priority order if time is limited

1. Correct server persistence and duplicate prevention.
2. Offline save and reliable synchronisation.
3. UC04 alert integration.
4. Clear mobile UX and recovery messages.
5. PWA install polish and optional visual enhancements.

## 9. Test matrix

### Backend unit and API tests

- Creates a valid online incident and returns `201`.
- Returns the same incident with `200 duplicate: true` for an identical retry.
- Rejects one `clientId` reused with different content.
- Handles two concurrent requests without duplicate incidents or alerts.
- Raises the mapped alert for snare, carcass, illegal-camp and footprint.
- Does not raise an alert for a non-alerting type.
- Rolls back incident/photo writes if alert creation fails.
- Rejects invalid coordinates, future times, unsupported image metadata and missing required fields.
- Prevents a ranger from reading another ranger's report.
- Rejects villager, liaison-officer, data-analyst and park-manager access.

### Frontend and manual PWA tests

- Form validation focuses the first invalid field.
- GPS success, denial, timeout and unavailable states are understandable.
- Photo add, preview, remove, compression failure and limit states work.
- Offline save gives immediate confirmation.
- Queue survives reload and is scoped to the signed-in user.
- Going online starts one sync attempt, not several parallel attempts.
- A lost server response followed by retry produces no duplicate.
- Failed sync displays the reason and preserves the report.
- Service-worker update and offline app-shell states are clear.

### Required cross-module demonstration

```text
Ranger saves report offline
  → Pending Reports shows “Waiting to sync”
  → connection returns
  → one wildlife incident is stored
  → one operational alert is raised
  → Park Manager sees it on UC04 Alerts
  → retrying the same clientId changes neither count
```

## 10. Risks and controls

| Risk | Control |
|---|---|
| Photos exceed API or IndexedDB limits | Compress before queueing, cap count/size, show a specific error |
| Duplicate requests during reconnection | Stable `clientId`, unique index, payload comparison and race handling |
| Multiple tabs run synchronisation | Per-item lock/status and idempotent server behaviour |
| User logs out with pending reports | Scope queue records by user and warn before hiding unsent work |
| GPS is denied or inaccurate | Show accuracy, allow retry and support a documented manual fallback |
| Alert type does not match incident type | Use the approved mapping table; change shared enum only after owner review |
| Partial incident/alert write | MongoDB transaction through `transactionRunner` |
| Sensitive evidence exposed | Authorisation on every route; omit photo bodies from lists and logs |

## 11. Documentation and PR checklist

- [ ] Verify and record every Group 41 main, alternative and exception flow.
- [ ] Add confirmed UC03 critique rows to `docs/WORK_PLAN.md`.
- [ ] Complete the UC03 endpoints in `docs/API.md`.
- [ ] Add the module summary and offline limits to the root README.
- [ ] Add representative UC03 seed data, including one alert-producing incident.
- [ ] Record AI assistance in `docs/ai-prompts/kalmadu-hlg.md`.
- [ ] Run `npm test`, `npm run test:coverage` and `npm run lint` in `backend`.
- [ ] Run `npm run lint` and `npm run build` in `frontend`.
- [ ] Manually test mobile, offline, reconnection and duplicate retry scenarios.
- [ ] Open a PR from `feature/incident-reporting` into `dev` and request one teammate review.

## 12. Traceability

### 12.1 Source status

Exact traceability to Group 41 pp. 36–43 is **blocked on the source artifact**. `Group_041.pdf` is not in this repository, any branch or the available commit history, and a public search did not locate the referenced report. The rows below therefore trace the implementation only to Group 43's approved work plan and ADR-001; they must not be presented as quotations or exact flow IDs from Group 41.

To complete exact traceability, add the source as `docs/source/Group_041.pdf` (or provide clear images/text of pp. 36–43), then replace the final worksheet with the source's exact wording and identifiers.

### 12.2 Verified project-contract traceability

| Project requirement | Agreed behaviour | Endpoint/service | UI | Automated/manual evidence |
|---|---|---|---|---|
| WORK_PLAN §2 — offline IndexedDB + PWA | Save locally before upload; reopen the cached app and authenticated ranger screens offline; sync while open after reconnection | `sessionStore`, `AuthProvider`, `incidentQueue.syncIncidents` | `NewIncidentPage`, `PendingIncidentsPage`, `PwaUpdatePrompt` | Production build generates `manifest.webmanifest` and `sw.js`; manually reload offline and inspect `wildguard-incidents` in IndexedDB |
| WORK_PLAN §5 — `alertService.raise` | Actionable synced incidents raise a UC04 alert in the same transaction | `POST /api/incidents`; `incidentService.submit` | Report confirmation; existing UC04 Alerts page | `incident.service.test.js`: mapped alert and transaction tests; manual Ranger → Park Manager walkthrough |
| WORK_PLAN §7 — offline incident synchronises exactly once | Stable client UUID, unique database index, identical retries return the stored incident | `incidentService.submit`; `incidentRepository.findByClientId` | Waiting/sending/received states | Service and repository duplicate tests; replay the same request and confirm `200 duplicate: true` |
| ADR-001 — camera, GPS and offline storage | Capture GPS and up to three compressed photos; allow a location-note fallback | `incident.schemas.js`; separate `IncidentPhoto` documents | Evidence step in `NewIncidentPage` | API validation tests plus manual permission-denied, photo-limit and fallback checks |
| Shared security contract | Only a ranger may create or read their reports; local cached role never replaces backend authorization | `authenticate`, `requireRole('ranger')`, owner check | `RoleRoute` → `ForbiddenPage` | API role test and service ownership test |
| Shared error contract | Validation and business failures use `{ message, code, details }` | Zod validation and `AppError` subclasses | Inline errors and failed-sync card | `incident.api.test.js` validation cases |

### 12.3 Group 41 source-extraction worksheet

Complete every row directly from pp. 36–43. Preserve the original flow identifier and step number so a reviewer can move from the source report to code and test evidence without interpretation.

| Page / diagram | Exact source flow ID and step | Actor action / system response | Implemented behaviour | Endpoint/service | UI | Test/evidence | Status |
|---|---|---|---|---|---|---|---|
| p. 36 | Pending source | Pending source | — | — | — | — | Blocked |
| p. 37 | Pending source | Pending source | — | — | — | — | Blocked |
| p. 38 | Pending source | Pending source | — | — | — | — | Blocked |
| p. 39 | Pending source | Pending source | — | — | — | — | Blocked |
| p. 40 | Pending source | Pending source | — | — | — | — | Blocked |
| p. 41 | Pending source | Pending source | — | — | — | — | Blocked |
| p. 42 | Pending source | Pending source | — | — | — | — | Blocked |
| p. 43 | Pending source | Pending source | — | — | — | — | Blocked |

