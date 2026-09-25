# Architecture Decision Records

## ADR-001 — One responsive PWA instead of a native mobile app plus web dashboards

**Context.** Group 41 describes an "offline-first mobile application for rangers" alongside "web-based operational dashboards" (Group 41, p. 4). Four students have two weeks to build one integrated system.

**Decision.** Build **one responsive React application** and make it installable as a **Progressive Web App (PWA)**:
- The office screens (patrol dashboard, analytics, conflict queue) use wide desktop layouts.
- The field screens (incident report, my assignment, response task) are mobile-first.
- `vite-plugin-pwa` caches the application shell so the app opens without a network connection.
- Pending incident reports and their photos are stored in IndexedDB (through Dexie) and synchronised when connectivity returns. Each report carries a client-generated id, so a retry never creates a duplicate.

**Why this is justified:**
- Rangers get the same field capabilities that Group 41 describes: camera capture (`<input capture>`), GPS (Geolocation API), offline storage and an installable home-screen icon.
- There is one codebase, one design system and one login. That removes the cost of synchronising two separate apps.
- The case study's offline requirement ("stored locally … synchronized automatically once connectivity is available") is still met.

**Trade-offs and limits:**
- The app does not synchronise in the background while the browser is closed. Instead it syncs whenever the app is open and online, and offers a manual "Retry" button.
- Camera and GPS need HTTPS on real phones.

**Owner.** KALMADU H L G implements the PWA and the offline storage as part of UC03.

## ADR-002 — MongoDB Atlas instead of SQLite

**Context.** The setup guide suggested SQLite with `better-sqlite3`. The group leader set up a MongoDB Atlas cluster.

**Decision.** Use **MongoDB Atlas** through Mongoose. Each module owns its collections (see WORK_PLAN §5).

**Why:**
- All four members, and the demo, share one hosted database, so there are no per-laptop database files to keep in sync.
- Atlas runs as a replica set, which enables **multi-document transactions**. UC04 needs these for E3: "the previous patrol assignment remains unchanged" when an update fails.
- Parks, zones and alerts contain nested geo data (GeoJSON boundaries, locations) that map naturally to documents.

**Consequences:**
- The schemas are defined in Mongoose models instead of `schema.sql`.
- Demo data comes from `npm run seed`.
- Unit tests use an in-memory MongoDB, so they never touch Atlas.

## ADR-003 — Tailwind CSS instead of plain CSS

**Decision.** Style the app with **Tailwind CSS v4**, using semantic design tokens (`bg-surface`, `text-muted`, `border-line`) defined in `frontend/src/index.css`.

**Why:**
- Every module gets the same spacing, colours and components without four separate stylesheets.
- The tokens support the **dark theme**, which matches Group 41's operations wireframes, and a **light theme**, which is easier to read outdoors in sunlight.
- The default theme can be changed in one place.
