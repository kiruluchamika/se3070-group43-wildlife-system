# WildGuard mobile

React Native / Expo Go client for the existing WildGuard Express API. Application source lives here; the existing website and backend business rules are unchanged.

## Requirements and compatibility

- Node >=22.13 (validated with 24.12.0), npm 11.
- Expo **SDK 57**: Expo 57.0.27, React Native 0.86.3, React 19.2.3, Router 57.0.25. The patch release remains SDK 57.0.0.
- An Expo Go installation supporting SDK 57 (the requested client reports 57.0.9). Official [SDK 57 release](https://expo.dev/changelog/sdk-57) and [SDK 57 Expo Go downloads](https://expo.dev/go?sdkVersion=57&platform=android&device=true) were checked. No physical Expo Go installation was available to verify its exact binary version.
- Native modules are selected using `npx expo install` and the installed Expo `bundledNativeModules.json`. SQLite, SecureStore, location, camera/gallery, image manipulation, sharing and SVG are Expo Go compatible; no custom development client or map key is required.

## Install and run

From the repository root, in PowerShell:

```powershell
cd backend
npm ci
npm run pdf:install
npm run dev
```

Backend `.env` needs the existing MongoDB URI, database name and JWT secret. Keep those values exclusively in the backend. The PDF command installs Chromium used by the existing server PDF exporter.

In a second terminal:

```powershell
cd app
npm ci
Copy-Item .env.example .env  # only on first setup; do not overwrite an existing configuration
# Edit .env as explained below.
npm start
```

Scan the Expo QR code with Expo Go on Android, or the Camera app on iPhone. If Expo requests an account, follow the installed Expo Go client's sign-in requirements. Keep Metro running during development. `npm run android` opens an installed emulator; `npm run ios` requires macOS and an installed simulator. Windows cannot launch the iOS simulator.

## API address and networking

Set only this public value in `app/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:5000/api
```

| Target | API URL |
|---|---|
| Physical Android / iPhone | `http://<computer Wi-Fi IPv4>:5000/api` |
| Android Studio emulator | `http://10.0.2.2:5000/api` |
| iOS simulator on the backend Mac | `http://localhost:5000/api` |
| Remote service | `https://<backend-host>/api` |

Phone `localhost` means the phone, not the development computer. Both devices must share a reachable network without Wi-Fi client isolation. Find the Windows Wi-Fi IPv4 using `ipconfig`; it can change when switching networks. This workspace's ignored `.env` was configured to `http://192.168.201.223:5000/api` during implementation; update it if the address changes. Restart Expo after changes (use `npx expo start --clear --go` if an old value persists). Allow Node/port 5000 through the Windows firewall on the intended private network. Verify `/api/health` from the phone browser and use Profile → Test API connection. Expo's tunnel transports the bundle, not your private backend API. Native HTTP requests do not need browser CORS changes. Use HTTPS for deployed services.

Never add MongoDB credentials, signing secrets or staff passwords to `EXPO_PUBLIC_*` variables.

## Accounts and demo

Public registration always creates a villager. Staff accounts are provisioned by the existing administrator/backend process. Development builds show a seeded email selector; the password is entered in the ordinary password field, stays in memory, and is not bundled. It must match backend `DEMO_PASSWORD` (seed default `WildGuard@2026`). The selector is guarded by `__DEV__` and removed from production behavior.

| Role | Seeded email |
|---|---|
| Park Manager | manager@wildguard.lk |
| Ranger | ranger@wildguard.lk |
| Liaison Officer | liaison@wildguard.lk |
| Data Analyst | analyst@wildguard.lk |
| Villager | villager@wildguard.lk |

The current code also has an Administrator role; its user-management screens are included. Use an account provisioned through `backend/npm run user:admin`, following that command's prompts/configuration. There is no public elevated-role signup.

See [eight demo scenarios](../docs/MOBILE_DEMO_GUIDE.md).

## Safe demo reset

The existing `npm run seed` **resets records in `MONGODB_DB_NAME`**. Back up anything needed and select a dedicated demo database in backend `.env` before running it. Do not reseed a shared/production database just to test mobile. Then, from `backend/`, run `npm run seed`; optionally follow the existing analytics sample instructions in `backend/src/seed/ANALYTICS-SAMPLES.md`. Sign out/in and refresh web/mobile. Synchronize or explicitly account for pending phone records before resetting the database; old queued IDs may refer to deleted data. This implementation does not run the Atlas seed command automatically.

## Validation

```powershell
cd app
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run check:dependencies
npm run doctor
npm run export:native
```

Contract/integration tests also require `backend/npm ci`. Integration creates and drops only an isolated local MongoDB test database; it never loads backend `.env` or falls back to Atlas. The first run may download a MongoDB binary. See [test report](../docs/MOBILE_TEST_REPORT.md) for actual results and remaining device checks. Native bundle export is not an Android/iOS runtime test.

## Field work and limitations

- First sign in online and visit the ranger workspace to cache park/assignment/task reference data. Incidents and response actions/completions are saved in SQLite before upload, with owner-scoped stable IDs. Queued, syncing, failed and synced states are visible in Field reports.
- Photos are compressed into the persisted payload and retained until confirmed receipt. A permanent backend rejection preserves the record for inspection/retry. Do not uninstall Expo Go or clear its app storage with unsent records.
- Synchronization runs while the app is active, on reconnect, and every 30 seconds. Closed-app background sync is **not guaranteed**. Expo Go may also need Metro/network to reload an uncached development bundle; a cached offline identity is not a promise that Expo Go can always launch without Metro.
- Logout deletes tokens and read caches, but retains pending owner-scoped field records. Sign into the same account to resume them. Offline SQLite uses the OS app sandbox, not SQLCipher encryption.
- Other mutations require a connection and are never automatically retried. After a timeout creating a conflict or assigning a patrol, refresh its list before deciding to resubmit.
- The SVG map uses real backend coordinates and illustrative seed polygons. It is not an official boundary map or turn-by-turn navigation system. Camera/GPS and SMS simulations are labelled where the backend supplies them.
- Notifications are in-app polling, not remote push. Incident history is limited to the latest 50 records by the existing backend contract; reports and users use server pagination.
- Exact original Group 41 SRS traceability remains unavailable because its PDF is absent from the repository. See existing UC03 design notes.

For architecture, screen parity, and endpoint mapping see [architecture](../docs/MOBILE_ARCHITECTURE.md), [feature matrix](../docs/MOBILE_FEATURE_MATRIX.md), and [API mapping](../docs/MOBILE_API_MAPPING.md).

The full source/document inventory is in [MOBILE_FILES](../docs/MOBILE_FILES.md). Further testing was stopped at the user's request; the final date-picker changes have not been recompiled or device-tested. Earlier passing results are recorded with that boundary in the test report.
