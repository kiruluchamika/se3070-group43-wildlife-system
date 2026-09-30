# Group 43 Work Plan — SE3070 Assignment 02

**Project:** WildGuard: an implementation of Group 41's design for the Smart Wildlife Conservation and Anti-Poaching Monitoring System.
**Deadline:** Friday 9 October 2026, 11:59 PM. Do not change the repository after this time.
**Repository:** https://github.com/kiruluchamika/se3070-group43-wildlife-system

## 1. Team and module allocation

Each member builds the frontend, the backend and the unit tests for their own use case. The use cases come from Group 41's report (`Group_041.pdf`).

| Member | Student ID | Module (graded use case) | Group 41 pages | Branch |
|---|---|---|---|---|
| **HETTIGE K.C.** (leader) | IT23700956 | **UC04 — Monitor Patrol Coverage and Allocate Resources** | 44–50 | `feature/patrol-management` |
| WITTAHACHCHI D.K.G | IT23717404 | UC01 — Respond to Human–Elephant Conflict | 7–23 | `feature/conflict-response` |
| KALMADU H L G | IT23701014 | UC03 — Report Wildlife and Poaching Incident (offline PWA) | 36–43 | `feature/incident-reporting` |
| JALATHGE C.A.J | IT23751446 | UC02 — Analyze Conservation Data and Generate Reports | 24–35 | `feature/conservation-reports` |

**Shared work that is not graded.** The spec excludes login, logout and privilege granting from grading.
- The leader built user management, the app shell, the design system and the demo seed data. These are on `main`.
- Everyone may extend these, but each change goes through a pull request (PR). The leader reviews PRs that touch shared files.

**Leader responsibilities:**
- coordinate the shared files: `backend/src/container.js`, `frontend/src/lib/navigation.js`, `frontend/src/App.jsx`, the seed data, and the shared models.
- merge PRs.
- run the integration checks.
- compile the final PDF report.

Every member still writes their own critique section and their own implementation section.

## 2. Technology

| Part | Technology |
|---|---|
| Frontend | React 19 + Vite 8, JavaScript, **Tailwind CSS v4**, motion (animations), lucide-react (icons), react-leaflet (maps), sonner (toasts) |
| Backend | Node.js + Express 5, zod (validation), JWT + bcrypt |
| Database | **MongoDB Atlas** through Mongoose. This replaces the SQLite suggested in the guide; see `docs/DECISIONS.md` |
| Offline | IndexedDB (Dexie) + `vite-plugin-pwa`. KALMADU owns this for UC03 |
| Tests | Vitest + V8 coverage; supertest; mongodb-memory-server |

Everyone uses **Node.js 22 LTS** (minimum 20.19). Check with `node --version`.

## 3. Timeline

| Date | Milestone | Who |
|---|---|---|
| Fri 25 Sep | The foundation is on `main`: auth, the app shell, shared models, seed data and this plan | Leader |
| Sat 26 Sep | Each member reads their Group 41 use case, lists the main, alternative and exception flows, and drafts critique rows | Everyone |
| Sun 27 Sep | **Design review meeting.** Agree on the critique table and freeze the shared schemas (teams, alerts, notifications) | Everyone |
| Mon 28 Sep | Update the diagrams (use case, class, sequence) and the wireframes for your own use case | Everyone |
| 28 Sep – 4 Oct | Build your module in this order: main flow → database persistence → alternative flows → exception flows → UI polish → tests | Everyone |
| **Thu 1 Oct** | **Checkpoint:** open a draft PR with a working main flow | Everyone |
| 5–6 Oct | **Integration:** run the checks in §7, test the PWA offline, and reach ≥80% coverage for each module | Everyone |
| Wed 7 Oct | Take screenshots and write the report sections | Everyone → Leader compiles |
| Thu 8 Oct | Fresh-clone verification (§8), merge the final PRs, tag `v1.0` | Leader |
| Fri 9 Oct | Buffer. Submit the PDF before 11:59 PM, then freeze the repository | Leader |

## 3a. Branching model

| Branch | Purpose | Who merges into it |
|---|---|---|
| `main` | The stable, submitted version. It only receives tested releases from `dev` | Leader, at integration checkpoints and on 8 Oct |
| `dev` | The integration branch. All feature PRs target `dev` | Leader, after one teammate has reviewed the PR |
| `feature/<module>` | One member's use case (see §1) | The owner commits here |

Workflow:
- Each member branches from `dev` and opens a PR into `dev`.
- The leader merges `dev` into `main` after the integration checks pass (§7).
- Keep your feature branch current with `git pull origin dev` and then `git merge dev`.

## 4. Per-member checklist

1. Read your use case in Group 41's report. List the main flow, every alternative flow (A1, A2, …) and every exception flow (E1, E2, …).
2. Add your rows to the critique table (§6), then discuss them at the design review.
3. Create your branch from `dev` (see §3a):
   ```
   git switch dev
   git pull
   git switch -c feature/<your-module>
   ```
   When your work is ready, push the branch and open a pull request **into `dev`**, not `main`.
4. **Backend:** create `backend/src/modules/<module>/` using the same layers as `alerts/` and `teams/`:
   - `*.model.js`: Mongoose schema
   - `*.repository.js`: data access only; returns plain objects
   - `*.service.js`: business rules. This is the file you unit-test most.
   - `*.routes.js`: validation (zod), `authenticate` + `requireRole(...)`, and the HTTP mapping
   - `*.test.js`: tests placed next to the code they test
5. Register the module in `backend/src/container.js`: add its repositories, services and router.
6. **Frontend:**
   - Create `frontend/src/features/<module>/`.
   - Add your page to `PAGES` in `App.jsx`.
   - Set `ready: true` on your items in `lib/navigation.js`.
   - Use the shared components in `components/ui` so every screen looks the same.
7. Build every scenario: the main flow, all the alternative flows, all the exception flows, and every change agreed in the report.
8. Tests: `cd backend && npm run test:coverage`. Aim for **>80%** with positive, negative, edge and error cases.
9. Add a short section about your module to the README.
10. Keep your AI prompts in `docs/ai-prompts/<your-name>.md`. They go in the report appendix.

## 5. Shared contracts: use these instead of duplicating them

| Contract | Where | Used by |
|---|---|---|
| `teamService.commitTeam(teamId, status, { session })` / `releaseTeam(teamId)` | `backend/src/modules/teams/team.service.js` | **UC01**: when a response team is assigned, patrol management (UC04) must see the team as committed |
| Team statuses `available`, `on-patrol`, `responding`, `off-duty` | `teams/ranger-team.model.js` | UC01, UC04 |
| `alertService.raise({ park, zone, type, severity, title, message, location, source, sourceRef })` | `backend/src/modules/alerts/alert.service.js` | **UC03** raises an alert after an incident is synchronised (for example a snare or carcass). The simulated collar and camera-trap feeds also use it |
| `notificationService.notifyUsers(userIds, { type, title, message, link }, { session })` | `backend/src/modules/notifications/notification.service.js` | UC01 (notify the parties), **UC02** ("Share report with Park Manager"), UC04 |
| `coverageService.assessPark(parkId)` / `assessZones(...)` (zone coverage %, under-patrolled rule) | `backend/src/modules/patrol/coverage.service.js` | **UC02** reuses it so coverage figures match on every screen |
| `transactionRunner.run(async (session) => …)` | `backend/src/config/database.js` | Any operation that writes more than one document |
| Error format `{ message, code, details }` + `AppError` subclasses | `backend/src/shared/errors/AppError.js` | Everyone |
| `api.get/post/patch`, `useApiQuery`, `Card`, `Button`, `Modal`, `Badge`, `Field` | `frontend/src/lib`, `hooks`, `components/ui` | Everyone |

**Collection ownership.** Only the owner changes a collection's schema. Anyone may read it.

| Collection | Owner |
|---|---|
| users, parks, zones, rangerteams, notifications | Leader (shared) |
| alerts, patrolrecords, patrolassignments, allocationdecisions, emergencydispatches | HETTIGE K.C. (UC04) |
| conflictreports, responsetasks, responseactions | WITTAHACHCHI D.K.G (UC01) |
| wildlifeincidents, incidentphotos | KALMADU H L G (UC03) |
| conservationreports, analysisresults | JALATHGE C.A.J (UC02) |

## 6. Design critique table (fill in before coding)

| Original design / reference | Problem | Agreed improvement | Owner |
|---|---|---|---|
| UC04 scenario, step 4 (p. 45) | "Under-patrolled" is never defined | Explicit rule with per-park thresholds set by risk level. See `docs/design/UC04-patrol-management.md` | HETTIGE K.C. |
| UC04 scenario (p. 45) | The supporting actor (Ranger) never takes part | Notify the assigned team; the ranger acknowledges the assignment | HETTIGE K.C. |
| UC04 sequence diagram (p. 47) | The update and the "record decision" are two separate calls from the UI, which breaks E3 | One service call inside a MongoDB transaction | HETTIGE K.C. |
| UC03 — *add rows* | | | KALMADU H L G |
| UC01 statuses (pp. 7–23) | Legal status changes are never defined | Explicit transition table with a history entry per change | WITTAHACHCHI D.K.G |
| UC01 main step 3 | Critical reports would wait for approval; team availability is not shared with UC04 | Route per priority (direct / approval / emergency dispatch) and the shared `teamService.commitTeam` inside one transaction | WITTAHACHCHI D.K.G |
| UC01 A3, A4 | "Inadequate location" and "duplicate" are undefined | GPS or village + landmark; duplicates = same park, 12 h, 2 km or same village; one open task per report | WITTAHACHCHI D.K.G |
| UC01 E1–E4 | Notification failure could block the business flow; E4 implies a task can arrive offline | Fallback adapter (in-app → simulated SMS) after commit with recorded attempts; E4 reordered: received task → local update → reconnection → server confirmation | WITTAHACHCHI D.K.G |
| UC02 — *add rows* | | | JALATHGE C.A.J |
| Whole system (p. 4) | Group 41 plans a native mobile app plus web dashboards | One responsive PWA with offline incident storage. See `docs/DECISIONS.md` ADR-001 | Everyone |

The full UC04 critique is in `docs/design/UC04-patrol-management.md`. Each member creates `docs/design/UC0x-*.md` in the same format.

## 7. Integration checks (5–6 Oct)

Use **one** backend and the shared `wildguard` database for the demonstration.

- [ ] A ranger reports an incident (UC03), it syncs, and an alert appears on the Patrol Coverage dashboard (UC04).
- [ ] The analyst's analysis (UC02) includes that incident, and its coverage figures match UC04.
- [ ] A villager submits a conflict (UC01), the liaison officer assigns a team, and the team shows as `responding` in UC04.
- [ ] An offline incident synchronises exactly once (no duplicate).
- [ ] A saved conservation report can be reopened, shared with the Park Manager (notification) and exported to PDF.
- [ ] A villager who opens a manager screen sees "Access denied".

## 8. Definition of done and submission check

- The PR into `dev` is reviewed by one teammate. The app builds (`npm run build`) and lint passes (`npm run lint`).
- Tests pass with **>80%** coverage for the module.
- The UI matches the agreed wireframes, and every scenario in the report is implemented.
- **Before submitting:** clone the repo into a fresh folder, follow the README, run `npm run seed`, start both apps and run the tests. Confirm the report describes exactly this version.

## 9. Atlas and secrets

- **Never commit `.env` files.** `.gitignore` excludes them. Share credentials only through a private channel.
- The leader creates **one Atlas database user per member** (Atlas → Database Access) and adds each member's IP address (Atlas → Network Access).
- While developing, set a personal database in `backend/.env`, for example `MONGODB_DB_NAME=wildguard_kalmadu`. That way `npm run seed` only resets your own data. The shared `wildguard` database is for integration and the demo.
