# First-time experience audit: Figbloom Fleet

Walked as a brand-new company owner, reading the actual pages and API code on
`main` (landing → register → "Application received" → sign in → first screen →
each main page while empty), plus the same pass for a fleet admin and for
Figbloom staff. Each finding notes where it lives and whether this PR fixes it.

Status: **Fixed** = changed in this PR · **Partly** = mitigated, decision still
needed · **Open** = not touched here.

## The journey as it was

1. **Landing (`/`)**: clear "Get started" CTAs to `/register`. Footer links
   (About, Careers, Contact, Support, Privacy, Terms, Cookies) are `href="#"`.
2. **Register (`/register`)**: one form. Nothing says what happens after
   submitting, and the 8-character password rule only shows up as an error.
3. **"Application received"**: says "Our team reviews every new company" and
   offers "Go to sign in". With Figbloom-console decisions on, *every* company
   starts `pending` (`authController.registerCompany`) and the console's
   auto-approve flips it to `active` about a minute later via the sync. So an
   owner who will be live in a minute is told to wait for a human review, with
   no expected time, and the "Go to sign in" button leads to a sign-in that
   fails ("awaiting approval").
4. **Sign in (`/login`)**: "Sign in as: Company / Company Admin". A new owner has
   to guess which one they are; a wrong guess signs them straight back out with
   "Not authorized" even though the password was right.
5. **First screen**: owners went to `/company/live-map`, a full-screen map with
   "No vehicles registered yet." and no next step. The Overview (dashboard)
   sits under Reports.
6. **Trying to add a vehicle**: `/company/vehicles` and `/company/drivers` hide
   the add forms for owners with no explanation. The API refuses owners anyway
   (`POST /api/vehicles` is `ADMIN`/`PLATFORM_ADMIN` only; drivers: "Only fleet
   admins can add drivers"). The owner's real first step, Settings → Admins, is
   not pointed to anywhere. **This is the dead end the owner hit.**
7. **Every other page while empty**: one grey line ("No trips in this
   period.", "No zones created yet.", "Nothing to report for this range.") with
   no explanation of what the page is for or what to do.

## Findings

| # | Severity | Finding | Where | Status |
|---|---|---|---|---|
| 1 | High | Owners can't add vehicles or drivers, and nothing says so or points to Admins. | `company/vehicles`, `company/drivers` (`canAdd={false}`); `routes/vehicleRoutes.js`, `authController.createUserUnderCompany` | **Partly**: every empty state, the checklist and Help now say "vehicles and drivers are added by a fleet admin, invite one (it can be you, with a second email)" and link to the add-admin form. Product decision still open (see below). |
| 2 | High | "Application received" is wrong for auto-approved companies, gives no expected time, and "Go to sign in" fails while pending. | `register/page.tsx`, `authController.registerCompany` | **Fixed**: says "usually a minute or two, up to one working day if reviewed", that we'll email, and the page quietly checks `/api/companies/me` with the registration's own token (kept in memory only) every 15 s for 10 min. When active it switches to "You're all set" with **Sign in now**, which signs straight in. |
| 3 | High | No first-run guidance after signing in; owner lands on an empty live map. | `lib/roleRedirect.ts`, dashboards | **Fixed**: each role lands on its own dashboard; owners and full-access admins get a self-ticking Getting started checklist. |
| 4 | High | Role picker on sign-in rejects a correct password if the wrong role is picked. | `login/page.tsx` | **Fixed**: the account's role decides where you land; picking the other tile only changes the welcome message. Tiles renamed "Company owner" / "Fleet admin" with a one-line hint (drivers use the app). |
| 5 | Medium | Header never shows which role you are signed in as; company name only appears small in the sidebar footer / map card. | `AppShell.tsx`, `FleetMap.tsx` | **Fixed**: every page header (and the live map card) shows company + role pill, e.g. "Acme Logistics · Fleet admin · view only"; platform shows "Figbloom platform · Figbloom staff". |
| 6 | Medium | Opening another role's URL bounced to `/unauthorized` ("Not your workspace"). | `ProtectedRoute.tsx` | **Fixed**: redirected straight to your own dashboard. `/unauthorized` still exists for old links. |
| 7 | Medium | Empty pages have no explanation or next action. | Vehicles, Drivers, Live map, Trips, Geofences, Alerts, Jobs, Reports (Summary), Expenses, Admins | **Fixed**: one sentence on what the page is for and one primary action (role-aware: admins get "Add your first vehicle"; owners get "Invite a fleet admin"; viewers get no button they can't use). |
| 8 | Medium | No help anywhere in the app. | n/a | **Fixed**: "Help & getting started" in every sidebar, a help icon on the live map card, a link on sign-in; `/help` covers roles, owner and admin first steps, getting vehicles on the map, the driver app, Figbloom staff, FAQ. |
| 9 | Medium | Platform dashboard with no companies just says "No companies registered yet."; nothing says where companies come from or that approval lives in the console. The "Pending approval: companies awaiting review" stat suggests approval happens here. | `platform/dashboard`, `platform/companies`, `platform/page.tsx` | **Fixed** (empty state: companies register at `/register`, managed in the Figbloom console, with link). Stat label **Open**. |
| 10 | Medium | Hardware trackers: the landing page promises "a vehicle tracker with its own secure token", the API can issue one (`POST /api/vehicles/:id/tracker-token`), but no screen shows or issues it. The "Device ID" field on Add vehicle is unexplained. | `VehiclesList.tsx`, vehicle detail | **Open**: Help says "contact Figbloom support" for trackers. Needs a "Connect a tracker" panel on the vehicle page. |
| 11 | Medium | "Get it on Google Play" buttons on sign-in and register are `href="#"`. Drivers have no way to find the app from the web. | `login`, `register` | **Open**: needs the real Play Store URL. |
| 12 | Low | `/driver/*` area: nav links `/driver/trips` and `/driver/sos` 404, and the API refuses driver sign-in on web anyway. | `driver/layout.tsx` | **Open**: recommend replacing with a single "use the app" page. |
| 13 | Low | Dashboard charts render all zeros on a new account (donut, trips, agent activity) with no "nothing yet" note. | company/admin dashboards | **Partly**: the checklist sits above them; charts unchanged. |
| 14 | Low | Naming drift: README says "Site Owner"; UI said "Company", "Company Admin", "Admin"; nav "Summary" opens a page titled "Reports"; setup pages (Vehicles, Drivers) live under a section called "Settings". | various | **Partly**: on-screen role names are now consistent ("Company owner", "Fleet admin", "Driver", "Figbloom staff"). Others open. |
| 15 | Low | Overview hero card says "Powered by Movec" under the Figbloom Fleet brand. | `AppShell.tsx` | **Open**: confirm it's intended. |
| 16 | Low | Register hero copy ("Admins and drivers are added by whoever manages their account") is vague; password rule hidden until error. | `register/page.tsx` | **Partly**: the success screen now lists the four next steps. Form copy unchanged. |
| 17 | Low | Landing footer links are all `#`. | `page.tsx` | **Open** |
| 18 | Dev | README describes the Phase-1 `pg` demo server (`/ping`, `/pings`), not the current Prisma API and role areas. A new developer can't tell where to go from it. | `README.md` | **Open**: worth a rewrite; `/help` is the user-facing version. |

## What changed (pages to look at)

- `/register`: submit, then see the new success screen ("You're all set" + Sign in now, or "Application received" with timing and auto-update), with "What happens next".
- `/login`: renamed role tiles, hint line, link to Help; wrong tile no longer fails.
- `/company/dashboard` and `/admin/dashboard`: Getting started checklist (hide/close; Help page can bring it back).
- Any page in `/company`, `/admin`, `/platform`: company + role pill in the header; "Help & getting started" in the sidebar.
- `/company/live-map`, `/admin/live-map`: role pill and help icon on the floating card; empty-fleet message with "Go to Vehicles".
- Empty states: `/company|admin/vehicles`, `/drivers`, `/trips`, `/geofences`, `/alerts`, `/jobs`, `/reports`, `/expenses`, `/company/admins`.
- `/platform/dashboard`, `/platform/companies`: "No companies yet" with `/register` and the Figbloom console link.
- `/help`: new guide.

## Open questions for the owner

1. **Should company owners be able to add vehicles and drivers themselves?**
   Many small fleets are one person; today they must create a second "admin"
   login for themselves. Allowing it is a two-line API change
   (`authorize(...)` on `POST /api/vehicles`, `/bulk-import`, and the
   `role === "DRIVER"` check in `createUserUnderCompany`) plus `canAdd` on the
   two company pages. Left unchanged here because it's a permissions decision.
2. Real Google Play URL for the driver app (finding 11).
3. Should trackers be self-serve (finding 10)?

## TODO

- **"Explore with demo data" toggle**: not built yet. The demo fleet seed
  (`backend/scripts/seedDemoFleet.js`, branch `feat/demo-fleet-seed`) is coming
  separately; once it lands, add an "Explore with sample data" option to the
  Getting started checklist and empty states, clearly labelled and removable.
