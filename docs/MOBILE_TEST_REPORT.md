# Mobile validation report

Recorded 8 October 2026. The user subsequently requested **skip further testing**. No test, typecheck, lint, Doctor or bundle rerun was performed after that instruction. The results below describe the versions exercised earlier, not blanket certification of the final tree.

## Completed before the request to stop testing

| Check | Actual result | Boundary |
|---|---|---|
| `app/npm test` | **20 passed**, 5 files | API, role routes, notifications, queue behavior, real SQLite SQL via Node bridge, React session hooks, forms, analytics parity/contracts |
| `app/npm run test:integration` | **4 passed**, 1 file | Mobile HTTP client → unchanged Express → isolated local MongoDB replica set; one complete mutation workflow per UC01–UC04 |
| `backend/npm test` | **740 passed**, 50 files, 0 failed, 0 pending | Includes real PDF export after Chromium installation |
| Live Atlas-backed read-only smoke | **All five seeded roles passed** | Real login, `/auth/me`, parks, notifications and role-authorized reads; no Atlas demo reseeding or workflow mutations |
| TypeScript | Passed before final date-picker addition | Last attempted check found a missing JSX closing brace in the new DateInput; that edit was corrected, but not rerun after the user's instruction |
| ESLint | Passed before final date-picker addition | Latest form/SQLite/session unit-test changes included in that pass |
| Expo Doctor | **21/21 passed** | Before addition of Expo-resolved native date/time picker |
| Expo dependency check | Identified React types mismatch; corrected with Expo install | Doctor subsequently passed; final picker is SDK-selected version 9.1.0 |
| Android and iOS production export | **Both succeeded** | Earlier tree: 1,581 Android modules / 1,457 iOS modules. Later date-picker/UI/refinement edits were not re-exported |
| Dependency audit | Non-breaking fix attempted; issues remain | Final install reported **30 advisories: 19 high, 11 moderate** in the SDK/dependency tree. Forced fixes propose incompatible Expo/RN/Router versions and were not applied |

The SDK remains 57.0.0-compatible, using Expo 57.0.27, RN 0.86.3 and React 19.2.3. SDK 57 support and native module versions were checked against official Expo documentation, registry metadata and Expo's bundled module matrix. The physical Expo Go 57.0.9 binary was not available to this environment.

## Evidence exercised

- API: bearer headers, JSON payloads, 204 responses, binary PDF, public-login versus protected 401 handling, safe retries, network error normalization and query serialization.
- Session: real React lifecycle with SecureStore/NetInfo bridges mocked; login persistence without passwords, restoration offline, expiry, cache invalidation, logout token/cache deletion.
- Queue: durable pre-send status, identical retry bytes/IDs after lost response, photo retention until receipt, permanent errors, owner isolation, logout stop, disk-write failure, completion ordering behind failed actions.
- SQLite: actual SQLite SQL through a Node adapter to Expo's interface; persisted payload survives connection/module restart; owner filtering and logout cache cleanup preserve queued evidence. This does not validate the Expo native SQLite bridge itself.
- Analytics: copied source calculators match the web files exactly; Sri Lanka event-date bucketing; generated report accepted by the real backend snapshot schema; replacement revision retained.
- UC01 integration: report, validation, deployment, acknowledgement, idempotent action, completion, officer resolution and villager readback.
- UC03 integration: photo incident and identical replay result in one incident and one operational alert.
- UC04 integration: backend coverage, allocation, ranger acknowledgement, manager completion and decision history.
- UC02 integration: retrieval, computed draft, edit, stale revision rejection, atomic finalization, authorized share and manager access/notification.

## Problems found and handled

1. Router transitive peers initially selected incompatible React DOM/worklets. Expo-resolved versions were installed; both native exports and Doctor then passed.
2. API retry predicate could retry a forbidden error constructed with the default code. Status-aware predicate corrected; unit test passed.
3. React 19 `useRef` initialization and effect/callback lint errors corrected; typecheck/lint passed before the final date input.
4. Backend installation lacked Playwright/fake-indexeddb; restored with `npm ci` without modifying backend source/lockfile.
5. Backend PDF tests initially failed because Chromium was absent. Installed using existing `npm run pdf:install`; all 740 backend tests subsequently passed.
6. Sandbox DNS prevented Atlas startup. Retried with authorized network access; backend connected and the live five-role smoke passed.
7. MongoDB integration first hit an external cache permission error and then a duplicate binary download. Reused the binary installed under backend's node_modules cache; four mobile integration tests passed. The test setup now reuses that cache automatically.
8. Final DateInput JSX typo was corrected after the user asked to skip further testing. Final code remains unverified by a subsequent compile/bundle run.

## Android and iOS acceptance checklist — NOT EXECUTED

Use a phone running compatible Expo Go; repeat on both platforms. iOS Simulator requires macOS, which was unavailable. No Android emulator/device was attached.

| Scenario | Procedure / expected outcome | Status |
|---|---|---|
| Launch / role guards | Scan QR, sign into each role, open each workspace, verify wrong-role deep links are blocked | Not run |
| Small/large layouts | Portrait/landscape, small phone/tablet, large OS text; inspect clipping and touch targets | Not run |
| Keyboard / date picker | Register, long narrative, scroll to submit with keyboard visible; choose date/time on both OSes | Not run |
| GPS allowed/denied | Capture GPS; deny permission and enter valid manual coordinates/location note | Not run |
| Camera/gallery | Capture/select 1–3 photos, preview/caption/remove; deny permission and continue without evidence | Not run |
| Native SQLite restart | Save offline incident/action; close/reopen without clearing storage; payload/photos remain | Not run |
| Reconnect/lost receipt | Interrupt upload, reconnect, verify one server record and confirmed receipt | Not run |
| Account isolation | Logout with queued work, sign in as another user, ensure it is hidden and not uploaded; return to owner | Not run |
| Backend restart/expired JWT | Stop/restart API; confirm recoverable errors and session-expired login behavior | Not run |
| Operational workflows | Execute all eight scenarios in MOBILE_DEMO_GUIDE on mobile and cross-check web | Not run |
| PDF native share sheet | Download finalized report, open/share to an installed app; test failed export recovery | Not run |
| Maps/charts | Select polygon/list zone, inspect team/route coordinates and accessible trend selection | Not run |
| Notifications | Trigger server event, refresh, open related record, mark read/all | Not run |

## Remaining limitations

The final native UI additions have not been revalidated at the user's request. Physical acceptance and dependency advisories remain release blockers for a production-readiness claim. Expo Go cannot guarantee closed-app background synchronization or launch of an uncached development bundle offline. The original Group 41 PDF is missing, so exact original SRS traceability cannot be signed off. Native OS sharing/permissions/SQLite behavior must be validated on devices; passing server/unit tests does not substitute for that.

Commands for a later validation pass are in `app/README.md`. The backend was left running on port 5000 after the successful Atlas smoke check.
