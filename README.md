# WildGuard — Smart Wildlife Conservation System

SE3070 Case Studies in Software Engineering, Assignment 02 (Group 43). This project implements **Group 41's** design for the *Smart Wildlife Conservation and Anti-Poaching Monitoring System*. It is one responsive web application (installable as a PWA) with a React frontend, an Express backend and MongoDB Atlas.

## Team

| Member | Student ID | Use case |
|---|---|---|
| HETTIGE K.C. (leader) | IT23700956 | UC04 — Monitor Patrol Coverage and Allocate Resources |
| WITTAHACHCHI D.K.G | IT23717404 | UC01 — Respond to Human–Elephant Conflict |
| KALMADU H L G | IT23701014 | UC03 — Report Wildlife and Poaching Incident |
| JALATHGE C.A.J | IT23751446 | UC02 — Analyze Conservation Data and Generate Reports |

User management, the app shell and the design system are shared work, not graded use cases. The plan, timeline and shared contracts are in [docs/WORK_PLAN.md](docs/WORK_PLAN.md). Design decisions are recorded in [docs/DECISIONS.md](docs/DECISIONS.md).

## Requirements

- Node.js **22 LTS** (minimum 20.19)
- A MongoDB Atlas connection string. Ask the group leader for a database user.

## Setup

```bash
git clone https://github.com/kiruluchamika/se3070-group43-wildlife-system.git
cd se3070-group43-wildlife-system

cd backend
npm ci
cp .env.example .env      # then fill in MONGODB_URI, MONGODB_DB_NAME and JWT_SECRET
npm run seed              # resets the demo data in MONGODB_DB_NAME

cd ../frontend
npm ci
cp .env.example .env
```

## Run (two terminals)

| Terminal | Command | URL |
|---|---|---|
| Backend | `cd backend && npm run dev` | http://localhost:5000/api/health |
| Frontend | `cd frontend && npm run dev` | http://localhost:5173 |

### Switching between localhost and production API

`frontend/.env` controls where the browser sends requests:

```bash
VITE_API_URL=/api                                  # local: proxied to VITE_DEV_PROXY_TARGET (default http://localhost:5000)
# VITE_API_URL=https://wildguard-api.example.com/api   # production backend
```

Restart `npm run dev`, or rebuild, after changing it. On the backend, list every frontend origin that may call the API in `CLIENT_URL` (comma-separated).

To deploy from a single origin, run `npm run build` in `frontend`, set `SERVE_FRONTEND=true` in `backend/.env`, and run `npm start` in `backend`. Express then serves both the React app and the API.

## Demo accounts

`npm run seed` creates these accounts. The password for all of them is `WildGuard@2026` (set by `DEMO_PASSWORD`). The login page also has one-click demo buttons, clearly marked as a development feature.

| Role | Email |
|---|---|
| Park Manager | manager@wildguard.lk |
| Ranger (Team Charlie) | ranger@wildguard.lk |
| Community Liaison Officer | liaison@wildguard.lk |
| Data Analyst | analyst@wildguard.lk |
| Villager | villager@wildguard.lk |

The public registration page creates **villager** accounts only. Staff accounts are issued by the park administration.

## Tests and lint

```bash
cd backend
npm test                 # Vitest (unit + route + in-memory MongoDB repository tests)
npm run test:coverage    # V8 coverage report in backend/coverage
npm run lint

cd ../frontend
npm run lint
npm run build
```

The first backend test run downloads a MongoDB binary for `mongodb-memory-server`. This happens once.

## Simulated integrations

The case study describes several external systems. In this prototype:
- **GPS-collar** and **camera-trap** alerts are seeded sample records, marked `simulated: true` and labelled in the UI.
- **SMS delivery** is simulated.
- Zone boundaries are illustrative polygons, not official park boundaries.

## Project structure

```
backend/   Express API: src/modules/<module>/{model,repository,service,routes,tests}
frontend/  React app: src/features/<module>/, shared components in src/components
docs/      Work plan, decisions, API reference, design critique, AI prompt logs
```
