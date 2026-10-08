# WildGuard mobile architecture

## Structure

`app/` is the package; `app/app/` is Expo Router's single route root. The root Stack contains login and a protected Stack. Protected tabs contain Overview, Workspace, Notifications and Profile. `work/[...path]` is a role-guarded stack route dispatching to feature components. The central module registry controls both menu visibility and direct route access. Backend middleware remains authoritative.

| Layer | Files | Responsibility |
|---|---|---|
| Navigation | `app/app`, `src/navigation` | Protected stacks, four tabs, per-role module registry, safe web-notification URL mapping |
| Session | `src/contexts/Session.tsx` | SecureStore token/identity, login/register/me, logout cleanup, 401 expiry, foreground verification |
| HTTP/cache | `src/api/client.ts`, `src/hooks/data.ts` | Absolute URL, bearer auth, 20-second JSON / 60-second PDF timeout, cancellation, typed errors, safe GET retry, owner-keyed queries |
| Offline | `src/storage`, `src/contexts/Sync.tsx` | SQLite durable payloads, serial uploads, owner isolation, stable IDs, explicit failure/receipt states |
| UI | `src/components` | Teal conservation palette, shield/leaf SVG, native fields, selection lists, confirmations, safe areas, keyboard handling, photos/GPS, SVG zone map |
| Workflows | `src/features` | UC01, UC03, UC04, administrator user management |
| Analytics | `src/features/analytics` | Retrieval/freshness, exact web calculations, comparison, traceability, report lifecycle/PDF |

All application code is inside `app/`; no backend or website business behavior was changed. No mobile MongoDB dependency exists. The only mobile environment setting is an absolute API URL. Demo passwords are entered by the presenter; no privileged password is compiled into the bundle.

## Data lifecycle

Read queries are keyed by account and path. Mutations invalidate active queries. Reads poll every 30 seconds in the foreground; AppState updates TanStack Query's focus manager. Park/task/assignment reference data is the only persistent read cache. An offline cache is clearly labelled and never uploaded as an authoritative server snapshot. Logout cancels queries and clears this cache.

For ranger field work, a stable client UUID and full JSON/photo payload are written to SQLite before transmission. The queue persists sending status before the HTTP call. A lost response preserves bytes/ID, making the backend idempotency key effective. A successful receipt releases the sensitive payload/photos and retains minimal receipt metadata. Network/401/5xx stops the current pass; permanent validation/business errors remain failed and need explicit retry. A failed response update blocks later queued updates for that task, preventing a completion from overtaking an unresolved action. Account switching stops subsequent uploads and filters visible records by owner.

Offline storage is app-sandboxed SQLite. SecureStore holds the JWT and minimal identity. SQLCipher would require a custom build and is not claimed for Expo Go. Pending reports survive logout intentionally; there is no silent discard/reset action.

## Analytics consistency

The five pure files under `src/features/analytics/calculations/` are copied unchanged from the website; a test compares their contents to prevent accidental formula drift. The app does not derive operational patrol coverage itself. UC04 renders `coveragePercent`, `status`, `priorityScore`, `effectiveRisk`, `reasons`, recency and recommendations from the API.

UC02's calculations preserve source boundaries, event timestamps, Sri Lanka inclusive dates, hotspot threshold and prorated patrol effort. Comparisons keep separate per-park datasets. `freshness.requiresConfirmation` gates analysis/reporting; unknown freshness is not labelled stale. Draft revision numbers and replacement identities are preserved; a save attempt retains its request UUID/body for retry. PDF is authenticated binary data written temporarily to native cache and shared through the OS sheet.

## Compatibility decisions and discrepancies

- SDK 57.0.27 is the SDK-57 patch line, not an SDK change. Expo's resolver pins React/RN and transitive Router worklet peers. React DOM/Web are installed to satisfy Router peers, not used as application UI.
- SVG geographic diagrams avoid external tiles, API keys, and custom map modules. Polygons remain labelled illustrative. Team markers and recent route lines use API data.
- Actual code includes Administrator despite older documents listing only five roles; mobile includes its create/edit/activate/deactivate workflow.
- `GET /reports/:id` supports authorized shared managers in current code despite an older API table calling it analyst-only.
- The API introduction says all responses are JSON; report export is actually `application/pdf`, and mark-all-read returns 204.
- Incident list is capped at 50 without pagination; this is disclosed rather than inventing query parameters.
- Original Group 41 source PDF is missing. Current approved design documents and executable backend contracts are used.

## Runtime verification boundary

Automated tests exercise API/client logic, real React session hooks with native bridges mocked, exact analytics contracts, and isolated full Express/MongoDB workflows. Bundle export verifies both native dependency graphs. Physical camera/permissions/SQLite restoration/OS sharing and visual accessibility require the device checklist. These are not represented as tested by bundle export.
