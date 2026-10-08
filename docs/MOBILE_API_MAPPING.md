# Mobile API mapping

Every path below is relative to `EXPO_PUBLIC_API_URL`, which ends in `/api`. GET requests receive JSON unless stated otherwise. Mutations never receive automatic HTTP retries; only the persisted ranger queue and explicit report-save retries reuse backend-supported stable IDs.

| Mobile module | Integrated endpoints |
|---|---|
| Login, registration, session | `POST /auth/login`, `POST /auth/register`, `GET /auth/me` |
| Profile diagnostics / reference data | `GET /health`, `GET /parks` |
| Notifications | `GET /notifications/me`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` (204) |
| Villager conflict capture and tracking | `POST /conflicts`, `GET /conflicts/mine`, `GET /conflicts/:id`, `PATCH /conflicts/:id/information` |
| Officer queue and triage | `GET /conflicts?view=`, `PATCH /conflicts/:id/validation`, `PATCH /conflicts/:id/information-request`, `GET /conflicts/:id/duplicates`, `PATCH /conflicts/:id/duplicate` |
| Officer deployment and review | `GET /conflicts/:id/teams`, `POST /conflicts/:id/deployments`, `PATCH /conflicts/:id/escalation`, `PATCH /conflicts/:id/review`, `POST /conflicts/:id/contact-retry`, `POST /conflicts/:id/alternative-contact` |
| Manager response approval | `GET /response-tasks/approvals`, `GET /teams?parkId=`, `PATCH /response-tasks/:id/approval` |
| Ranger response work | `GET /response-tasks/mine`, `PATCH /response-tasks/:id/acknowledge`, `POST /response-tasks/:id/actions`, `PATCH /response-tasks/:id/complete` |
| Ranger incident capture/history | `POST /incidents`, `GET /incidents/mine`, `GET /incidents/:id` |
| Manager patrol operations | `GET /patrol/coverage`, `GET /patrol/teams`, `GET /patrol/assignments`, `POST /patrol/assignments`, `POST /patrol/assignments/reassign`, `PATCH /patrol/assignments/:id/complete`, `GET /patrol/decisions` |
| Ranger patrol assignment | `GET /patrol/my-assignment`, `PATCH /patrol/assignments/:id/acknowledge` |
| Alerts and emergency response | `GET /alerts`, `PATCH /alerts/:id/acknowledge`, `GET /patrol/emergency-dispatches/recommendations`, `POST /patrol/emergency-dispatches` |
| Analyst retrieval/comparison | `GET /analytics/options`, `GET /analytics` with either `parkId` or comma-separated `parkIds`, start/end dates, optional type/species |
| Report lifecycle | `POST /reports`, `GET /reports?page=&status=`, `GET /reports/:id`, `PATCH /reports/:id`, `GET /reports/:id/reanalysis` |
| Finalized reports | `GET /reports/:id/recipients`, `POST /reports/:id/share`, `GET /reports/:id/export` (binary PDF) |
| Administrator | `GET /users?page=`, `POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status` |

## Important payloads

- Conflicts use `conflictType`, `occurredAt`, `contactName`, `contactPhone`, optional `{lat,lng,accuracyMeters}` location, damage fields and `evidence: [{dataUrl,caption}]`. Crop/property fields are conditional. Priority is assigned during officer validation, not self-assigned by villagers.
- Incidents use UUID `clientId`, `observedAt`, `deviceCreatedAt`, `type`, `severity`, optional species/location/zone/locationNote, `recordedOffline`, and photos. At most 3 compressed photos, each data URL <=300,000 characters. At least one location source is required.
- Field actions use stable `clientUpdateId`, `type`, `recordedAt`, optional note/location/offline flag. Completion uses stable `clientUpdateId`, outcome, notes and `completedAt`.
- Allocation uses zone/team IDs; reassignment additionally requires reason and an explicit override when permitted. Dispatch uses alert/team IDs and instructions. Availability/priority constraints remain server decisions.
- Reports use UUID `requestId`, draft/finalized status, narratives, an exact web-compatible snapshot and optional `replaceDraft: {id,revision}`. Draft PATCH includes revision. Share sends explicit authorized manager IDs.

Lists with actual server pagination (reports/users) have Previous/Next controls. Other modules use their existing bounded/list contracts and search/filter controls. The app does not fabricate unsupported endpoints.
