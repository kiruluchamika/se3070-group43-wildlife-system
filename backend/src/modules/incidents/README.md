# UC03 — Report Wildlife and Poaching Incident

**Owner:** KALMADU H L G (IT23701014) · **Branch:** `feature/incident-reporting`

Build the module in this folder, using the layers of `../alerts`.

Notes:
- Accept a client-generated `clientId` and put a unique index on it. A repeated synchronisation then returns the existing incident instead of creating a duplicate.
- After storing a snare, carcass, illegal-camp or footprint incident, call `alertService.raise({ source: 'ranger-incident', sourceRef: incident id, ... })` so it appears on the UC04 dashboard.
- The frontend offline storage (Dexie) and the PWA setup (`vite-plugin-pwa`) also belong to UC03. See `docs/DECISIONS.md` ADR-001.
