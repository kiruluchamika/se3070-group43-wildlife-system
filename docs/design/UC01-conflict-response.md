# UC01 — Respond to Human–Elephant Conflict

**Owner:** WITTAHACHCHI D.K.G (IT23717404). **Source:** Group 41 report, §3.1, pp. 7–23.
**Primary actor:** Community Liaison Officer. **Supporting actors:** Villager, Ranger, Park Manager.

> **Before submitting:** check every page reference below against `Group_041.pdf`. This file was written from the flow list in the Group 43 work plan (main 1–5, A1–A6, E1–E4). Replace "pp. 7–23" with exact pages, and quote the original wording where a critique row depends on it.

## 1. Group 41's flows, as designed

| ID | Flow |
|---|---|
| Main | 1 villager reports conflict (type, village/landmark, time, description, contact; optional GPS/photos) → 2 officer is notified, verifies the report and sets priority → 3 system finds suitable teams; high priority / additional resources need Park Manager approval → 4 task assigned; ranger acknowledges and records actions, time, location, evidence and outcome → 5 officer reviews and sets Resolved / Monitoring Required / Escalated; parties notified; history recorded |
| A1 | Damage report: damage-specific fields |
| A2 | Critical immediate danger: emergency dispatch |
| A3 | Inadequate location: report pending more information |
| A4 | Duplicate report: link to the existing report, no duplicate task |
| A5 | No suitable team: escalate |
| A6 | Elephant cannot be located: follow-up monitoring |
| E1 | Normal notification fails: SMS fallback |
| E2 | SMS fails: escalate and record an alternative contact |
| E3 | Community channel unavailable |
| E4 | Ranger offline: field updates retained locally and synchronised |

## 2. Critique and agreed improvements

| # | Original design / reference | Problem | Agreed improvement (implemented) |
|---|---|---|---|
| 1 | Scenario, report statuses (pp. 7–23) | Statuses are named in the text, but the design never says which changes are legal (for example, can a resolved report be re-validated?). The rules cannot be tested. | An explicit **transition table** (`conflict.rules.js` `TRANSITIONS`). Every change is checked against it and recorded in the report history. |
| 2 | Main step 2, "set priority" | No criteria are given for priority. Two officers could rank the same report differently. | The system **suggests a priority** from the report (immediate danger or injury → critical, property damage → high, crop damage ≥ 1 acre → high, …). The officer confirms or overrides it. |
| 3 | Main step 3, approval | "High priority or additional resources" needs approval, but the design does not say what happens to critical reports, which cannot wait. | A **deployment route per priority**: low/medium → direct assignment; high or extra resources → Park Manager approval; critical → **emergency dispatch** with no approval, the manager informed afterwards, and a UC04 alert (A2). |
| 4 | A3 | "Inadequate location" is undefined. | A location is adequate with **GPS**, or with a **village + a landmark of at least 3 characters**. Verification is blocked until it is adequate; the officer requests information and the villager replies in the app. |
| 5 | A4 | No rule for when two reports are duplicates. | **Documented rule:** same park, both open, events within **12 h**, and within **2 km** (GPS) or the **same village**. Candidates are suggested, and the officer links them. A unique index allows only **one open task per report**. |
| 6 | Main step 3 / UC04 | Team availability is not shared with patrol management, so one team could be assigned twice. | UC01 uses the **shared `teamService.commitTeam`** (atomic conditional update). A responding team is busy in UC04 too. Releasing happens when the ranger completes the task. |
| 7 | Sequence diagram, assignment | Task creation, team status and notifications are separate calls. A failure in between leaves a busy team with no task. | **One MongoDB transaction** for team commit + task + report status + staff notifications. Tested with a real rollback (`conflict.api.test.js`). |
| 8 | E1–E3 | Notification failure is treated inside the business flow. A failed SMS could block or roll back a validated report. | Community contact goes through a **notification adapter** with a fallback chain (in-app → SMS) **after** the transaction commits. Every attempt is recorded; when all fail the officers are alerted and can **retry** (E3) or **record an alternative contact** (E2). The prototype SMS gateway is **simulated** and is never reported as "delivered". |
| 9 | E4 ordering | The offline exception could be read as the ranger receiving a *new* task while offline, which is impossible. | Corrected ordering: **task received while online → field update saved locally → reconnection → server confirmation**. Updates carry a client id, so a retry after a lost response is not duplicated. Received tasks are cached on the device. |
| 10 | A6 | "Follow-up monitoring" has no owner or time. | The review suggests **Monitoring** when the field outcome is "elephant not located", and requires a **follow-up time**. A monitored report can get a new deployment. |
| 11 | Main step 5, "notify relevant parties" | The parties are not listed. | Villager at every status change; officers on new reports, replies, approvals and completed responses; team on assignment; Park Manager on approval requests, emergencies and escalations. |
| 12 | Interaction design (wireframes) | No error, empty, offline or confirmation states. | Review-before-send for villagers; confirmation dialogs for deployments and duplicate links; inline "no changes were saved" errors; sync bar and "waiting to sync" items for rangers; every status badge has text plus an icon. |
| 13 | Whole system (p. 4) | Separate native app and web dashboard. | One responsive PWA (ADR-001). Rangers use the mobile layout; officers use the two-pane queue. |

## 3. Updated main flow (as implemented)

1. The **villager** opens *Report Conflict*, chooses the type (with damage fields for crop/property damage, A1), may tick *People are in danger right now* (A2), and adds a village, landmark, time, description, contact, optional GPS and up to 3 photos. The villager reviews the report, then sends it. The system stores it with a reference (`HEC-YYYYMMDD-XXXXX`), a suggested priority and a location-adequacy flag. It then notifies the park's liaison officers and acknowledges the villager (in-app, or SMS on failure, E1).
2. The **officer** opens the report in the *Conflict Queue* and checks the evidence and contact. The officer then does one of:
   - marks it **valid** and sets a priority
   - marks it **invalid** (with a reason sent to the villager)
   - **requests information** (A3)
   - **links it as a duplicate** (A4)
3. The officer selects a team from the available teams (nearest first). According to priority, the system **assigns** the team, sends the deployment for **Park Manager approval**, or performs an **emergency dispatch** (A2). If no team is available, the officer **escalates** (A5); this raises a UC04 alert for the Park Manager.
4. The **ranger** opens *Response Tasks*, acknowledges the task and records field actions (optionally with GPS). The ranger then completes the task with an outcome. All of this works offline for received tasks (E4). Completion frees the team and resolves any emergency alert.
5. The **officer** reviews the response and sets **Resolved**, **Monitoring** (with a follow-up time, A6) or **Escalated**. The villager is informed. The full history is shown on the report.

## 4. Traceability

| Scenario step | Endpoint | Service method | UI |
|---|---|---|---|
| Main 1, A1, A2 | `POST /api/conflicts` | `conflictService.submit` | `ReportConflictPage` |
| Villager tracking | `GET /api/conflicts/mine`, `GET /api/conflicts/:id` | `listMine`, `getReport` | `MyConflictReportsPage` |
| Main 2 | `GET /api/conflicts?view=`, `PATCH /:id/validation` | `listQueue`, `validate` | `ConflictQueuePage`, `ValidationPanel` |
| A3 | `PATCH /:id/information-request`, `PATCH /:id/information` | `requestInformation`, `provideInformation` | `ValidationPanel`, `InformationReply` |
| A4 | `GET /:id/duplicates`, `PATCH /:id/duplicate` | `findDuplicates`, `linkDuplicate` | `DuplicatePanel` |
| Main 3, A2 | `GET /:id/teams`, `POST /:id/deployments` | `responseService.listTeams`, `deploy` | `DeploymentPanel` |
| Approval | `GET /api/response-tasks/approvals`, `PATCH /api/response-tasks/:id/approval` | `listApprovals`, `decideApproval` | `DeploymentApprovalsPage` |
| A5 | `PATCH /:id/escalation` | `conflictService.escalate` | `DeploymentPanel` → UC04 `AlertsPage` |
| Main 4, E4 | `GET /api/response-tasks/mine`, `PATCH /:id/acknowledge`, `POST /:id/actions`, `PATCH /:id/complete` | `listMyTasks`, `acknowledge`, `recordAction`, `complete` | `ResponseTasksPage`, `offline/responseQueue.js` |
| Main 5, A6 | `PATCH /:id/review` | `conflictService.review` | `ReviewPanel` |
| E1 | (every villager update) | `notificationDispatcher.deliver` | contact log in `ContactPanel` |
| E2, E3 | `POST /:id/contact-retry`, `POST /:id/alternative-contact` | `retryContact`, `recordAlternativeContact` | `ContactPanel` |
| Access | all routes | `requireRole` + `conflict-access.js` (park, ownership, team) | `RoleRoute` → `ForbiddenPage` |

## 5. Design patterns and principles used

- **Layered architecture:** routes → controller → service → repository → model. Pure rules sit in `conflict.rules.js`.
- **State machine:** the `TRANSITIONS` table plus `workflow.transition`, which applies each change as a conditional update with a history entry.
- **Unit of Work:** `transactionRunner.run` for deploy, approve, complete, escalate and duplicate linking.
- **Adapter / Strategy:** the SMS gateway (`simulated` or `unavailable`; a real provider only needs `send`), and the notification dispatcher's fallback chain.
- **Idempotency keys:** `clientUpdateId` for offline field actions and completion.
- **Dependency injection:** the composition root is `container.js`; tests inject in-memory fakes (`test-support/conflict-fakes.js`).

## 6. Simulation and limits (be honest in the demo)

- **SMS is simulated.** `SMS_GATEWAY_MODE=simulated` logs messages and records them as *simulated*. `SMS_GATEWAY_MODE=unavailable` makes every SMS fail, to demonstrate E2/E3. Confirm with the lecturer whether a simulated adapter is acceptable (the FAQ explicitly allows only IoT/ML simulation).
- **Photos** are resized in the browser and stored as data URLs (max 3 × ~220 KB) because the API body limit is 1 MB. A Multer file store (the UC03 approach) can replace this later.
- **Offline:** field updates and the task list persist in IndexedDB. The app shell only opens offline once the PWA service worker (UC03, KALMADU) is added, and nothing syncs while the browser is closed.
