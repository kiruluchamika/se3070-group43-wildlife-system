# UC01 — Respond to Human–Elephant Conflict

**Owner:** WITTAHACHCHI D.K.G (IT23717404) · **Branch:** `feature/conflict-response`

Implemented. Rules and critique: `docs/design/UC01-conflict-response.md`; endpoints: `docs/API.md`.

| File | Responsibility |
|---|---|
| `conflict.constants.js` | Shared vocabulary (types, statuses, outcomes) |
| `conflict.rules.js` | Pure rules: transitions, priority suggestion, deployment route, location adequacy, duplicate rule |
| `conflict-report.model.js`, `response-task.model.js`, `response-action.model.js` | Mongoose schemas |
| `conflict.repository.js` | Data access (conditional updates, idempotent actions) |
| `conflict-workflow.js` | Guarded status transitions with history; UC04 alert raising |
| `conflict.service.js` | Villager intake, officer verification, duplicates, escalation, review, contact |
| `response.service.js` | Team deployment, approvals, emergency dispatch, ranger tasks |
| `conflict-notifier.js` | Who is told what; community contact through the fallback adapter |
| `conflict-access.js` | Park, ownership and team-membership checks |
| `conflict.schemas.js`, `conflict.controller.js`, `conflict.routes.js` | HTTP layer |

Tests: `conflict.rules.test.js`, `conflict.service.test.js`, `response.service.test.js` (in-memory fakes) and `conflict.api.test.js` (HTTP + in-memory MongoDB with real transactions).

Shared contracts to use (see `docs/WORK_PLAN.md` §5):
- `teamService.commitTeam(teamId, 'responding', { session })` when you assign a response team, and `releaseTeam` when the response ends. Patrol management (UC04) then shows the team as busy.
- `notificationService.notifyUsers(...)` to notify the villager, the liaison officer, the ranger team and the park manager.
- `transactionRunner.run(...)` for any operation that writes several documents.
- `alertService.raise(...)` if a validated Critical conflict should appear on the park manager's alert list.
