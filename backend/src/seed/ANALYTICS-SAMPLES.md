# UC02 simulated analytics samples

From `backend`, using the existing development `.env` MongoDB configuration:

```powershell
npm.cmd run seed:analytics
```

Requires existing YALA (NORTH/EAST) and SINHARAJA (KUDAWA/CORE) parks/zones,
and an existing ranger account in each park.
Missing prerequisites fail before any writes. Do not run the original `npm run
seed` on shared data: that separate command resets collections. This additive
command does not invoke it and refuses `NODE_ENV=production`.

On the first run, inserts in Yala:

- Eight resolved, `simulated: true` alerts: four camera-trap leopard events in
  NORTH and four GPS-collar elephant events in EAST, across seven recent days.
- Two explicitly labelled simulated WildlifeIncident sightings with the same
  structured species names, supplying the existing UC03-backed species options.
  These do not generate additional alerts or contribute to UC02 event totals.
- Six completed, synced patrol records: nine NORTH hours and twelve EAST hours.
- One `[SIMULATED SAMPLE] UC02 patrol team`, code `UC02-SAMPLE-V1`, off-duty
  with no members. Patrols are identifiable by this dedicated team; the existing
  PatrolRecord model has no simulated/name field, so none is invented.

Sinharaja receives six simulated camera-trap events (three purple-faced langur
at KUDAWA and three leopard at CORE), two species sightings, six synced patrol
records and its own empty off-duty sample team. Both parks can demonstrate
trends, two hotspots, species and supporting records. Compare them using an
existing park-unassigned analyst; this script never changes permissions/accounts.
Both parks use the same dates. When upgrading a Yala-only sample dataset, the
second park uses the existing Yala sample dates rather than moving old records.

Alerts and sightings are labelled `[SIMULATED SAMPLE]`; source references and
incident references use `UC02-SAMPLE-V1`. These are development fixtures, not
real observations or official sensor readings. Existing park geometry/targets
and accounts are reused unchanged. Locations match the standard demo zones.

Stable, namespace-derived IDs and insert-only upserts in one MongoDB transaction
prevent duplication. Reruns do not change existing documents, timestamps, sample
dates, operational statuses, users, targets or team memberships. MongoDB must
support transactions, as required by the existing incident/report workflows.

The command prints the stored date range. As an authorized analyst, select Yala (or compare Yala and Sinharaja),
that date range and All incident types. All species shows both four-event
hotspots; either species shows its four events and one hotspot. Trends span
multiple days; supporting records retain exact alert/patrol references. Patrol
coverage is unchanged by species and uses existing zone targets. Other existing
records can increase totals. The samples remain on their original dates after
reruns; use the printed range rather than assuming they moved to today.

This script adds no reports, notifications, assignments or production models.
