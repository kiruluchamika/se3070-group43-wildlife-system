# Administrator user management

This extends the existing User collection, JWT authentication and password hasher.
Public registration still creates only Villagers and cannot grant staff/admin roles.

## First administrator

Register an account normally, then have a trusted database operator run from backend:

```powershell
npm.cmd run user:admin -- existing-account@example.com
```

This promotes an existing active account without changing its password, and
revokes its old sessions. Sign in again, then open **User Management** (`/users`).
The command refuses to promote another account when an active administrator
already exists. Provision further administrators through the management UI.
No default administrator, password or automatic promotion is installed.

## API contract

All `/api/users` routes require a current active `administrator` and return
`Cache-Control: no-store`. User responses contain `id`, `name`, `email`, `role`,
`phone`, `park`, `team`, `isActive`; never password hashes or session versions.

- `GET /api/users?page=1`: `{ users, page, hasMore }`, 20 users per page.
- `POST /api/users`: `{ name, email, password, role, phone?, park? }`, 201 `{ user }`.
- `PATCH /api/users/:id`: `{ name, email, role, phone?, park? }`, `{ user }`.
- `PATCH /api/users/:id/status`: `{ isActive: boolean }`, `{ user }`.

Create/edit reuse registration name/email/phone validation; creation uses the
existing 8–128-character password contract and hasher. Role must be one of the
existing roles or `administrator`. Park is a valid existing park ID or null.
Edit rejects passwords, hashes, team changes and active-state changes. Duplicate
emails return 409; unsupported fields/invalid input return 400.

New optional model fields: `isActive` defaults true; internal `sessionVersion`
defaults zero. Missing fields on old accounts/tokens use those defaults, requiring
no migration. Every production authenticated request reloads account status and
current role. Inactive/deleted accounts and revoked tokens receive 401. Changing
role/park or active status increments the session version; reactivation does not
revive old tokens. Login rejects inactive accounts using the existing generic
invalid-credentials response. Public session APIs and token storage are reused.

Self-deactivation and self-demotion are rejected. Existing ranger-team assignments
are preserved; users with a team cannot change role/park through these endpoints.
Team assignment, password reset, invitation email and bulk operations are outside
this UI. Offline cached UI/data cannot be remotely erased; deactivated accounts
cannot access protected server data or synchronize queued changes.
