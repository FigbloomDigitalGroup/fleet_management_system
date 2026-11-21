# Figbloom Fleet: real-browser UX walkthrough

Walked on `origin/main` at `de7e422` (after onboarding PR #85 and the Demo Fleet seed), 12 Nov 2026, in a real
Chromium (Playwright) at desktop 1440x900 and phone 390x844, as five kinds of user:

1. a brand-new visitor who registers **Kilimo Haulage Ltd** and tries the first tasks,
2. the **company owner** of the seeded Figbloom Demo Fleet,
3. **fleet admins** (full on the new company; full, dispatcher and viewer on the demo fleet),
4. **Figbloom staff** (platform admin),
5. edge cases: wrong password, forgot/reset, reused reset link, expired session, phone navigation, 404, driver on web.

Every screenshot referenced below is in [`img/`](img/) (30 curated, compressed). About 150 raw full-page captures were
taken locally and are not committed.

**Local setup / caveats (so they aren't mistaken for bugs):** Postgres 17 in Docker, backend on Node with a test JWT
secret, no `PLATFORM_*` settings (standalone registration, Fleet's own approve button), SMTP to a local Mailpit so the
reset email could be followed, Next.js production build. **No Google Maps key** (maps show Google's "can't load
correctly" dialog and "For development purposes only"), **no Paystack key** (checkout not followed), **no OpenAI key**
(the AI agent page shows "last run failed"). Map-marker rendering is not judged here.

---

## Why new users can't tell where to go (the short version)

Four things combine:

1. **The person who signs up can't do the first job.** The owner can't add a vehicle or a driver; they have to create a
   second "admin" login (choosing its password for them) and sign in again as that. Every empty page explains this
   politely, but it is still a detour on step one. (Being changed on `feat/owner-manages-fleet`.)
2. **The navigation hides most of the product.** The sidebar only shows the items of the *current section*. The other
   sections are five small icons at the bottom of the sidebar (Map, Reports, Dispatch, Settings, Log out). Vehicles and
   Drivers live under **Settings**; the dashboard ("Overview") lives under **Reports**; "Summary" opens a page titled
   "Reports". A new user scanning the left menu never sees "Vehicles".
3. **On a phone it's worse:** the page title is truncated to one or two letters, and the AI assistant's speech bubble
   sits on top of the bottom tabs, so "Settings" (where Vehicles is) can't be tapped.
4. **There is no path from "vehicle added" to "vehicle on the map".** After an admin adds a vehicle and a driver, the
   map says "Offline - No GPS yet" and nothing says what to do next (install the app, sign in as the driver, connect a
   tracker). The app download buttons go nowhere.

---

## Top 10 fixes (ranked)

| # | Severity | Problem | Fix |
|---|---|---|---|
| 1 | **Blocker** | Owner can't add vehicles or drivers ([08](img/08-owner-vehicles-empty.jpg), [07](img/07-owner-first-screen.jpg)), yet *can* delete vehicles and reassign drivers ([18](img/18-demo-owner-vehicles.jpg)). The live-map empty state tells the owner "Start by adding a vehicle" with **Go to Vehicles**, which is a dead end for them ([09](img/09-owner-live-map-empty.jpg)). | Let owners manage the fleet (in progress on `feat/owner-manages-fleet`). Then drop "invite an admin first" from the checklist and empty states; make the checklist start at "Add your first vehicle". |
| 2 | **Major** | Two-level navigation hides pages: sidebar shows one section; sections switch from tiny bottom icons. Vehicles/Drivers under "Settings"; Overview under "Reports"; "Summary" opens "Reports"; "Company" opens "Settings". | One flat, always-visible sidebar: **Overview, Live map, Vehicles, Drivers, Trips, Alerts, Jobs, Routes, Messages, Geofences, Reports, Expenses, Inspections**, then a separate **Settings** group (Company, Admins, Billing). Keep labels identical to page titles. Move Log out into the profile menu. |
| 3 | **Blocker** (new sign-ups) | Registration screen says "usually a minute or two" and "Go to sign in", but the default platform setting `requireManualApproval = true` keeps every company `pending` until staff click Approve. Signing in meanwhile just shows a toast "awaiting approval" ([04](img/04-application-received.jpg), [05](img/05-signin-while-pending.jpg)). | Either auto-approve trials by default, or let a pending owner sign in to a read-only "We're reviewing your account" screen with the checklist visible (they can still invite and prepare). Tell the truth on the success screen when manual approval is on ("a person reviews new companies, usually within a working day"). Notify staff when a company is waiting. |
| 4 | **Major** (phone) | Phone header truncates the page title to "F..", "V.", "A." because company name + role pill take the width ([24](img/24-phone-dashboard-header.jpg)). The AI assistant's hint bubble and button cover the bottom tabs and content; a tap on **Settings** in the open menu lands on the bubble ([25](img/25-phone-menu-open.jpg), [26](img/26-phone-live-map.jpg)). | On < 640px show only the page title (move company/role into the menu header). Show the AI hint once per user, dismissible, never over navigation; lift the FAB above the bottom tabs or hide it while the menu is open. |
| 5 | **Major** | No path from "vehicle added" to "vehicle reporting". Map shows "Offline - No GPS yet" with no next step ([15](img/15-admin-map-no-gps.jpg)); vehicle page has no tracker / app section, "Device ID" is unexplained ([12](img/12-admin-add-vehicle.jpg), [13](img/13-new-vehicle-detail.jpg)); "Get it on Google Play" on sign-in/register is `href="#"` while the landing page says "Coming soon". | Add a "Get this vehicle reporting" card on the vehicle page and in the map list: (a) assign a driver -> send them the app link and sign-in details, (b) or connect a tracker (issue/show the token the API already supports). Use one consistent app-store state everywhere. |
| 6 | **Major** | "Invite admin" isn't an invite: the owner types the admin's password and must pass it on themselves; same for drivers. No resend, no remove/deactivate admin, no reset-password-for-user. Success toasts read "ADMIN account created", "DRIVER account created" ([14](img/14-admin-driver-added.jpg), [22](img/22-demo-admins.jpg)). | Email invitations with a set-password link (reuse the reset flow). Row actions: Resend invite, Change access, Remove. Human toasts: "Otieno can now sign in. We emailed them a link." |
| 7 | **Major** | Upgrade upsell is everywhere and mis-targeted: the "Upgrade to Pro, save 20%" hero is the first thing a new owner sees, it is shown to fleet admins (who can't pay) and to a company **already on Pro**; Billing on Pro still shows the "Upgrade to Pro" banner ([07](img/07-owner-first-screen.jpg), [16](img/16-demo-owner-dashboard.jpg), [17](img/17-demo-billing-on-pro.jpg)). | Show offers only to owners on trial/basic, never in the first session, and never to the plan already held. |
| 8 | **Major** | Platform Overview and Analytics charts ("Vehicles per company", "New companies - last 6 months") render as empty boxes with only a legend ([27](img/27-platform-overview-empty-charts.jpg)). Measured: the Recharts container is 0px tall. | `BarChartCard` uses `<ResponsiveContainer height="100%">` inside a parent with no height; give it a fixed height (as `LineChartCard` does with `220`). |
| 9 | **Major** | The Overview is a wall of 12+ widgets. On a new account they are all 0/empty (donut "No data yet", axes with no data, "0%" rings, "No earlier data"); on a live account "Fleet on the map" is a line chart, not a map; "Agent activity" is flat zero; the carousel hero repeats marketing copy ([07](img/07-owner-first-screen.jpg), [16](img/16-demo-owner-dashboard.jpg)). | First-run: show only the checklist and one "what you'll see here" illustration until there's data. Later: KPIs + alerts needing action + today's jobs + a small live map; move the rest to Reports. Rename or replace "Fleet on the map". Hide agent widgets when the agent is off. |
| 10 | **Major** | Feedback is inconsistent: a stale red "Something went wrong" toast stays next to the green success toast ([04](img/04-application-received.jpg)); validation errors are titled "Something went wrong"; the 8-character password rule is only revealed by an error ([02](img/02-register-password-error.jpg)); Create account / Sign in are disabled with no reason until the robot box is ticked; toasts cover the page heading. | Clear error toasts on success; show field rules under the field and errors inline; explain the disabled button ("Tick 'I'm not a robot' to continue"); move toasts below the header or to bottom-right. |

---

## 1. Brand-new visitor

| Where | A normal user expects | What happens | Severity | Fix |
|---|---|---|---|---|
| `/` [01](img/01-landing-desktop.jpg) | To see the actual product | Hero and feature sections use stock photos (a highway, a phone home screen, a *website analytics* screen "Traffic Sources Overview") instead of product screens. Only the theme picker shows a mock UI. | Minor | Replace with real screenshots of the live map, trip replay and jobs board (the demo fleet now makes these easy). |
| `/` | A demo or "see it live" | Every "Try it" link goes to `/register`. No demo. | Minor | Add a read-only "Explore the demo fleet" (seeded company, viewer account) linked from the hero. |
| `/` footer | Working legal/contact links | About, Careers, Contact, Support, Privacy, Terms, Cookies are all `href="#"`. Copyright line says "Movec Systems" next to the Figbloom brand. | Minor | Real pages (at least Privacy, Terms, Contact) before taking payments. Decide the Movec/Figbloom attribution. |
| `/` phone | Menu to Features/Pricing | Only Sign in / Get started; section links are hidden on phone. | Polish | Add a small menu or anchor chips. |
| `/register` [02](img/02-register-password-error.jpg) | Requirements up front | Password rule appears only as a toast "Something went wrong - Password must be at least 8 characters"; the toast overlaps the "Create your account" heading. | Minor | Hint under the field, inline error. |
| `/register` | Clear industry choice | 8 unlabeled photos under a "Select your industry" dropdown; labels are tooltips only. | Polish | Caption each photo or drop the photos. |
| `/register` | Terms consent, phone number | No terms/privacy acceptance, no phone number (fleets in Kenya are run by phone/M-Pesa). | Minor | Add both. |
| `/register` phone [03](img/03-register-phone.jpg) | Tidy header | The "FIGBLOOM FLEET" logo line and "Set up your account." heading collide. | Polish | Add spacing in the stacked hero. |
| `/register` -> success [04](img/04-application-received.jpg) | Know when they can start | "Usually a minute or two" + "Waiting for approval", but with manual approval on it waits for a human; the stale error toast from the earlier attempt is still on screen. | Blocker (see Top 3) | See Top 3 and Top 10. |
| `/login` while pending [05](img/05-signin-while-pending.jpg) | A status page | Toast "Couldn't complete that - awaiting approval. Please check back soon." | Major | Pending status screen with what happens next and a contact. |
| `/login` | Not to pick a role | "Sign in as Company owner / Fleet admin" tiles still shown; per the onboarding PR the choice no longer matters. | Minor | Remove the tiles; the account decides. |
| First screen `/company/dashboard` [07](img/07-owner-first-screen.jpg) | "Here's what to do first" | "Welcome back" toast on the very first sign-in; Upgrade-to-Pro hero first; checklist second; then ~10 empty charts. Checklist says "0 of 5 done" but lists 6 steps. | Major | "Welcome, Wanjiru"; checklist first; count "of 6" or mark billing as optional outside the count. |
| Checklist | Do step 1 myself | Step 1 is "Invite your fleet admin"; steps 2-3 say "Invite an admin first". | Blocker (Top 1) | |
| `/company/live-map` [09](img/09-owner-live-map-empty.jpg) | A next step that works | "Start by adding a vehicle" + "Go to Vehicles", which owners can't do. Brand in the floating card truncates to "FIG...". | Major | Role-aware CTA; drop the truncated brand from the card. |
| `/company/vehicles` [08](img/08-owner-vehicles-empty.jpg) | An Add button | Explanation + "Invite a fleet admin". | Blocker (Top 1) | |
| `/company/admins` | An email invite | Owner sets the admin's password. Toast "ADMIN account created". | Major (Top 6) | |
| `/company/billing` [10](img/10-owner-billing-plan-modal.jpg) | Understand cost | "Estimated subscription cost KES 0" with 0 vehicles; "Choose Basic" opens a modal "amount is calculated from your current vehicle count" so you can go to payment for 0 vehicles. Trial end date isn't shown anywhere on the page. | Minor | Show trial days left and the price for N vehicles; disable checkout at 0 vehicles. |
| `/company/settings` [11](img/11-company-settings.jpg) | A short settings page | One long page with five separate Save buttons, 25 alert types all on by default, email recipients off. | Minor | Tabs (Company, Appearance, Alerts, Tracking hours, Data); a single sticky Save; start with a sensible subset of alerts on. |
| `/company/geofences` | Draw the depot | Works for owners (good). A purple "NB: if you're asking the AI assistant ... spelling" banner tops the page ([21](img/21-demo-geofences.jpg)). | Minor | Move that tip into the assistant itself. |
| `/help` | Find answers | Clear and useful. It says approval is done "in the Figbloom console", but in standalone mode it's `/platform`. | Polish | Word it for both. |

## 2. Company owner, populated Demo Fleet

| Where | Expects | What happens | Severity | Fix |
|---|---|---|---|---|
| `/company/dashboard` [16](img/16-demo-owner-dashboard.jpg) | Pro customer sees no upsell | "Upgrade to Pro this month" on a Pro account; checklist "You're set up" stays until closed. | Major (Top 7) | |
| Header (every page) | Calm status | A red "0 out of zone" pill next to "6 in zone" on every page: red for a zero count reads as an alarm. | Minor | Neutral style at 0; red only when > 0. |
| Dashboard pie | Readable labels | "Maintenance 17%" label overlaps the slice edge. | Polish | Labels outside slices or legend only. |
| `/company/vehicles` [18](img/18-demo-owner-vehicles.jpg) | Consistent rights | Owner sees Delete on every row and can change drivers, but can't add. Every row "In zone" incl. offline/maintenance. No search, filter or vehicle photo/type icon (same generic wheel icon for all). | Major | Align rights (Top 1); search/filter; type icons. |
| `/company/trips` [19](img/19-demo-trips.jpg) | Pagination, export, driver | 88 rows on one page, each with a bright orange Replay button; driver column hidden by default; every trip "Business"; no export here (it's on Reports). | Minor | Paginate; show driver; quieter row action (click row to open); Export button. |
| `/company/alerts` [20](img/20-demo-alerts.jpg) | Alert history | "Resolved alerts are cleared automatically 30 minutes after they're resolved." There is no incident history for a fleet manager or insurer. A "Message driver" form sits on the alerts page; it defaults to KBZ 305T, which has no driver. | Major | Keep resolved alerts (filterable, exportable); put messaging in Messages / alert row action. |
| `/company/reports` | Clear name | Nav says "Summary", page says "Reports". Export Excel/PDF and tabs work well. | Minor | One name. |
| `/company/expenses` | Filter/export/add | Read-only list with dates to the second; no date range, category filter, export, or "add expense" for office costs; receipt column "-". | Minor | Add filters, export, add-from-web. |
| `/company/jobs` | Clean job board | Works. Each driver's run says "Route drawn as straight lines (road data unavailable)" - infrastructure detail shown to customers. | Minor | Hide or soften ("approximate route"). |
| `/company/routes` | Who drew it | Seeded routes say "Drawn by you". Jobs, Routes and Geofences overlap conceptually with no explanation of the difference. | Polish | One line on each page: what it is vs the other two. |
| `/company/agent` | Agent status | Red "AI Agent - last run failed" shown to the customer (no OpenAI key locally, but the failure is surfaced raw). "No findings yet - only reports once a vehicle has recent GPS activity" while 3 vehicles are active. | Minor | Customer-facing state: "Paused" / "Not included in your plan"; log failures for staff only. |
| `/company/drivers/:id` | Edit details | Personal/licence/emergency fields show "Not set" with no edit control visible to the owner. | Minor | Edit button (for whoever may edit). |
| Detail pages [13](img/13-new-vehicle-detail.jpg), [23](img/23-trip-detail.jpg) | One Back style | Grey filled "Back" button (vehicle, driver), plain "<- Back" link (trip), grey "Back to companies" (platform), plus the sidebar's own back arrow. | Polish | One component. |
| `/company/billing` [17](img/17-demo-billing-on-pro.jpg) | Correct numbers | Estimate KES 22,800 = 6 x 3,800 (full price) while the Pro card shows 3,040 "Save 20%"; "Choose Basic" is the strongest button on a Pro account; "Payment method: None on file" on an active Pro plan. | Minor | Use the price actually charged; make downgrade secondary. |
| `/company/admins` [22](img/22-demo-admins.jpg) | Manage admins | Change access only; no remove, no reset password. Seeded admin is named "(Dispatch)" but has Full access. | Major (Top 6) | |

## 3. Fleet admin (full, dispatcher, viewer)

| Where | Expects | What happens | Severity | Fix |
|---|---|---|---|---|
| `/admin/dashboard` | No billing pitch | Admins see the Upgrade-to-Pro hero too. "Drivers assigned 100%" while 2 of 6 vehicles have no driver. | Major / Minor | Hide offers for admins; label "Drivers with a vehicle" vs "Vehicles with a driver". |
| `/admin/vehicles` [12](img/12-admin-add-vehicle.jpg) | Add a vehicle | Works; form is always visible beside the list. "Add your first vehicle" CTA just jumps to the visible form. "Device ID (optional)" isn't explained. The AI bubble covers the spreadsheet Import button. | Minor | Explain Device ID or move it into "Connect a tracker". |
| New vehicle page [13](img/13-new-vehicle-detail.jpg) | Next step, edit, assign | No edit of plate/make/model, no assign-driver here (read-only "Unassigned"), "Set Active" disabled until a driver exists, says "create [a zone] on the Live Map page" though zones live on Geofences. | Major (Top 5) | Edit + assign + "Get reporting" card; fix the copy. |
| `/admin/drivers` [14](img/14-admin-driver-added.jpg) | Hand the driver their login | Driver created with no phone number field, no "send login by SMS/email", disabled "Call" chip, "DRIVER account created". | Major (Top 6) | Phone field; send-invite; human toast. |
| `/admin/live-map` [15](img/15-admin-map-no-gps.jpg) | Why it's offline | "Offline - No GPS yet", no hint. | Major (Top 5) | Inline "Assign a driver and ask them to sign in to the app". |
| Dispatcher / viewer | Know their limits | Works well: header says "Fleet admin - dispatcher" / "view only", a badge in the sidebar, controls hidden appropriately, Settings > Company hidden. | - | Keep. |

## 4. Figbloom staff (platform)

| Where | Expects | What happens | Severity | Fix |
|---|---|---|---|---|
| `/platform/dashboard`, `/platform/analytics` [27](img/27-platform-overview-empty-charts.jpg) | Charts | Two charts empty (0px height). Analytics repeats the four Overview cards. "Total users 13 - Admins and drivers combined" also counts owners. Company names rendered as dark navy pill buttons. | Major (Top 8) / Polish | Fix height; make Analytics distinct; correct label. |
| `/platform/companies` | Find who's waiting | Pending company shows a small orange "pending" pill; no filter, sort, search, owner email or "waiting since". | Minor | Add a "Needs approval" filter first, with owner contact. |
| `/platform/companies/:id` [06](img/06-staff-company-pending.jpg) | Staff view of a customer | Giant orange banner "YOUR INDUSTRY - Other" (customer copy reused); owner name/email not near the top; Approve and Suspend side by side with equal weight. | Minor | Staff header (owner, email, phone, registered, plan, status); separate destructive action. |
| `/platform/settings` [28](img/28-platform-settings.jpg) | Correct defaults | Support email default is `support@getour.com` (schema default, another brand). "Require manual approval" defaults on (see Top 3). | Major (copy goes to customers) | Default to a Figbloom address; review the approval default. |
| `/platform/billing` | Act on billing | Plan is changed per company straight from a dropdown in the table (easy to mis-click; not tested whether it confirms); all five stat cards use the same green tick icon regardless of meaning. | Minor | Confirm plan changes with the price impact; meaningful icons. |
| Staff opens `/company/...` | - | Redirected to their own dashboard (fine). | - | |

## 5. Edge cases

| Where | Expects | What happens | Severity | Fix |
|---|---|---|---|---|
| Wrong password | Inline error | Toast "Couldn't complete that - Invalid email or password"; robot box stays ticked (fine). | Polish | Inline under the password field. |
| `/forgot-password` | One confirmation | Inline "we've sent instructions" plus a toast "a reset link has been **generated**" (internal wording). | Polish | Drop the toast. |
| `/reset-password` | Rules + confirmation | Mismatched short passwords report only the length; heading is navy here but dark green on Sign in. After success you land on Sign in with the email not prefilled and the earlier red toast still showing. | Minor | Inline rules; prefill email; clear toasts. |
| Reused reset link [29](img/29-reset-link-reused.jpg) | Told up front | You type a new password twice before learning the link is invalid; no "send a new link" button. | Minor | Validate the token on load; offer a new link. |
| Expired session | Return to where I was | Clean "Session timed out" modal ("pick up where you left off"), but after signing in you land on the Overview, not the page you were on. Logged-out deep links also lose their destination. | Minor | Keep `?next=` through login. |
| Driver on web | Told to use the app | Refused with a clear message (good). No link to the app because it isn't published. | Minor (Top 5) | |
| Unknown URL [30](img/30-404.jpg) | Branded 404 with a way back | Default unstyled Next.js "404 This page could not be found." | Minor | Branded `not-found.tsx` with "Go to your dashboard". |
| `/track/<bad>` | Clear | Good message. | - | |
| Phone navigation [24](img/24-phone-dashboard-header.jpg)-[26](img/26-phone-live-map.jpg) | Find Vehicles | Hamburger opens the current section only; sections switch at the bottom under the AI bubble; tables (vehicles, trips) scroll sideways with Zone/Driver/Delete off-screen and no hint. | Major (Top 2, 4) | Flat menu; card rows for lists on phone. |

---

## Visual and UI consistency

- **Buttons:** primary orange, primary dark green, outlined, grey-filled "Back" and text links are mixed with no rule
  (e.g. "Choose Basic" green vs "Choose Pro" orange; "Optimize route" green; "Add job" orange). Pick one primary colour
  per screen and one secondary style.
- **Headings:** page titles are navy (`text-blue-950`) on a green/orange brand; auth pages switch between dark green
  ("Sign in") and navy ("New password").
- **Floating AI assistant:** the hint bubble appears on every page, on every visit, and overlaps content (Import
  button, tables, bottom tabs on phone). Show once; never over controls.
- **Toasts** sit top-right over page headings and stack stale errors with successes.
- **Status colour:** red used for zero counts ("0 out of zone"), for "No driver" and for "Set Maintenance"; reserve red
  for things needing action.
- **Dates:** mixed formats (`11/12/2026, 8:11:14 PM`, `Nov 12, 7:22 PM`, `2026-06-30`); seconds shown in lists.
- **Empty charts:** axes and legends with no data instead of an empty-state message (dashboard, agent, platform).
- **Raw values in copy:** "ADMIN/DRIVER account created", plan names lowercase in pills ("pro", "trial"), status
  lowercase ("offline", "maintenance").
- **Branding:** "Powered by Movec" on the dashboard card and "Movec Systems" on the landing footer under Figbloom
  Fleet; support default `getour.com`.

## Missing features a fleet company would expect now

1. Owner can add vehicles/drivers (Top 1).
2. Email/SMS invitations for admins and drivers; remove/deactivate users; reset someone's password.
3. A "connect this vehicle" flow: driver app link + sign-in, or tracker token (the API exists; no screen).
4. Alert and incident history (resolved alerts currently disappear after 30 minutes).
5. Search/filter on Vehicles, Drivers, Trips; pagination on Trips; export from Trips and Expenses.
6. Edit vehicle details; vehicle documents/expiry reminders (insurance, inspection, NTSA), driver licence expiry alerts.
7. Notification preferences per person (email/SMS/WhatsApp), not only per alert type.
8. A visible trial status ("9 days left") and invoices/receipts once paying.
9. A demo/sample-data mode for prospects (the seed exists; nothing in the UI uses it).
10. Branded 404/error pages and real legal/contact pages.

## What already works well

- Role awareness: header pill ("Fleet admin - view only"), viewer/dispatcher see only what they can use.
- The Help page is clear and well organised.
- The Getting started checklist ticks itself off.
- Reports with Excel/PDF export, trip replay, job board with optimise-route, driver safety scores.
- Session-timeout modal, tracking-link error page, and the driver-on-web refusal are clear.

## How this was run (to reproduce)

```bash
docker run -d --name fleet-ux-pg -e POSTGRES_USER=fleet -e POSTGRES_PASSWORD=fleet -e POSTGRES_DB=fleet -p 5455:5432 postgres:17
docker run -d --name fleet-ux-mail -p 1026:1025 -p 8026:8025 axllent/mailpit
# backend/.env: DATABASE_URL=...localhost:5455/fleet, PORT=5055, JWT_SECRET/REFRESH_TOKEN_SECRET=<test values>,
#   CLIENT_ORIGIN=FRONTEND_URL=http://localhost:3055, SMTP_HOST=localhost, SMTP_PORT=1026  (no PLATFORM_*)
cd backend && npm ci && npx prisma migrate deploy && npx prisma generate && node Index.js
node scripts/createPlatformAdmin.js staff@figbloom.test <password> "Figbloom Staff"
node scripts/seedDemoFleet.js demo-owner@example.test      # then Forgot password via Mailpit
# frontend/.env.local: NEXT_PUBLIC_API_URL=http://localhost:5055
cd frontend && npm ci && npm run build && npx next start -p 3055
```

Playwright 1.49 + Chromium, scripts outside the repo. Companies approved through `/platform/companies/:id`
(Approve / Activate), as the app does without platform decisions.
