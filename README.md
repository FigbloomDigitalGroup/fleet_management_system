# Fleet System — Vehicle Tracking & Fleet Analytics Platform

## About This Project

Fleet System is a multi-tenant SaaS platform for tracking and managing
vehicle fleets in real time. Our company owns and operates the platform;
vehicle-owning businesses subscribe as clients to track their own fleets
through it.

### The Problem It Solves

Vehicle-owning businesses currently lack an affordable, ready-to-use way to
monitor their fleets in real time, review trip history, enforce geofenced
boundaries, and get automated alerts on unsafe or unauthorized vehicle use.
Fleet System solves this by giving any vehicle company a subscription-based
platform they can start using immediately, without building or maintaining
their own tracking infrastructure.

### System Roles & Hierarchy

```
Platform Owner (our company)
        │
        ▼
Site Owner (Vehicle Company — our client)
        │
        ▼
Admin (does the actual day-to-day tracking work)
        │
        ▼
Driver (mobile app — Phase 2)
```

| Role | Represents | Responsibility |
|---|---|---|
| **Platform Owner** | Our company | Onboards vehicle companies, manages subscriptions/billing, views cross-company analytics, manages the platform itself |
| **Site Owner** | A vehicle company (client) | Owns the company account, creates/manages Admin users, views company-level analytics and billing |
| **Admin** | Company staff / fleet manager | Live tracking, vehicle management, geofencing, alerts, driver management, reports |
| **Driver** *(Phase 2)* | Vehicle operator | Mobile app: shares location, views assigned trips, sends SOS alerts |

### Full Feature Set (Vision)

- Live, real-time vehicle tracking on a map
- Trip and route history with playback
- Vehicle availability and status monitoring
- Geofencing with entry/exit alerts
- Real-time alerts (speeding, idle time, unauthorized movement, offline devices)
- Distance and ETA calculation
- Driver management and performance scoring
- Nearby vehicle search (geospatial queries)
- Exportable reports (trips, mileage, driver activity)
- Cross-company analytics for the Platform Owner
- Company-level analytics for Site Owners
- *(Later)* rule-based → AI-assisted driver behaviour analysis & anomaly detection
- *(Later)* mobile app for drivers

This repository currently contains the **early foundation**: a working
Express + PostgreSQL backend connection, with the full feature set above
being built out in phases on top of it.

---

## Project Structure

```
fleet-system/
├── backend/          # Express.js + PostgreSQL API server
│   ├── server.js
│   ├── package.json
│   ├── .env            (not committed to git)
│   └── README.md
└── frontend/          # Next.js web dashboard (Site Owner & Admin)
    ├── app/ or pages/
    ├── package.json
    ├── .env.local       (not committed to git)
    └── README.md
```

## Tech Stack

**Backend**
- Node.js + Express.js
- PostgreSQL (via the `pg` driver)
- JWT-based authentication (planned)
- Socket.IO for real-time vehicle location updates (planned)
- Role-based access control (RBAC) + multi-tenant data isolation (planned)

**Frontend**
- Next.js (React framework)
- Talks to the backend via REST API calls to `http://localhost:4000`
- Handles Site Owner and Admin dashboards, live map, and reports

**Database**
- PostgreSQL, planned core tables:
  - `companies` — tenant accounts (vehicle companies)
  - `users` — all roles (platform_admin, company_owner, admin, driver), scoped by `company_id`
  - `vehicles` — fleet vehicles per company
  - `location_pings` — high-frequency GPS location data per vehicle
  - `trips` — start/end trip records derived from location pings
  - `geofences` — company-defined zones (circle or polygon)
  - `alerts` — generated alerts per vehicle/company

---

## Prerequisites

- Node.js installed (`node -v`)
- PostgreSQL installed and running, with a database named `fleetdb`

---

## Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/fleetdb
PORT=4000
```
URL-encode special characters in your password if present, e.g.:
`#` → `%23`, `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `%` → `%25`

Run it:
```bash
npm run dev
```
Server runs at `http://localhost:4000`. On success you'll see:
```
demo_pings table ready
Server running: http://localhost:4000
```

**Current backend endpoints (Phase 1 — connection demo):**

| Method | Endpoint  | Description                                |
|--------|-----------|---------------------------------------------|
| GET    | `/health` | Confirms server is running and DB is connected |
| POST   | `/ping`   | Inserts a test record into the database      |
| GET    | `/pings`  | Returns the last 20 test records             |

### Example: POST /ping
**Request body:**
```json
{ "message": "hello from express" }
```
**Response:**
```json
{
  "id": 1,
  "message": "hello from express",
  "created_at": "2026-09-02T10:00:00.000Z"
}
```

---

## Frontend Setup (Next.js)

From the `fleet-system` root folder:
```bash
npx create-next-app@latest frontend
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:3000`.

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Example of calling the backend from a Next.js page/component:
```javascript
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
const data = await res.json();
```

**Note:** since frontend (`3000`) and backend (`4000`) run on different
ports, the backend must explicitly allow requests from the frontend (CORS)
— this will be added to `server.js` once real API endpoints are built.

---

## Running Both Together (Development)

Two terminals, running at the same time:

**Terminal 1 — backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
```

Then visit `http://localhost:3000` in your browser.

---

## Figbloom platform (company registration and approval)

Fleet is a product on the Figbloom platform (contract: `FLEET_PLATFORM_CONTRACT.md`, section 2). One Fleet
company is one platform **organization** and one **tenant** under it, both with the company's id as their local id.

- **Registration (Fleet to platform).** Registering a company, renaming it (and, later, an owner/contact change) puts
  it in the outbox table `PlatformSyncQueue`; a job every minute (`Index.js`, `backend/lib/platform/sync.js`) sends it
  with `PUT /products/fleet/organizations/{companyId}` and `PUT /products/fleet/tenants/{companyId}`. Failed sends are
  retried after 1, 2, 4 ... minutes, at most an hour apart. What the platform knows is kept in `PlatformLink`.
- **Decisions (platform to Fleet).** Approve, reject, suspend and reactivate are decided in the Figbloom console
  (https://console.figbloom.org). The platform posts each decision, signed, to `POST /api/platform/decisions`; Fleet
  checks the signature (HMAC-SHA256 over `"<timestamp>.<raw body>"`, header `x-figbloom-signature: sha256=...`,
  `x-figbloom-timestamp` within 5 minutes), ignores repeats (`x-figbloom-delivery`, table `PlatformDecisionDelivery`)
  and older decisions, and sets the company's status the same way Fleet's own approve button did: the owner gets the
  approval email, and pending, suspended and rejected companies can't sign in.
  Status mapping: platform `active` = Company `active`, `suspended` = `suspended`, `rejected` = `rejected` (new
  status), `pending` = `pending`.
- **`PLATFORM_DECISIONS_ENABLED`.** Off (the default): Fleet's own `/platform` approve/suspend works as before, and a
  correctly signed decision is answered `503` and not applied, so the platform keeps it and delivers it again later
  (nothing decided in the console is lost; it is applied at the first retry after switch-on). On: decisions are
  applied, Fleet's own approve/suspend answers `409` ("decided in the Figbloom console") and the company page shows a
  link to the console instead of its buttons, and every new company starts `pending` here until the platform's answer
  (pending, or active with the platform's auto-approve) is applied.
- **Console summaries.** `GET /api/platform/companies` and `GET /api/platform/companies/:id`, for the console's
  backend only (header `x-platform-secret` = `PLATFORM_CONSOLE_SECRET`): per company id, name, status, created date,
  owner name and email, plan, counts (vehicles, drivers, admins, trips in the last 30 days) and the time of the last
  location ping. No location data, nothing about drivers beyond the count.

### Settings (backend environment)

| Setting | What |
|---|---|
| `PLATFORM_API_URL` | The platform API's address |
| `PLATFORM_TOKEN_URL` | The platform's Cognito token endpoint (`.../oauth2/token`) |
| `PLATFORM_CLIENT_ID`, `PLATFORM_CLIENT_SECRET` | Fleet's machine client on the platform (client credentials; scopes `platform/tenants.read platform/tenants.write`) |
| `PLATFORM_WEBHOOK_SECRET` | The decision webhook's signing secret (the platform's `figbloom/platform/webhook/fleet`) |
| `PLATFORM_DECISIONS_ENABLED` | `true` once the console decides (see above); off when unset |
| `PLATFORM_CONSOLE_SECRET` | The shared secret the console's backend sends as `x-platform-secret` (at least 32 characters) |
| `PLATFORM_CONSOLE_URL` | Optional: the console's address for the link on the company page (default `https://console.figbloom.org`) |
| `PLATFORM_WEBHOOK_URL` | Optional: the default address for `platform:register-webhook` |

Without the first four, nothing is sent and companies wait in the queue.

### One-off scripts (in `backend/`)

```bash
npm run platform:register-webhook -- https://fleet-api-staging.figbloom.org/api/platform/decisions
npm run platform:backfill              # dry run: lists every company and the status it would send
npm run platform:backfill -- --apply   # registers them, each with its current status
```

On the AWS server: `docker exec app-app-1 node scripts/platformRegisterWebhook.js <url>` and
`docker exec app-app-1 node scripts/platformBackfill.js [--apply]`.

### Tests

`cd backend && npm test` (Node's built-in test runner; no database needed): webhook signatures, outbox retry and
backoff, applying decisions once, and the console secret.

---

## Security Notes (for later phases)

- Passwords must be hashed (bcrypt/argon2) — never stored in plain text
- JWT access tokens should be short-lived, paired with longer-lived refresh tokens
- Every database query must be scoped by `company_id` (tenant isolation) — enforced at the query layer, not just the UI
- The location-ping ingestion endpoint should eventually use a separate device API key rather than user JWTs, since GPS trackers aren't logged-in users
- Rate limiting should be applied to login endpoints to slow brute-force attempts

---

## Development Roadmap

**Phase 1 — Core Foundation** *(in progress)*
- [x] Express + PostgreSQL connection proven
- [ ] Next.js frontend scaffolded
- [ ] Authentication (JWT, role-based: Platform Owner, Company Owner, Admin, Driver)
- [ ] Multi-tenant database schema (companies, users, vehicles)
- [ ] Vehicle CRUD (backend + frontend UI)
- [ ] Live GPS tracking ingestion pipeline
- [ ] Trip history logging

**Phase 2 — Operational Features**
- [ ] Real-time map updates (Socket.IO)
- [ ] Distance & ETA calculation
- [ ] Real-time alerts (speeding, idle, offline)
- [ ] Nearby vehicle search

**Phase 3 — Advanced Logic**
- [ ] Geofencing (circle & polygon zones)
- [ ] Driver performance scoring
- [ ] Company-level & platform-level analytics dashboards

**Phase 4 — Intelligence Layer**
- [ ] Driver behaviour analysis (harsh braking/acceleration)
- [ ] AI-assisted anomaly detection

**Phase 5 — Mobile Expansion**
- [ ] Driver mobile application, integrated with existing backend APIs


















