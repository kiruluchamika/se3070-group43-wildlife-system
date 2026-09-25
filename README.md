# Wildlife Conservation System

Initial milestone for SE3070 Group 43: user management owned by HETTIGE K.C. (IT23700956).

## Stack

- Frontend: React + Vite + plain CSS
- Backend: Node.js + Express
- Database: MongoDB Atlas for this initial user-management slice
- Authentication: bcrypt password hashing and JWT sessions

The assignment brief recommends SQLite for the complete system. MongoDB is used here only because the provided backend configuration is an Atlas URI. The team should agree whether to keep MongoDB or return to SQLite before adding the remaining modules.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

1. Install dependencies:

   ```text
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. Create `backend/.env` from `backend/.env.example` and provide a MongoDB URI and a new JWT secret. Create `frontend/.env` from `frontend/.env.example` when changing the frontend API URL.

3. Start the backend:

   ```text
   cd backend
   npm run dev
   ```

4. In another terminal, start the frontend:

   ```text
   cd frontend
   npm run dev
   ```

Local frontend requests use `/api` and are proxied to `http://localhost:5000`. For production, set `VITE_API_URL` to the deployed backend URL.

## Included user-management flow

- Register with name, email, password, and one of the agreed development roles.
- Passwords are hashed before storage.
- Sign in returns an expiring JWT.
- The frontend persists the token locally and restores the authenticated profile through `/api/auth/me`.
- Sign out clears the local session.

API routes: `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/auth/me`.

## Checks

```text
cd frontend && npm run build
cd ../backend && npm test
```

Never commit `.env` files or the Atlas credentials. The credentials pasted during setup should be rotated in MongoDB Atlas before being used.
