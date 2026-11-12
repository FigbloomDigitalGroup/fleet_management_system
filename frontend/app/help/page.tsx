"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import BrandIcon from "../components/BrandIcon";
import { gettingStartedStorageKey } from "../components/GettingStarted";
import { redirectPathForRole, roleLabel } from "../lib/roleRedirect";
import { Role } from "../types/auth";

// A short in-app guide: who does what, how vehicles get on the map, and the
// handful of things people get stuck on. Open to everyone (it's linked from
// sign-in too); when signed in it points at the reader's own role and links
// back to their dashboard.

function Section({ id, title, children, highlight = false }: { id: string; title: string; children: ReactNode; highlight?: boolean }) {
  return (
    <section
      id={id}
      className={`scroll-mt-6 rounded-lg bg-white p-6 shadow-sm ring-1 ${highlight ? "ring-2 ring-teal-600" : "ring-black/5"}`}
    >
      <h2 className="text-lg font-semibold text-blue-950">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

const ROLE_SECTION: Record<Role, string> = {
  COMPANY_OWNER: "owner",
  ADMIN: "admin",
  DRIVER: "driver-app",
  PLATFORM_ADMIN: "figbloom",
};

export default function HelpPage() {
  const { user } = useAuth();
  // Staff in a support view run as the fleet's owner but are still staff.
  const mine = user ? (user.support ? "figbloom" : ROLE_SECTION[user.role]) : null;
  const [checklistRestored, setChecklistRestored] = useState(false);
  const canRestoreChecklist = !user?.support && (user?.role === "COMPANY_OWNER" || user?.role === "ADMIN");

  function restoreChecklist() {
    if (!user) return;
    try {
      localStorage.removeItem(gettingStartedStorageKey(user.id));
    } catch {
      // storage blocked: nothing was remembered to begin with
    }
    setChecklistRestored(true);
  }

  const toc = [
    { id: "roles", label: "Who does what" },
    { id: "owner", label: "Owners" },
    { id: "admin", label: "Running the day" },
    { id: "tracking", label: "Getting vehicles on the map" },
    { id: "driver-app", label: "The driver app" },
    { id: "figbloom", label: "I'm Figbloom staff" },
    { id: "faq", label: "Common questions" },
  ];

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="flex flex-1 items-center gap-2 text-sm font-bold text-blue-950">
            <BrandIcon variant="dark" className="h-5 w-5" />
            FIGBLOOM FLEET · Help
          </span>
          {user ? (
            <Link
              href={redirectPathForRole(user.role)}
              className="inline-flex items-center gap-1.5 rounded bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600"
            >
              <FiArrowLeft size={14} />
              Back to your dashboard
            </Link>
          ) : (
            <Link href="/login" className="rounded bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">How FIGBLOOM FLEET works</h1>
          <p className="mt-1 text-sm text-gray-500">
            {user ? (
              <>
                You&apos;re signed in as{" "}
                <span className="font-medium text-gray-800">
                  {user.support ? `Figbloom staff, viewing ${user.support.companyName} read-only` : roleLabel(user.role, user.adminAccess)}
                </span>
                . Your section is outlined below.
              </>
            ) : (
              "The basics for each kind of account, in a few minutes' reading."
            )}
          </p>
          <nav className="mt-3 flex flex-wrap gap-2" aria-label="On this page">
            {toc.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  t.id === mine ? "border-teal-600 bg-teal-50 text-teal-700" : "border-gray-300 bg-white text-gray-600 hover:border-teal-400"
                }`}
              >
                {t.label}
              </a>
            ))}
          </nav>
        </div>

        <Section id="roles" title="Who does what">
          <ul className="space-y-2">
            <li>
              <span className="font-medium text-gray-900">Company owner</span>: whoever registered the fleet. Can do everything a
              fleet admin can (add vehicles and drivers, draw zones, plan jobs, handle alerts), plus choose a plan and,
              if they want help, invite fleet admins. A one-person fleet needs nobody else.
            </li>
            <li>
              <span className="font-medium text-gray-900">Fleet admin</span>: optional, added by the owner. Adds vehicles and drivers,
              draws zones, plans jobs and handles alerts. The owner gives each admin <em>Full</em>, <em>Dispatcher</em> (jobs,
              routes, messages and alerts only) or <em>Viewer</em> (read only) access.
            </li>
            <li>
              <span className="font-medium text-gray-900">Driver</span>: added by the owner or an admin. Uses the FIGBLOOM FLEET phone
              app only; drivers can&apos;t sign in to this website.
            </li>
            <li>
              <span className="font-medium text-gray-900">Figbloom staff</span>: the people running the platform. They see
              every company, not any one fleet.
            </li>
          </ul>
          <p>Everyone signs in at the same page and lands in their own area; the header always shows your fleet and role.</p>
        </Section>

        <Section id="owner" title="Owners: your first steps" highlight={mine === "owner"}>
          <Steps
            items={[
              <>
                Register at <Link href="/register" className="text-teal-700 hover:underline">/register</Link>. Most accounts
                are switched on within a few minutes; if yours needs a review we email you once it&apos;s approved (usually
                within one working day).
              </>,
              <>Sign in as <span className="font-medium">Company owner</span>. Your Overview has a Getting started checklist that ticks itself off.</>,
              <>
                Add your vehicles under <span className="font-medium">Settings → Vehicles</span> and your drivers under{" "}
                <span className="font-medium">Settings → Drivers</span>, then assign each driver their vehicle (the same steps as
                for fleet admins, below).
              </>,
              <>
                Draw a zone around your depot under <span className="font-medium">Settings → Geofences</span>, and pick a plan under{" "}
                <span className="font-medium">Settings → Billing</span> when you&apos;re ready.
              </>,
              <>
                Optional: if someone else helps run the fleet, give them their own login under{" "}
                <span className="font-medium">Settings → Admins</span>. You choose their access (Full, Dispatcher or Viewer) and
                can keep doing everything yourself.
              </>,
            ]}
          />
          <p>
            Alert limits (speed, idle time, offline time) and tracking hours are under{" "}
            <span className="font-medium">Settings → Company</span>.
          </p>
        </Section>

        <Section id="admin" title="Setting up and running the day" highlight={mine === "admin"}>
          <Steps
            items={[
              <>
                Owners sign in as <span className="font-medium">Company owner</span>; fleet admins sign in as{" "}
                <span className="font-medium">Fleet admin</span> with the details the owner gave them.
              </>,
              <>
                Add vehicles under <span className="font-medium">Settings → Vehicles</span> (one at a time, or import a
                spreadsheet).
              </>,
              <>
                Add drivers under <span className="font-medium">Settings → Drivers</span>. Each gets an email and password for the
                phone app. Assign each driver their vehicle.
              </>,
              <>Ask each driver to install the app and sign in (see the next section).</>,
              <>Draw zones under <span className="font-medium">Settings → Geofences</span> to get alerts when vehicles leave or enter them.</>,
            ]}
          />
          <p>
            Day to day: the <span className="font-medium">Map</span> is your home screen;{" "}
            <span className="font-medium">Dispatch</span> holds Jobs, Routes and Messages; <span className="font-medium">Reports</span>{" "}
            holds Trips, Alerts, Summary, Expenses and Inspections.
          </p>
        </Section>

        <Section id="tracking" title="Getting vehicles on the map">
          <p>A vehicle appears on the live map once something sends its location. There are two ways:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-medium text-gray-900">The driver app (most fleets).</span> The owner or an admin adds the
              driver and assigns them the vehicle. The driver installs FIGBLOOM FLEET on an Android phone, signs in, and allows location
              access (choose &quot;Allow all the time&quot; so tracking continues with the screen off). The vehicle then
              reports while that driver is signed in.
            </li>
            <li>
              <span className="font-medium text-gray-900">A GPS tracker.</span> A hardware tracker can report into the same
              map and trips with its own secure per-vehicle token. Contact Figbloom support to set one up.
            </li>
          </ul>
          <p>
            &quot;No GPS yet&quot; next to a vehicle means nothing has reported for it so far: check that a driver is assigned
            and signed in to the app. Trips are recorded automatically from those locations.
          </p>
        </Section>

        <Section id="driver-app" title="The driver app" highlight={mine === "driver-app"}>
          <p>
            Drivers use the FIGBLOOM FLEET Android app with the email and password the owner or an admin created. In the app they share
            their location, see the day&apos;s jobs and record proof of delivery, send SOS, message the office, do vehicle
            inspections, and log fuel and other expenses with a receipt photo. All of it shows up in the web dashboard.
          </p>
          <p>Driver accounts can&apos;t sign in to this website; if a driver tries, they&apos;ll be told to use the app.</p>
        </Section>

        <Section id="figbloom" title="I'm Figbloom staff — what can I do here?" highlight={mine === "figbloom"}>
          <p>
            A Figbloom staff account doesn&apos;t have a fleet of its own. It is the view over <strong>every customer fleet</strong>:
            you sign in on the same page as everyone else and land on <strong>Staff home</strong>. Vehicles, drivers, trips and
            the live map always live inside a customer&apos;s fleet, so to see them you open that fleet.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>See a customer&apos;s fleet:</strong> go to <Link href="/platform/companies" className="text-teal-700 hover:underline">Customer fleets</Link>{" "}
              and press <strong>Open this fleet</strong>. You see their dashboard, vehicles, live map, trips, drivers and
              reports exactly as the owner does, under a yellow &quot;Viewing … as Figbloom staff — read only&quot; bar. Nothing
              can be changed there, billing isn&apos;t shown, and each visit (who, which fleet, when) is recorded on the
              fleet&apos;s page. Press <strong>Exit</strong> to come back; a visit ends by itself after an hour.
            </li>
            <li>
              <strong>Set up a new client:</strong> press <strong>Create a fleet</strong> on Staff home or Customer fleets. Give
              the fleet&apos;s name and the owner&apos;s name and email. The fleet is active straight away, appears in the
              Figbloom console, and the owner is emailed a link to set their password. They then add their own vehicles and
              drivers (you can&apos;t add them for them).
            </li>
            <li>
              <strong>Approve, reject or suspend a fleet:</strong> that happens in the{" "}
              <a href="https://console.figbloom.org" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">
                Figbloom console
              </a>
              , not here. Fleets can also sign themselves up at{" "}
              <Link href="/register" className="text-teal-700 hover:underline">/register</Link>.
            </li>
            <li>
              <strong>Numbers across all fleets:</strong> Fleet reports (sizes, growth), AI checks (the anomaly scans), and
              Billing (plans and payments).
            </li>
          </ul>
        </Section>

        <Section id="faq" title="Common questions">
          <dl className="space-y-3">
            <div>
              <dt className="font-medium text-gray-900">I registered but can&apos;t sign in.</dt>
              <dd>Your account is still awaiting approval. You&apos;ll get an email as soon as it&apos;s active.</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">I picked the wrong role on the sign-in page.</dt>
              <dd>No problem: you&apos;re always taken to the area that matches your account.</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">I forgot my password.</dt>
              <dd>
                Use <Link href="/forgot-password" className="text-teal-700 hover:underline">Forgot password</Link> on the sign-in
                page.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">Do I need a fleet admin, or a registered business?</dt>
              <dd>
                No to both. As the owner you can add vehicles and drivers yourself straight away, and your fleet can be just
                your own name. Invite admins only if you want help running it.
              </dd>
            </div>
          </dl>
        </Section>

        {canRestoreChecklist && (
          <div className="rounded-lg bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-black/5">
            {checklistRestored ? (
              <span>The Getting started checklist is back on your Overview.</span>
            ) : (
              <button type="button" onClick={restoreChecklist} className="font-medium text-teal-700 hover:underline">
                Show the Getting started checklist on my Overview again
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
