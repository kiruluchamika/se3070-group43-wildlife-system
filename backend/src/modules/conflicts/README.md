# UC01 — Respond to Human–Elephant Conflict

**Owner:** WITTAHACHCHI D.K.G (IT23717404) · **Branch:** `feature/conflict-response`

Build the module in this folder, using the layers of `../alerts`: model → repository → service → routes → tests.

Shared contracts to use (see `docs/WORK_PLAN.md` §5):
- `teamService.commitTeam(teamId, 'responding', { session })` when you assign a response team, and `releaseTeam` when the response ends. Patrol management (UC04) then shows the team as busy.
- `notificationService.notifyUsers(...)` to notify the villager, the liaison officer, the ranger team and the park manager.
- `transactionRunner.run(...)` for any operation that writes several documents.
- `alertService.raise(...)` if a validated Critical conflict should appear on the park manager's alert list.
