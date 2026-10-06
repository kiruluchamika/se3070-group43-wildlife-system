# UC02 — Analyze Conservation Data and Generate Reports

**Owner:** JALATHGE C.A.J (IT23751446) · **Branch:** `feature/conservation-reports`

Stage 2 implements read-only retrieval and known synchronization checks using
the existing repository/service/router layers. Stage 3 consumes that response
in the frontend for core statistics. Stage 4 adds trends, hotspots and patrol
effort visualizations from that same dataset. Stages 6–7 add preparation,
preview and explicit Draft/Finalized saves. Stage 8 adds Draft text editing and
filter restoration for re-analysis. Stage 9 adds finalized sharing and browser
print-to-PDF export.

## Stage 4 analysis and visualizations

`calculateVisualizations` consumes the normalized, within-source deduplicated
Stage 3 arrays and the original Stage 2 context. Each section is calculated once
per dataset with React memoization. No additional analytics API or source fetch
was added. Individual calculation errors do not hide the other sections.

- Trends: daily buckets for selections of at most 62 days; monthly otherwise,
  using Asia/Colombo calendar boundaries and zero-filled periods. Alerts use
  `createdAt`; conflicts use `occurredAt`. Separate series avoid suggesting these
  are unique incidents. Patrols are excluded. The SVG chart includes distinct
  line/marker styles and a table of exact aggregate values. At most 1,200 buckets
  are rendered; wider ranges return a safe request-to-narrow-period message.
- Hotspots: exactly >=3 zone-linked alert event records within the selected
  interval. Current conflicts lack a zone field and do not contribute. Unknown
  zones and invalid timestamps are reported as omissions, never fabricated.
  Simulated records and all returned statuses remain included, consistent with
  Stage 3. These are alert-event hotspots, not verified unique wildlife incidents.
- Map: existing Leaflet/React Leaflet and CARTO theme conventions, using only
  valid stored GeoJSON polygons (including interior rings). Hotspot labels,
  counts, solid/dashed outlines, tooltips and popups supplement color. Missing
  geometry leaves the count list usable; tile errors leave stored outlines.
  Existing seed boundaries are illustrative, not official geographic claims.
- Patrol coverage uses UC04's effort-versus-target semantics. Let C be the
  earlier of the selected exclusive end and `retrievedAt`, and S the start.
  Sum each patrol's positive overlap with [S,C] in hours. An absent `endTime`
  means ongoing, ending at C for this calculation. Per-zone target =
  `targetWeeklyPatrolHours * ((C-S)/86400000) / coveragePolicy.windowDays`.
  The policy window defaults to 7 as in UC04. Coverage =
  `min(100, round(100 * hours / proratedTarget))`. This agrees with UC04's
  hours/target percentage for a full policy window. It is a proportional-target
  extension for arbitrary analysis periods, not completed-patrol or area coverage.
  Current configured targets are used because historical target versions do not
  exist. Active assignments, risk classifications and recommendations are not
  inferred. Invalid targets yield unavailable percentages; invalid patrol times
  or zone references are omitted and disclosed. Future time never contributes.
- Incident type applies only to alerts/conflicts. Park/date context applies to
  every section. Species remains unsupported. Available pending-sync records
  remain included after the user's existing Continue decision.
- Buckets, hotspot rows and coverage rows retain `{ source, recordId } references
  for supporting records. Category metadata includes hotspots only when
  a hotspot exists. The common Supporting Records action opens the Stage 5 modal.

## Stage 5 supporting records

The Results page shares its memoized visualization result with the existing
WildGuard modal. Opening or closing it does not navigate, retrieve data again,
or modify the dataset, filters, freshness decision or statistics.

- All Results indexes the Stage 3 normalized sources by source and record ID.
  Equal IDs across sources remain separate; duplicates within a source do not.
- Trends resolves the exact bucket references; Hotspots resolves the exact
  qualifying zone references, optionally restricted to one actual hotspot.
  The Hotspots category is omitted when no hotspot exists.
- Patrol Coverage resolves the exact contributing patrol references, with an
  optional zone selection. Invalid/noncontributing intervals remain available
  in All Results but are not claimed as coverage contributions.
- Records are selected in memory and displayed 25 per page. Changing category
  resets zone/page; reopening defaults to All Results. Empty and failed sections
  have distinct messages. Tables scroll horizontally on narrow screens.
- Dates use Asia/Colombo. Alerts show their stored source/status, conflicts their
  stored status, and patrols their start/end times and actual syncStatus. Missing
  times/zones/states are labeled Not recorded. No completion status, species or
  synchronization timestamp is invented. UC03 remains disconnected.

`analytics.supporting-records.test.js` exercises the actual selection functions
and dialog state reducer through existing Vitest. Browser interaction, responsive
layout, theme and focus checks remain manual; reducer tests are not DOM tests.

Tests in `analytics.visualizations.test.js` run the exact frontend calculations
through existing Vitest, including the threshold boundaries, local dates,
deduplication, malformed data, coverage clipping/proration and UC04 parity.
No chart dependency, seed additions, model changes or UC03 changes are needed.

## Stage 3 statistics

The existing `ready` state renders `AnalysisResultsPage` on `/analytics`.
`calculateStatistics` is a pure frontend function over the Stage 2 response;
there is no additional retrieval endpoint or second filtering implementation.
Calculations are synchronous and memoized, so no artificial analysis delay is
introduced. Stage 2 loading and freshness Continue/Cancel behavior is retained.

- Event records = alert record count + conflict record count. This is a record
  inventory, not a unique event/incident estimate; sources may overlap.
- Each source counts distinct record IDs within that source. IDs are never
  merged across sources. All returned statuses and simulated records count.
- Patrol records are retained and counted separately, excluded from events.
- Zones represented = distinct known zone IDs referenced by alerts or patrol
  records. Conflicts have no zone field. Unknown/missing references and unused
  reference zones do not contribute. This is not a hotspot/coverage measure.
- Context copies the response filters, park and period. Species is labeled
  unavailable. Returning to filters preserves the form in the parent page.
- Empty source arrays show an empty state, even if park zones exist. Patrol-only
  responses explicitly explain that no alerts/conflicts matched. Invalid source
  structures produce a safe error rather than zero or partial counts.
- The result retains separate source arrays and freshness for future analytics.
  Continue to Report opens the Stage 6 findings step for this analysis.

## Stage 6 report preparation

The analysis route now hosts Results → Findings & Recommendations → Report
Preparation. Back to Findings and Back to Analysis preserve the title and both
text fields in the Results component's reducer. The existing retained dataset,
memoized statistics/visualizations and supporting references remain unchanged.
No new retrieval is needed. Stage 7 uses Reports for saved records only;
unfinished preparation and preview remain within Analysis.

There was no existing conservation-report schema or required narrative contract.
Findings/recommendations are optional (5,000 characters each); title is required
for generation (200 characters). Inputs start empty and are never generated.
Preparation allows reviewing/editing all three fields. The summary preserves
source semantics and per-zone coverage, without inventing an overall percentage.
Empty/error sections and unavailable species remain explicitly identified.

Generate Report validates and stores an isolated in-memory handoff containing
the entered text, context, statistics, visualizations, source references and
original dataset. Stage 7 now consumes it in Preview. Editing clears the previous
handoff. Leaving Analysis, returning to filters, retrieving again or refreshing
clears this unsaved session; the UI discloses this.

Tests cover reducer navigation, retained inputs/context, validation, snapshot
isolation, summary rendering and the generation boundary. Browser focus, mobile
layout and light/dark presentation remain manual checks.

## Stage 7 preview and persistence

Generate creates only a Preview and a client request UUID. Back to Preparation
preserves the report text and current dataset. Preview renders React-escaped
text, the existing analysis summary/trend chart, actual hotspot rows and per-zone
patrol coverage. It never marks itself Draft or Finalized until a save succeeds.

Save as Draft / Save as Finalized POST the selected status to `/api/reports`.
The new `ConservationReport` model is the only added collection; no equivalent
conservation-report infrastructure existed. Server-owned author, park, creation
time and optional finalization time accompany title, findings, recommendations
and a bounded analysis snapshot. The snapshot keeps filters, period, park name,
retrieval time, statistics, trends, hotspots, coverage and supporting source IDs.
Raw source documents, map geometry and duplicate retrieval data are not stored.
References preserve source boundaries, including IDs shared across sources.

The server validates lengths, known statuses, supported filters, period/park
consistency, numeric shapes, source counts and contributing references. This is
an analyst-submitted snapshot of the browser calculation, not a server-signed
historical source attestation. Save does not re-query/recalculate current field
data, which could have changed since analysis. Future editing can reuse stored
text/results; source IDs provide traceability but do not freeze raw source records.

JWT role checks and a current-account check restrict all endpoints to analysts.
Saves enforce the assigned park; reads require ownership and current park access.
Stage 9 allows managers to read explicitly shared finalized reports in their
permitted park; they cannot read unshared reports. List responses
contain only summaries, paginated at 20, and detail reads return the saved snapshot.

A unique `(author, requestId)` index and a server content hash make identical
retries idempotent, including races. Reusing a request ID with different content
or status returns 409 without changing the original record. Stage 8 adds a
restricted Draft-text update endpoint. Stage 9 adds sharing and export; no report
delete endpoint exists. Finalized content remains read-only.

Successful saves navigate to `/reports?reportId=<id>&saved=1`; confirmation and
badges use the persisted status. Reports can also be reopened from the basic list
after refreshing. Errors retain the preview; duplicate clicks are blocked while
saving. Payloads above 950,000 UTF-8 bytes are rejected before submission with an
instruction to use a shorter analysis period, below the existing API 1 MiB limit.
No report data is silently truncated and no global request limit is increased.

Tests exercise real MongoDB persistence, ownership/park/role checks, validation,
concurrent retries, conflict handling, safe text rendering, save callbacks,
navigation, failure/retry behavior, and earlier freshness/supporting-record flows.
Manual checks: run both save choices on separate previews; refresh and reopen
each report; verify Back preserves text, failed saves retain Preview, and inspect
mobile/tablet/light/dark layouts and keyboard focus. No production seed is needed.

## Stage 8 Draft editing and re-analysis

Reports labels Draft rows with Open Draft and renders an editor only for Draft
details. Finalized details retain the read-only report component. The editor
reuses the report validation/form components: title is required (200 characters),
findings/recommendations optional (5,000 each). Original filters and result
summary are read-only. Save Changes PATCHes only these three text fields and an
expected revision; status, snapshot, park, author and finalization time cannot
be changed through that endpoint. Failed saves keep the typed text for retry.

The repository atomically matches owner, permitted park, Draft status and revision
before updating. Each successful edit increments a small concurrency counter;
this is not version history. Older reports without a counter behave as revision
0, so no migration is needed. A stale conflicting save returns 409 DRAFT_CHANGED.
An identical retry of the immediately preceding edit returns that saved result.
The original creation request's immutable hash remains separate from edits, so
retrying creation cannot roll back subsequent Draft changes.

Re-analyze is available only for a saved Draft with no unsaved text edits. It
navigates to `/analytics?draftId=<id>`, where an authorized GET to
`/api/reports/:id/reanalysis` returns only the stored filters, report ID and title.
Both endpoints recheck current account role, ownership and park access; Finalized
reports return 409 REPORT_READ_ONLY. The link contains no trusted snapshot data.

The Analysis route loads these filters into the existing AnalysisFiltersPage,
labels them as previous report filters, and allows edits. No analysis runs until
Analyze Data is selected. The same retrieval hook, pending-patrol freshness
decision, Results page, Supporting Records and report workflow are used. Freshness
Cancel returns to the populated form. Cancel re-analysis returns to the original
Draft; after Results, Back to Filters also exposes that action.

Re-analysis only reads the original Draft. It never PATCHes it, and the new report
workflow starts with empty title/findings/recommendations to avoid stale narrative.
Generate/Preview still require an explicit Draft/Finalized save, using a new UUID
and creating a separate record. Even after a new save, the original Draft remains
intact. Normal workflow navigation retains session input; leaving or refreshing
an unsaved analysis resets it as before. Unsaved Draft text is disclosed in the
editor and must be saved before Re-analyze is enabled.

Tests cover real persisted edits, legacy counters, concurrent conflicts, field
validation, Finalized protection, access checks, filter restoration, cancellation,
separate new saves, editor callbacks and the normal freshness/results transition.
Manual checks: edit/save/reopen a Draft; attempt concurrent edits in two tabs;
re-analyze with unchanged/changed filters; exercise freshness Continue/Cancel;
complete a new report and verify the original; inspect mobile and both themes.

## Stage 9 finalized sharing and export

Finalized detail reuses ReportContent and adds Share/Export. Drafts continue to
use DraftEditor and expose neither action. Share opens the existing Modal with
a scrollable checkbox list, selected count, Cancel and Share Report confirmation.
No recipients, loading failures, empty selection and failed shares have explicit
feedback. Selection survives failures; request locks prevent duplicate clicks.

Eligible recipients come from the existing `userRepository.listByRole` with
`park-manager` and the report park: same-park managers plus managers with no home
park, who cover all parks under the existing staff convention. The API returns
only IDs/names. The server independently rechecks current analyst role, ownership,
park, Finalized status and every selected recipient. Requests accept up to 100
recipients. Opening the dialog is read-only.

Sharing adds recipient IDs to `sharedWith` on the existing report, without
changing content, status or report timestamps. The existing transaction runner
atomically grants access and calls `notificationService.notifyUsers` for newly
added recipients with an in-app link to the report. Failure rolls both back;
repeated/concurrent shares do not add duplicate grants or notifications. No new
collection, external messaging system or notification delivery channel is added.

Managers see only explicitly shared Finalized reports, filtered by their current
park. Role/park changes are checked on every read/export. Managers cannot edit,
re-analyze or re-share. Analysts retain their existing owner/park restrictions.

The work plan requires PDF export but the project had no export/PDF utility.
Export therefore uses browser print-to-PDF without a new dependency: an authorized
GET builds a standalone script-free UTF-8 HTML document from the stored snapshot;
the browser opens it and invokes Print. The user chooses Save as PDF. Exact trend
tables replace the interactive chart; all core context, statistics, hotspot
counts, per-zone coverage, omissions and narrative are included. All content is
HTML-escaped, inline CSP blocks scripts/network access, and filenames/URLs are
not derived from analyst text. Fonts come from the browser/system, preserving
Unicode where installed. Page headers and repeated table headers aid printing.

Export is read-only and rejects Drafts. An analyst owner or authorized recipient
manager can export. Popup/network/authorization/print failures show retry feedback;
the UI never claims a file was saved, since the browser controls destination and
cancellation. A popup must be allowed, and a browser/OS PDF print destination is
required. There is no server-side PDF engine or automatic PDF download.

Tests cover eligible managers, multi-recipient sharing, atomic rollback, duplicate
requests, recipient read/export access, role/park changes, immutability, escaped
export content, dialog callbacks and print failures/retries. Manual validation:
use one/multiple managers, follow an in-app notification, test modal keyboard and
Escape behavior, enable popups, choose Save as PDF and inspect a long/Unicode
report. Check mobile/light/dark layouts and existing Draft/freshness flows.

`analytics.statistics.test.js` uses the existing backend Vitest runner to test
the exact dependency-free frontend calculation. The MongoDB repository test also
passes serialized query results through it to verify filter-dependent totals.

## Stage 2 API and source contract

- `GET /api/analytics/options`: current Data Analyst's permitted parks and the
  union of existing alert/conflict type enums. Species options are empty.
- `GET /api/analytics?parkId=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&incidentType=...`:
  returns `{ filters, retrievedAt, period, park, zones, records, freshness, limitations }`.
  `records` contains separate `alerts`, `conflicts`, and `patrolRecords` arrays.
- Both endpoints use existing JWT/role middleware and recheck the current user.
  The existing staff convention applies: a home park restricts access to that
  park; an account with no home park covers all parks.
- Dates include both selected calendar days in `Asia/Colombo` (+05:30).
  Database queries use an inclusive start and exclusive next-day end.
- Alerts use `createdAt` because they have no event timestamp; conflicts use
  `occurredAt`; patrols must overlap the requested interval. Ongoing patrols
  are included if they started before the interval ends.
- Incident type matches `Alert.type` and `ConflictReport.conflictType` exactly.
  It does not restrict patrols or zones, which are coverage context.
- Species is currently unavailable; nonempty species requests are rejected,
  not silently ignored. No species are inferred from text or alert types.
- Queries use existing collections without changing their schemas. Contact
  details, reporter identities and evidence blobs are omitted. Each record
  source is limited to 5,000 matches; larger results fail with
  `ANALYTICS_RANGE_TOO_LARGE` rather than silently returning partial data.

## Freshness semantics

Only a retrieved `PatrolRecord.syncStatus === 'pending'` triggers confirmation.
Neither age nor `createdAt`/`updatedAt` is a last-sync indicator. Synced patrols
do not warn. Camera/GPS alerts have unknown synchronization state and no known
last successful synchronization timestamp; they do not automatically warn.
The API returns `lastSuccessfulSyncAt: null` and the modal says "Not recorded"
when the schema cannot supply that information. Device-local unseen records
cannot be counted or described by this API. No 24-hour rule exists here.

## Frontend handoff and verification

`useAnalysisRetrieval` holds the retrieved dataset in memory. Its phases are
`filters`, `retrieving`, `warning`, and `ready`. Continue retains the same
dataset and moves to the Stage 3 results on `/analytics`; Cancel
discards the pending dataset and keeps the selected filters. Leaving the page
clears this in-memory state. New requests/unmount abort outstanding retrieval.

Existing camera/GPS alert seeds are reused; no new seed data is needed or run.
Pending-sync fixtures live only in analytics tests against isolated in-memory
MongoDB. UC03 remains disconnected and unmodified. Future adapters may extend
`records` and freshness metadata without changing the filter flow. Future UC03
integration must explicitly define unique incident/source relationships before
changing the current separate-source counts or alert-based hotspot semantics.

Manual checks: sign in as an analyst; retrieve a seeded park/date period;
check empty results and invalid ranges; use an isolated test fixture with a
pending patrol to exercise Continue/Cancel; stop the API to check retry;
verify mobile/light/dark presentation. Do not change shared demo data merely
to trigger the warning.

Notes:
- Reuse the UC04 coverage calculation (`modules/patrol/coverage.service.js`) so patrol coverage matches on every screen.
- "Share with Park Manager" should call `notificationService.notifyUsers([managerId], { type: 'conservation-report', link: '/reports/<id>' })`.
- Compute every result from stored records, so the output changes when the filters or the data change.
