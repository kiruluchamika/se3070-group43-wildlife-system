# Mobile feature matrix

Implementation inventory based on current frontend routes/components and backend routes, schemas, services, design notes and seed workflows. All rows marked **implemented** have connected native code; this does **not** mean physical-device validation passed. `Unit` means automated logic/contract checks; `integration` is reported separately in MOBILE_TEST_REPORT. Every native interaction remains subject to the Android/iOS checklist.

Packages shorthand: **Core** = React Native, Expo Router, TanStack Query; **Secure** = SecureStore; **Field** = location, image-picker, image-manipulator; **Queue** = SQLite, crypto, NetInfo; **SVG** = react-native-svg; **PDF** = file-system, sharing. Endpoint paths omit `/api`.

| Web functionality | Role | Mobile screen | Backend endpoints | Packages | Implementation | Validation |
|---|---|---|---|---|---|---|
| Login and persisted session | All six | Login / protected layout | POST auth/login; GET auth/me | Core, Secure | Implemented | Unit session/login/logout/401; device pending |
| Public signup | Villager | Login → registration | POST auth/register | Core, Secure | Implemented; no elevated role selector | Client/server validation; device pending |
| Demo email selection | Five seeded roles | Login, development only | POST auth/login | Core | Implemented; password entered by user | Production guard in code; device pending |
| Role dashboard / navigation | All six | Overview / Workspace | Role-specific lists/coverage/tasks/reports | Core | Implemented | Unit direct-route/menu guards |
| Account / connection diagnostics | All | Profile | GET auth/me; GET health | Core, Secure | Implemented | API client unit tests |
| Notification count/list/read/link | All | Notifications tab | GET notifications/me; PATCH notifications/:id/read, read-all | Core | Implemented; foreground polling | 204 and URL/role mapping unit tests |
| Conflict capture, damage, danger, GPS, evidence | Villager | Report a conflict | POST conflicts; GET parks | Core, Field | Implemented | Native permissions/photos pending |
| Own reports, reference/priority/status | Villager | Conflict reports / case | GET conflicts/mine, conflicts/:id | Core | Implemented | UC01 integration path; device pending |
| Information-request reply | Villager | Case → reply | PATCH conflicts/:id/information | Core, Field | Implemented | Backend enforces request state; device pending |
| Officer queue filters and search | Liaison | Conflict reports | GET conflicts?view= | Core | Implemented | Counts/status contract inspected; device pending |
| Validate/reject/set priority | Liaison | Case | PATCH conflicts/:id/validation | Core | Implemented | UC01 integration path; device pending |
| Request further information | Liaison | Case | PATCH conflicts/:id/information-request | Core | Implemented | State-aware control; device pending |
| Duplicate inspection/linking | Liaison | Case → candidates | GET conflicts/:id/duplicates; PATCH duplicate | Core | Implemented; explicit confirmation | Backend rule tests; native flow pending |
| Team ranking/ETA/deployment/resources | Liaison | Case → deployment | GET conflicts/:id/teams; POST deployments | Core | Implemented; backend route respected | UC01 integration path; alternate routes pending |
| Escalation/no-team recovery | Liaison | Case | PATCH conflicts/:id/escalation | Core | Implemented | State-aware; device pending |
| Retry / alternative contact and history | Liaison | Case | POST contact-retry, alternative-contact; GET conflicts/:id | Core | Implemented | Backend response rendered; device pending |
| Resolve/monitor/escalate completed response | Liaison | Case → review | PATCH conflicts/:id/review | Core | Implemented; only completed responses | UC01 integration path; monitoring device pending |
| Approve/reject/alternative team | Manager | Response approvals | GET response-tasks/approvals; GET teams; PATCH approval | Core | Implemented | Backend park/team checks preserved; device pending |
| Response assignment / case view / acknowledge | Ranger | Response tasks | GET response-tasks/mine, conflicts/:id; PATCH acknowledge | Core, Queue | Implemented | UC01 integration path |
| Field actions/GPS/completion offline queue | Ranger | Response tasks / Field reports | POST actions; PATCH complete | Core, Queue, Field | Implemented | Queue retry/owner/failure tests; device persistence pending |
| Wildlife/poaching incident capture | Ranger | Report an incident | POST incidents; GET parks | Core, Queue, Field | Implemented | UC03 integration path; camera/GPS pending |
| Local queue, retries, receipts | Ranger | Field reports | POST incidents/actions/complete | Queue | Implemented | Unit persistence protocol, lost-receipt and isolation checks |
| Received incident details/photos | Ranger | Field reports / details | GET incidents/mine, incidents/:id | Core | Implemented; latest 50 server cap | UC03 integration path; device pending |
| Patrol coverage, risks, recency, recommendations | Manager | Patrol coverage | GET patrol/coverage | Core | Implemented from server fields | Native bundle; UC04 integration path |
| Zone map, selection, team positions/routes | Manager | Patrol coverage | GET patrol/coverage | SVG | Implemented; illustrative geometry labelled | Coordinates read from API; device map interaction pending |
| Team assignment and confirmation | Manager | Selected patrol zone | GET patrol/teams; POST patrol/assignments | Core | Implemented | UC04 integration path |
| Reassignment/reason/priority override/impact | Manager | Selected patrol zone | POST patrol/assignments/reassign | Core | Implemented | Server constraints preserved; device flow pending |
| Team/assignment listing and completion | Manager | Ranger teams | GET patrol/teams, patrol/assignments; PATCH complete | Core | Implemented | UC04 integration path |
| Alerts/status filtering/acknowledgement | Manager | Operational alerts | GET alerts; PATCH alerts/:id/acknowledge | Core | Implemented | Backend enums respected; device pending |
| Emergency recommendation/diversion/dispatch | Manager | Alert → prepare dispatch | GET recommendations; POST emergency-dispatches | Core | Implemented | Backend candidates/ETA/impact shown; device pending |
| Allocation decision history | Manager | Allocation history | GET patrol/decisions | Core | Implemented | UC04 integration path |
| Ranger patrol assignment and acknowledgement | Ranger | My patrol assignment | GET patrol/my-assignment; PATCH acknowledge | Core, Queue cache | Implemented | UC04 integration path; offline reopen pending |
| Park/date/type/species retrieval | Analyst | Conservation analytics | GET analytics/options, analytics | Core | Implemented | Date and report-contract tests; UC02 integration path |
| Freshness confirmation / source limitations | Analyst | Retrieval results | GET analytics | Core | Implemented | Backend flag gate inspected; device pending |
| Trends, hotspots, patrol effort | Analyst | Results | Retrieved analytics records | Core, SVG | Implemented with unchanged web formulas | Exact-copy parity and timestamp tests |
| Multi-park comparison | Analyst | Select multiple parks / results | GET analytics?parkIds= | Core, SVG | Implemented | Web calculator parity; device comparison pending |
| Source/category/zone traceability and record pages | Analyst | Results → source records | Retrieved analytics records | Core | Implemented | Web selector parity; device pending |
| Report narratives/preview/draft/finalized save | Analyst | Results → prepare report | POST reports | Core, crypto | Implemented | Snapshot schema + UC02 integration path |
| Draft edit/revision conflicts | Analyst | Saved report | PATCH reports/:id | Core | Implemented | UC02 stale-edit integration path |
| Restore filters/re-analysis/atomic replacement | Analyst | Draft → re-analyze | GET reanalysis; POST reports + replaceDraft | Core | Implemented | Revision payload unit test; device cancel/failure pending |
| Report list/status/pagination/read-only view | Analyst, Manager | Saved reports | GET reports, reports/:id | Core | Implemented | Server authorization retained; device pending |
| Share finalized report with managers | Analyst | Finalized report | GET recipients; POST share | Core | Implemented | UC02 integration path |
| Server PDF download/native sharing | Analyst, Manager | Finalized report | GET reports/:id/export | PDF | Implemented | Binary client unit test; OS sheet/device pending |
| User list/create/edit/activate/deactivate | Administrator | User management | GET/POST users; PATCH users/:id, status | Core | Implemented (sixth actual role) | Existing backend constraints; device pending |

## Gaps and verification boundary

No fake screen data or new API/database was introduced. Significant current web operations have connected mobile controls. Desktop-specific browser/PWA installation/update prompts are replaced by Expo Go setup instructions. Source calculations are reused verbatim; native chart presentation is adapted rather than pixel-identical.

The requested source SRS PDF is absent; exact original-page traceability remains blocked as already documented in UC03. No closed-app background sync or remote push integration is claimed. Physical Expo Go runtime, native permission-denied scenarios, font scaling, keyboard layouts and visual polish remain manual acceptance work. See MOBILE_TEST_REPORT for current executed checks; implementation rows are not acceptance sign-off.
