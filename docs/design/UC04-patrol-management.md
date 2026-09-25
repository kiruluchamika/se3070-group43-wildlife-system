# UC04 — Monitor Patrol Coverage and Allocate Resources

**Owner:** HETTIGE K.C. (IT23700956). **Source:** Group 41 report, §3.4, pp. 44–50 (designed by Dissanayake D.M.S.S).
**Primary actor:** Park Manager. **Supporting actor:** Ranger.

## 1. Group 41's flows, as designed

| ID | Flow |
|---|---|
| Main | 1 access dashboard → 2 real-time coverage → 3 review map → 4 system identifies under-patrolled zones → 5 view alerts → 6 analyse → 7 select area → 8 select team → 9 allocate/reassign → 10 update assignments → 11 record decision → 12 confirmation |
| A1 | No under-patrolled zones: tell the manager coverage is satisfactory |
| A2 | No active alerts: show "no active alerts" |
| A3 | Reassignment required: no unassigned team, so reassign a team from a lower-priority area |
| A4 | Emergency: critical alert → emergency dispatch → system assigns an available team → record the dispatch |
| E1 | Patrol data unavailable: show an error; no allocation decision is possible |
| E2 | No rangers available: inform the manager; the manager may reassign |
| E3 | Error while updating the assignment: show an error; the previous assignment stays unchanged |
| E4 | Access denied for unauthorised users |

## 2. Critique and agreed improvements

| # | Original design / reference | Problem | Agreed improvement (implemented) |
|---|---|---|---|
| 1 | Main step 4 (p. 45) | "Under-patrolled" is never defined, so the step cannot be implemented or tested. | An explicit, per-park **coverage policy** (§4). Every flagged zone lists the reasons it was flagged. |
| 2 | Main step 2, "real-time" coverage | No data freshness is shown. Ranger data can arrive late because of offline synchronisation. | "Updated x min ago" indicator, automatic refresh every 30 s, and a manual refresh button. |
| 3 | Supporting actor: Ranger | The Ranger never appears in any flow step. Storyboard frame 5 shows the team being notified, but the scenario never does. | The system **notifies the assigned team**, and the ranger **acknowledges** the assignment on *My Assignment*. |
| 4 | Main steps 9–10 | Nothing is confirmed before the change is committed. This breaks the HCI principle of error prevention. | A **confirmation dialog** that summarises the zone, risk, team, distance, ETA and impact. |
| 5 | A3 | The flow does not say what happens to the zone the team leaves, and "lower-priority area" is undefined. | The reassignment shows its **impact** ("the zone will have no assigned team") and requires a **reason**. Priority is compared by score; moving into a zone that is not of higher priority requires an explicit **override**. |
| 6 | A4 steps 3–4 | "Assigns the available ranger team": the flow gives no selection criteria and no fallback when no team is free. | Candidates are **ranked by distance and ETA** (haversine), and the manager may override the choice. When no team is free, a team on a **lower-priority patrol can be diverted**. The alert moves to *Dispatched*, and completing the patrol resolves it. |
| 7 | Sequence diagram (p. 47) | The UI calls `updatePatrolAssignment` and then `recordResourceAllocation` separately. If the second call fails, the system is left inconsistent, which breaks E3. | A **single service call** runs the assignment update, team status, decision record and notification in **one MongoDB transaction**. |
| 8 | Class diagram (p. 6) | The sequence diagram uses `DispatchDB` and "record allocation decision", but the class diagram has no matching classes. | Add the classes **`EmergencyDispatch`** and **`AllocationDecision`**. |
| 9 | Use case diagram vs scenario | The extension points differ ("Under-patrolled zone identified / high-risk alert" in the diagram, "Resource Allocation and Emergency Dispatch" in the scenario). | Use one extension-point naming in the updated diagram. |
| 10 | Hi-fi wireframe (p. 50) | "Available Ranger Teams" also lists teams *On Patrol*. There are no empty, error or emergency states. Risk is shown by colour only. | Rename the panel to **Ranger Teams** and add status filters. Add the A1, A2, E1 and E2 states and the emergency dispatch dialog. Every badge has **text and an icon**. |
| 11 | Main steps 5–6 | Alerts cannot be acknowledged, so the manager cannot tell new alerts from ones already seen. | An **Acknowledge** action and alert statuses: active → acknowledged → dispatched → resolved. |
| 12 | Postconditions | "Ranger resources may be allocated" is vague and not testable. | **Allocation History** records every decision: who made it, when, which team, the from and to zones, and the reason. |

The wireframe layout is kept: sidebar; Patrol Coverage Map + Active Alerts; Under-Patrolled Zones + Ranger Teams; Allocate/Reassign bar. The KPI strip above the map is an enhancement.

## 3. Updated main flow (as implemented)

1. The Park Manager opens **Patrol Coverage** (`/patrol`).
2. The system shows the coverage map, KPIs and the *Updated x min ago* indicator, and refreshes every 30 s.
3. The manager reviews the map. Zones are coloured by status, and the map shows team positions, recent routes and pulsing alerts.
4. The system flags the under-patrolled zones and their reasons, most urgent first. *(A1 applies if none are flagged.)*
5. The manager reviews the active alerts, and may acknowledge them. *(A2 applies if there are none.)*
6. The manager selects a zone. The system pre-selects the most urgent zone, and teams are sorted by distance to it.
7. The manager selects a ranger team. An available team means allocation; a team on patrol means reassignment (A3). *(E2 applies if none are free.)*
8. The manager adds notes (for a reassignment, a reason), then selects **Confirm Assignment**.
9. The system shows the confirmation dialog, with the impact of the change.
10. The manager confirms. In **one transaction**, the system creates the assignment, updates the team status, records the `AllocationDecision` and notifies the team members. *(E3 applies if this fails.)*
11. The system shows *"Patrol Assignment Updated — Team X has been assigned to Y"* and refreshes the data.
12. A ranger from the team opens **My Assignment** and acknowledges it.

**A4 (emergency).** On a high or critical alert, the manager selects **Dispatch team**. The system shows ranked candidates: available teams first, then teams that can be diverted. The manager confirms, and in one transaction the system:
- ends any diverted patrol and records it
- sets the team to `responding`
- creates the emergency assignment and the `EmergencyDispatch` record
- sets the alert to `dispatched`
- records the decision
- notifies the team

**Completion.** The manager selects **Mark patrol complete**. The system records the patrol (which updates coverage and "last patrolled"), frees the team, and resolves the alert if the assignment was an emergency.

## 4. Coverage rule (Strategy: `backend/src/modules/patrol/policies/coverage-policy.js`)

| Term | Definition |
|---|---|
| Coverage window | Last `windowDays` (default 7) |
| Coverage % | `min(100, patrol hours in window ÷ zone.targetWeeklyPatrolHours × 100)`; ongoing patrols count up to now |
| Hours since last patrol | Now − latest patrol end (0 while a patrol is ongoing; "never" if there are no records) |
| Effective risk | The higher of the zone's base risk and its unresolved alerts (critical or high → high, medium → medium) |
| Covered | The zone has an active assignment |
| **Under-patrolled** | Not covered **and** (hours since last patrol > `maxGapHours[risk]` **or** coverage % < `minCoveragePercent`) |
| Defaults | `maxGapHours` = high 24 h / medium 48 h / low 72 h; `minCoveragePercent` = 50 |
| Per-park override | Sinharaja (dense forest): 36 / 72 / 120 h, 40% |
| Priority score | `riskWeight×100 + min(gap/maxGap, 3)×20 + (100 − coverage)/5 + alerts×15`. Used for sorting and for the A3 check |
| Recommended action | High → *Allocate a ranger team*; Medium + gap exceeded → *Increase patrol frequency*; Medium + low coverage → *Allocate additional resources*; Low → *Monitor* |

## 5. Traceability

| Scenario step | Endpoint | Service method | UI |
|---|---|---|---|
| Main 2–4, A1 | `GET /api/patrol/coverage` | `coverageService.getCoverage` / `assessZones` | `CoverageMap`, `CoverageSummary`, `UnderPatrolledZonesTable` |
| Main 5, A2 | `GET /api/alerts`, `PATCH /api/alerts/:id/acknowledge` | `alertService.list`, `acknowledge` | `ActiveAlertsPanel`, `AlertsPage` |
| Main 8, E2 | `GET /api/patrol/teams?zoneId=` | `allocationService.listTeams` | `RangerTeamsPanel`, `AllocationPanel` |
| Main 9–12, E3 | `POST /api/patrol/assignments` | `allocationService.allocate` | `AssignmentConfirmDialog`, `SuccessDialog` |
| A3 | `POST /api/patrol/assignments/reassign` | `allocationService.reassign` | `AllocationPanel` (reassign mode) |
| A4 | `GET /api/patrol/emergency-dispatches/recommendations`, `POST /api/patrol/emergency-dispatches` | `emergencyDispatchService.recommend`, `dispatch` | `EmergencyDispatchDialog` |
| Ranger acknowledgement | `GET /api/patrol/my-assignment`, `PATCH /api/patrol/assignments/:id/acknowledge` | `allocationService.getMyAssignment`, `acknowledge` | `MyAssignmentPage` |
| Decision record | `GET /api/patrol/decisions` | `allocationService.listDecisions` | `AllocationHistoryPage` |
| Completion | `PATCH /api/patrol/assignments/:id/complete` | `allocationService.complete` | `RangerTeamsPage` |
| E1 | any coverage failure | — | `ErrorState`; allocation disabled |
| E4 | all park-manager routes | `requireRole('park-manager')` | `RoleRoute` → `ForbiddenPage` |

## 6. Design patterns and principles used

- **Layered architecture:** routes → controller → service → repository → model.
- **Repository:** `patrol.repository.js`.
- **Strategy:** `createCoveragePolicy(parkPolicy)`.
- **Dependency injection / composition root:** `src/container.js`.
- **Unit of Work:** `transactionRunner.run`.
- **Chain of Responsibility:** Express middleware (`authenticate → requireRole → validate → controller`).
- **Single responsibility:** coverage, allocation and dispatch are separate services.
- **Open/closed:** new parks change their policy data, not the code.
