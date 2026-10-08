# WildGuard mobile demonstration

Use a dedicated seeded demo database and the same backend URL for web and mobile. Start backend, web and Expo as described in `app/README.md`. Sign in online first. The development email selector uses real seeded users; enter the configured seed password. Dates below should be current dates in Asia/Colombo. All mutations affect the shared backend.

## 1. Villager conflict report

**Role:** `villager@wildguard.lk`. **Prerequisite:** seeded park and an online backend.

1. Open Report a conflict; choose the park, elephant sighting, village/landmark, time, description and contact.
2. Use GPS or provide a clear landmark. Optionally attach a compressed photo. Confirm submission.
3. Record the displayed HEC reference, suggested priority and location adequacy.
4. Open the case from Conflict reports and pull to refresh after officer actions.

**Expected:** a real report visible on the liaison website and mobile. **Endpoints:** POST conflicts, GET conflicts/mine and conflicts/:id. **Reset:** use a new labelled demo report, or reseed only the dedicated demo database. **Simulator limit:** manually enter a location when GPS/camera is unavailable.

## 2. Liaison triage and deployment

**Role:** `liaison@wildguard.lk`. **Prerequisite:** demo 1 in the officer's assigned park; a free team for direct deployment.

1. Open Conflict reports → New; search the reference and open it.
2. If location is inadequate, request information; switch to the villager to reply and return to the officer.
3. Inspect duplicate candidates before validation. Link only a deliberately created duplicate after confirmation.
4. Validate with medium priority for direct deployment. Select a team using server distance/ETA; enter instructions and confirm.
5. Repeat with high priority/additional resources to demonstrate manager approval, or use escalation if no team is free.

**Expected:** proper workflow status and notifications, with no second assignment to a busy team. **Endpoints:** conflict queue/detail, information-request/information, duplicates/duplicate, validation, teams, deployments, escalation. **Reset:** finish the response to free its team; seeded reset only on demo DB. **Simulator limit:** no SMS delivery proof; simulated delivery remains labelled.

## 3. Ranger response

**Role:** `ranger@wildguard.lk`. **Prerequisite:** a task assigned to this seeded ranger's team (normally Team Charlie); select that team during demo 2.

1. Open Response tasks and inspect the case/instructions.
2. Acknowledge. Capture GPS or manual location and save an arrival action.
3. Open Field reports and confirm the action reaches Synced.
4. Save completion with an outcome and notes. Wait for server receipt.
5. Return as liaison and review the completed case as resolved, monitoring (future follow-up), or escalated.

**Expected:** stable IDs prevent duplicate field updates, the completed team is freed, and the villager sees the outcome. **Endpoints:** response-tasks/mine, acknowledge, actions, complete; conflicts/:id/review. **Reset:** create another eligible report/task. **Simulator limit:** device GPS may be simulated; label it accordingly.

## 4. Offline incident evidence

**Role:** Ranger. **Prerequisite:** successful online login and opened parks/field screens; Expo bundle cached on the device.

1. Disable the phone's network. Capture an incident with a real photo, GPS/manual location, observation time and description.
2. Save locally. Confirm Queued rather than claiming server success.
3. Close/reopen the app without clearing Expo Go storage; inspect the retained queue entry and photo payload.
4. Reconnect with the app active; use Synchronize now if needed.
5. Confirm Synced and view the received incident. A snare/fire/other actionable type should produce the normal manager alert.
6. For lost-response retry testing, interrupt network during send, then retry the unchanged record and verify a single server incident/alert.

**Expected:** no silent loss, stable clientId, photos retained until receipt. **Endpoints:** POST incidents, GET incidents/mine, incidents/:id; manager GET alerts. **Reset:** do not clear phone storage until pending records are received; create a new report for repetition. **Simulator limit:** Expo Go may need Metro to reload a bundle; closed-app background sync is not promised.

## 5. Park manager operations

**Role:** `manager@wildguard.lk`. **Prerequisite:** seeded under-patrolled zones and available/on-patrol teams; eligible high/critical alert.

1. Open Patrol coverage, choose the park and inspect risk/reasons/recency on the map and cards.
2. Select a zone and available team; review distance/ETA and confirm allocation.
3. Select an occupied team and another zone. Inspect current/target priorities, provide reason and explicitly override only when intended.
4. Open Operational alerts, acknowledge one, prepare emergency dispatch and inspect available/divertible candidates.
5. Confirm dispatch, inspect the updated team/alert, then complete it through Ranger teams.
6. Inspect Allocation history and Response approvals for high-priority conflict requests.

**Expected:** transactional assignments, server-enforced availability, diversion consequences and history. **Endpoints:** patrol coverage/teams/assignments/reassign/complete/decisions; alerts/acknowledge; emergency recommendations/dispatch; response approval. **Reset:** complete test assignments before repeating; dedicated DB reseed only. **Simulator limit:** illustrative polygons are not official boundaries.

## 6. Analyst reporting

**Role:** `analyst@wildguard.lk`. **Prerequisite:** seeded or just-created source records in a permitted park/date window; backend Chromium for PDF.

1. Open Conservation analytics; select park(s), inclusive dates, optional type/species; retrieve.
2. Review freshness and explicitly continue if pending sources require confirmation.
3. Inspect trends, hotspots, patrol effort, comparison and source record references.
4. Enter title/findings/recommendations, preview, save Draft.
5. Open Saved reports; edit a narrative. In a second client edit the same draft to demonstrate stale revision handling, then refresh.
6. Restore filters and re-analyze. Cancel to demonstrate preservation, then repeat and save Finalized to replace the draft transactionally.
7. Select an authorized manager, share, and download/share the server PDF.
8. Sign in as manager and view the shared read-only report/PDF.

**Expected:** identical web/mobile definitions and saved snapshots; finalized content is read-only. **Endpoints:** analytics/options and analytics; reports create/list/detail/edit/reanalysis/recipients/share/export. **Reset:** create a new report; finalized reports are intentionally immutable. **Simulator limit:** native share destinations depend on installed apps.

## 7. Notifications

**Role:** recipient of demo 2, 3, 5 or 6. **Prerequisite:** a backend event notifying that account.

1. Open Notifications, refresh or wait for foreground polling.
2. Verify unread badge, title, message and timestamp.
3. Mark one as read, then open its related screen. Mark all as read and verify count.

**Expected:** current account's server notifications only. **Endpoints:** notifications/me, :id/read, read-all. **Reset:** trigger another legitimate event. **Simulator limit:** no remote push claim; SMS may be simulated.

## 8. Web/mobile synchronization

**Roles:** Villager → Liaison → Ranger → Manager → Analyst. **Prerequisite:** both clients point to the same API/database.

1. Submit a labelled report on mobile; refresh the liaison website and locate its reference.
2. Validate/deploy on web; refresh ranger mobile, acknowledge and capture an action.
3. Refresh manager web to inspect team state/notifications; complete the response on mobile and review on web.
4. Retrieve the day's analytics, share a finalized report; verify the manager can open it on either platform.

**Expected:** one set of shared records, role restrictions preserved. **Endpoints:** all relevant UC01–UC04 mappings in MOBILE_API_MAPPING. **Reset:** finish assignments and retain references; reseed only an isolated demo database if a clean start is needed. **Simulator limit:** network topology differs—Android emulator uses 10.0.2.2; physical devices use the computer LAN IP.

## Administrator extension

The current website has a sixth role. With a provisioned administrator, open User management, create a test staff account, edit its permitted fields, deactivate/reactivate it, and verify self-deactivation/team-assignment protections remain enforced. Public registration never creates staff. There is no seeded administrator password embedded in mobile.
