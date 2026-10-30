"use client";

import {
  FaMapMarkerAlt,
  FaBell,
  FaChartLine,
  FaMapMarkedAlt,
  FaTachometerAlt,
  FaShieldAlt,
  FaGooglePlay,
  FaClipboardCheck,
  FaRoute,
  FaTools,
  FaWifi,
  FaUserShield,
  FaMobileAlt,
  FaUserLock,
  FaFileExcel,
  FaSatelliteDish,
  FaUsersCog,
  FaArrowRight,
} from "react-icons/fa";
import BrandWordmark from "./components/BrandWordmark";
import { MotionConfig, motion } from "motion/react";
import { enter, reveal } from "./lib/reveal";
import { PLAN_PRICING_KES, SPECIAL_OFFER, priceForPlan, formatKes, offerLabel } from "./lib/pricing";

// Landing page, laid out after a light "stacked panels" fleet template: a
// centred hero over a wide photo, a short stats row, a sentence with inline
// photo chips, a numbers card, a compatibility list and explore cards. Every figure and claim here describes how the product
// actually works — no invented customer results.

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Platform", href: "#platform" },
  { label: "Driver app", href: "#driver-app" },
  { label: "Pricing", href: "#pricing" },
];


const STATS = [
  {
    tag: "Visibility",
    value: "10 s",
    label: "live map refresh",
    text: "Every vehicle's position, speed and status, updated on one map.",
  },
  {
    tag: "Reliability",
    value: "6 h",
    label: "offline buffer",
    text: "Points recorded without signal upload with their real times later.",
  },
  {
    tag: "Safety",
    value: "0 to 100",
    label: "driver score",
    text: "Speeding, harsh driving and phone use, per 100 km driven.",
  },
];

const FEATURES = [
  { icon: FaMapMarkerAlt, title: "Live tracking", text: "Every vehicle on one map, with search, layers and a status card per vehicle." },
  { icon: FaBell, title: "Instant alerts", text: "Speeding, idling, leaving a zone or route, fake GPS and SOS. On screen and by email." },
  { icon: FaChartLine, title: "Reports & trips", text: "Distance, hours, stops, idle time and jobs per vehicle or driver. Export to Excel or PDF." },
  { icon: FaMapMarkedAlt, title: "Geofences & routes", text: "Draw zones and planned routes right from the map, with alerts on entry, exit and deviation." },
  { icon: FaTachometerAlt, title: "Driver behaviour", text: "Harsh braking, acceleration, cornering and phone use rolled into a safety score." },
  { icon: FaShieldAlt, title: "SOS", text: "Drivers send an emergency alert to your dashboard in one tap." },
  { icon: FaRoute, title: "Jobs & proof of delivery", text: "Dispatch stops, optimise their order and collect photo and signature proof." },
  { icon: FaClipboardCheck, title: "Inspections", text: "Pre-trip checklists with photos. You're alerted the moment something fails." },
  { icon: FaTools, title: "Maintenance", text: "Service reminders by date or mileage, so no vehicle misses its next service." },
];

const COMPATIBILITY = [
  {
    icon: FaMobileAlt,
    title: "Any Android phone as a tracker.",
    text: "The driver app tracks in the background, through dead zones and with a light touch on the battery.",
  },
  {
    icon: FaSatelliteDish,
    title: "GPS hardware compatibility.",
    text: "Plug in a vehicle tracker with its own secure token. It reports into the same map and trips.",
  },
  {
    icon: FaFileExcel,
    title: "Exports your team already uses.",
    text: "Summary and trip reports download to Excel or print to PDF in one click.",
  },
  {
    icon: FaUsersCog,
    title: "Fleet setup for every role.",
    text: "Owners, full admins, dispatchers and view-only staff each see exactly what they need.",
  },
];

const EXPLORE = [
  {
    image: "/dariuszsankowski-navigation-1048294_1920.jpg",
    tag: "Live map",
    title: "Trip replay and history",
    text: "Play back any trip point by point, with speed and time at every step.",
  },
  {
    image: "/skica911-driver-3978839_1920.jpg",
    tag: "Dispatch",
    title: "From job sheet to signed delivery",
    text: "Send stops to drivers, share a live ETA link with customers, collect proof.",
  },
  {
    image: "/hencyx-the-car-2650985.jpg",
    tag: "AI",
    title: "An assistant beyond fixed rules",
    text: "Learns each vehicle's normal pattern and flags what fixed limits miss.",
  },
];

const RELIABILITY = [
  { icon: FaMobileAlt, title: "Tracks in the background", text: "Keeps sharing with the screen off or the app minimised." },
  { icon: FaWifi, title: "Works through dead zones", text: "Offline points upload later, so trip history has no gaps." },
  { icon: FaUserShield, title: "Fake GPS detection", text: "Positions from mock-location apps are flagged." },
  { icon: FaUserLock, title: "Privacy by design", text: "Driver consent, tracking hours and automatic deletion." },
];

const INDUSTRIES = [
  "Logistics & courier",
  "Public transport",
  "School transport",
  "Construction",
  "Taxi & ride-hailing",
  "Agriculture",
  "Oil & gas",
  "Rental cars",
];

// Small rounded photo dropped into a sentence, as in the template.
function InlinePhoto({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      loading="lazy"
      decoding="async"
      src={src}
      alt={alt}
      className="mx-1 inline-block h-[0.95em] w-[1.9em] rounded-full object-cover align-[-0.1em] shadow-sm ring-2 ring-white md:h-[1.05em] md:w-[2.2em]"
    />
  );
}

// A key phrase in the "Why" sentence: brand green on a soft green pill,
// never split across two lines.
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="whitespace-nowrap rounded-lg bg-teal-50 px-1.5 text-teal-600 ring-1 ring-teal-100">{children}</span>;
}

// The five things the "Why" sentence names, as tiles under it.
const PILLARS = [
  { icon: FaMapMarkerAlt, title: "Track & replay", text: "Every vehicle live on one map and any trip replayed." },
  { icon: FaRoute, title: "Dispatch", text: "Jobs in order, with photo and signature proof of delivery." },
  { icon: FaTools, title: "Inspect & maintain", text: "Pre-trip checks and service reminders by date or mileage." },
  { icon: FaMobileAlt, title: "Driver app", text: "Jobs, trips, messages and SOS in one app." },
  { icon: FaChartLine, title: "Reports", text: "Trips, safety and costs. Export to Excel." },
];

// Dark highlight behind a phrase, as in the template.
function Mark({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-teal-950 px-1.5 text-white box-decoration-clone">{children}</span>;
}

// A section heading with its supporting line, centred.
function SectionHeading({ title, text, id }: { title: React.ReactNode; text?: string; id?: string }) {
  return (
    <div id={id} className="mx-auto mb-10 max-w-xl scroll-mt-24 text-center">
      <h2 className="text-3xl font-bold leading-tight tracking-tight text-gray-950 md:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-sm text-gray-500">{text}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#f2f3f1] text-gray-900">
        {SPECIAL_OFFER.active && (
          <div className="bg-teal-950">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-6 py-2">
              <span className="animate-shake inline-block shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Special offer
              </span>
              <span className="text-center text-xs font-medium text-white">{offerLabel()}</span>
              <a href="#pricing" className="text-xs font-semibold text-orange-300 underline underline-offset-2 hover:text-orange-200">
                See plans
              </a>
            </div>
          </div>
        )}

        {/* HEADER */}
        <header className="sticky top-0 z-50 border-b border-black/5 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
            <BrandWordmark />
            <div className="hidden items-center gap-7 lg:flex">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950">
                  {link.label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <a href="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-950">
                Sign in
              </a>
              <a href="/register" className="rounded-full bg-gray-950 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800">
                Get started
              </a>
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-6xl space-y-4 px-4 py-4 md:px-6">
          {/* HERO — centred headline over a wide photo */}
          <section className="overflow-hidden rounded-3xl bg-white">
            <div className="mx-auto max-w-3xl px-6 pt-16 text-center md:pt-24">
              <motion.h1 {...enter()} className="text-4xl font-bold leading-[1.05] tracking-tight text-gray-950 md:text-6xl">
                Control your fleet
                <br />
                like never before.
              </motion.h1>
              <motion.p {...enter(0.1)} className="mx-auto mt-5 max-w-xl text-sm text-gray-500 md:text-base">
                Live GPS tracking, instant alerts, trips, dispatch and driver safety. Every vehicle and every driver in one
                platform built for growing fleets.
              </motion.p>
              <motion.div {...enter(0.2)} className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a href="/register" className="rounded-full bg-orange-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-orange-600">
                  Register your company
                </a>
                <a href="#features" className="rounded-full border border-gray-300 px-6 py-3 text-sm font-medium text-gray-800 hover:border-gray-500">
                  See what it does
                </a>
              </motion.div>
            </div>
            <motion.div {...enter(0.3)} className="relative mt-12 md:mt-16">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-white to-transparent" />
              <img
                src="/industries/logistics_courier.jpg"
                alt="Truck on an open highway at sunset"
                className="h-64 w-full object-cover md:h-[26rem]"
              />
            </motion.div>
          </section>

          {/* LIVE MAP — fleet on the road */}
          <motion.section {...reveal()} className="rounded-3xl bg-white px-4 py-16 md:px-10 md:py-20">
            <SectionHeading
              title={
                <>
                  Your whole fleet,
                  <br />
                  live on one map.
                </>
              }
              text="Search any vehicle, filter by status and click one for its speed, driver and address. It's the same screen your team works from."
            />
            <img
              loading="lazy"
              decoding="async"
              src="/schwoaze-highway-3392100_1920.jpg"
              alt="Trucks and cars on a highway"
              className="h-72 w-full rounded-2xl object-cover shadow-2xl shadow-gray-300/60 md:h-[32rem]"
            />
          </motion.section>

          {/* USEFUL FOR BUSINESS — three short facts */}
          <motion.section {...reveal()} className="rounded-3xl bg-white px-6 py-16 md:py-20">
            <SectionHeading
              title="Useful for business."
              text="Built around how fleets actually run: on the road, through dead zones and across every shift."
            />
            <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
              {STATS.map((s, i) => (
                <motion.div key={s.tag} {...reveal(i * 0.1)} className="rounded-2xl border border-gray-200 p-5">
                  <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">{s.tag}</span>
                  <p className="mt-6 text-4xl font-bold tracking-tight text-gray-950">{s.value}</p>
                  <p className="text-sm font-medium text-gray-800">{s.label}</p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">{s.text}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* WHY — one sentence with inline photos, then the five pillars it names */}
          <motion.section {...reveal()} className="rounded-3xl bg-gradient-to-b from-teal-50 via-white to-white px-6 py-16 md:py-24">
            <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Why FIGBLOOM FLEET</p>
            <p className="mx-auto max-w-3xl text-center text-2xl font-semibold leading-snug tracking-tight text-gray-500 md:text-4xl md:leading-snug">
              Our fleet platform brings together <InlinePhoto src="/live tracking.jpg" alt="" /> <Pill>live tracking</Pill> and{" "}
              <InlinePhoto src="/dariuszsankowski-navigation-1048294_1920.jpg" alt="" /> <Pill>trip replay</Pill> to catch problems early,
              streamline <Pill>dispatch</Pill> with <InlinePhoto src="/skica911-driver-3978839_1920.jpg" alt="" />{" "}
              <Pill>proof of delivery</Pill> and keep every vehicle road-ready with <Pill>inspections</Pill> and{" "}
              <Pill>maintenance</Pill>. Drivers get <InlinePhoto src="/driver-app-phone.jpg" alt="" />{" "}
              <span className="whitespace-nowrap text-gray-950">one app</span> for jobs, trips and SOS. You get{" "}
              <span className="whitespace-nowrap text-orange-500 underline decoration-orange-300 decoration-4 underline-offset-[6px]">
                reports you can act on
              </span>
              .
            </p>

            <div className="mx-auto mt-12 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PILLARS.map((p, i) => {
                const Icon = p.icon;
                return (
                  <motion.a
                    key={p.title}
                    {...reveal(i * 0.08)}
                    href="#features"
                    className="group rounded-2xl border border-gray-200 bg-white p-4 transition-[translate,border-color,box-shadow] hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white transition-colors group-hover:bg-orange-500">
                      <Icon size={15} />
                    </span>
                    <h3 className="mt-3 text-sm font-semibold text-gray-950">{p.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">{p.text}</p>
                  </motion.a>
                );
              })}
            </div>
          </motion.section>

          {/* FEATURES */}
          <motion.section {...reveal()} className="rounded-3xl bg-white px-6 py-16 md:py-20">
            <SectionHeading
              id="features"
              title={
                <>
                  Everything your fleet needs,
                  <br />
                  in one place.
                </>
              }
              text="One dashboard for owners and admins, one app for drivers."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div key={f.title} {...reveal((i % 3) * 0.1)} className="rounded-2xl border border-gray-200 p-6 transition-shadow hover:shadow-md">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                      <Icon size={26} />
                    </span>
                    <h3 className="mt-5 text-base font-semibold text-gray-950">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{f.text}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          {/* NUMBERS CARD */}
          <motion.section {...reveal()} className="rounded-3xl bg-white px-6 py-16 md:py-20">
            <SectionHeading id="platform" title={<>Numbers that speak<br />for themselves.</>} text="Every trip is recorded, measured and ready to review." />
            <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 p-6 md:p-8">
              <p className="text-xl font-semibold leading-snug tracking-tight text-gray-950 md:text-2xl">
                Every trip is saved with <Mark>distance, driving time and idle minutes</Mark>, scored for safety and ready to replay
                on the map so you can see <Mark>where the kilometres and fuel go</Mark>.
              </p>
            </div>
            <img
              loading="lazy"
              decoding="async"
              src="/as_photography-digital-marketing-1725340_1920.jpg"
              alt="Reviewing charts and figures on a screen"
              className="mx-auto mt-8 block h-64 w-full max-w-5xl rounded-2xl object-cover shadow-2xl shadow-gray-300/60 md:h-[28rem]"
            />
            <div className="mx-auto mt-10 max-w-4xl">
              <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-gray-400">Built for every kind of fleet</p>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                {INDUSTRIES.map((name) => (
                  <span key={name} className="text-sm font-semibold text-gray-400">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </motion.section>

          {/* COMPATIBLE WITH YOUR BUSINESS */}
          <motion.section {...reveal()} className="grid items-center gap-10 rounded-3xl bg-white px-6 py-16 md:grid-cols-2 md:px-12 md:py-20">
            <div>
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-gray-950 md:text-4xl">
                Compatible with
                <br />
                your business.
              </h2>
              <ul className="mt-8 space-y-6">
                {COMPATIBILITY.map((c) => {
                  const Icon = c.icon;
                  return (
                    <li key={c.title} className="flex gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-700">
                        <Icon size={15} />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-950">{c.title}</h3>
                        <p className="mt-0.5 text-sm text-gray-500">{c.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <img
              loading="lazy"
              decoding="async"
              src="/viarami-fleet-5153286_1920.jpg"
              alt="A row of white delivery vans"
              className="h-80 w-full rounded-2xl object-cover md:h-[28rem]"
            />
          </motion.section>

          {/* DRIVER APP */}
          <motion.section {...reveal()} id="driver-app" className="scroll-mt-24 overflow-hidden rounded-3xl bg-teal-950 text-white">
            <div className="grid items-center gap-10 px-6 py-16 md:grid-cols-2 md:px-12 md:py-20">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-teal-300">Driver app</span>
                <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">Take the fleet on the road.</h2>
                <p className="mt-4 text-sm text-teal-50/80">
                  Jobs in order with one-tap navigation, proof of delivery, pre-trip inspections, expenses, chat with dispatch, a
                  one-tap SOS and a current-trip card to tag or end a trip.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {RELIABILITY.map((r) => {
                    const Icon = r.icon;
                    return (
                      <div key={r.title} className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                        <Icon size={14} className="text-teal-300" />
                        <p className="mt-2 text-xs font-semibold">{r.title}</p>
                        <p className="mt-0.5 text-[11px] text-teal-50/70">{r.text}</p>
                      </div>
                    );
                  })}
                </div>
                {/* Not public yet — the Play Store listing is on its way */}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <span
                    aria-disabled="true"
                    title="Coming soon to Google Play"
                    className="inline-flex cursor-default items-center gap-3 rounded-lg bg-black/60 px-5 py-3 ring-1 ring-white/10"
                  >
                    <FaGooglePlay size={22} />
                    <span className="text-left">
                      <span className="block text-[10px] uppercase tracking-wide text-gray-300">Coming soon on</span>
                      <span className="block text-base font-semibold leading-tight">Google Play</span>
                    </span>
                  </span>
                </div>
              </div>
              <img loading="lazy" decoding="async" src="/driver-app-phone.jpg" alt="The driver app on a phone" className="h-80 w-full rounded-2xl object-cover md:h-[30rem]" />
            </div>
          </motion.section>

          {/* EXPLORE */}
          <motion.section {...reveal()} className="rounded-3xl bg-white px-6 py-16 md:py-20">
            <SectionHeading title="Explore the platform." text="A closer look at what runs behind the map." />
            <div className="grid gap-4 md:grid-cols-3">
              {EXPLORE.map((e, i) => (
                <motion.article key={e.title} {...reveal(i * 0.1)} className="group overflow-hidden rounded-2xl border border-gray-200">
                  <div className="h-44 overflow-hidden">
                    <img loading="lazy" decoding="async" src={e.image} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="p-5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-600">{e.tag}</span>
                    <h3 className="mt-1 text-base font-semibold text-gray-950">{e.title}</h3>
                    <p className="mt-1.5 text-sm text-gray-500">{e.text}</p>
                    <a href="/register" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-950 hover:text-teal-700">
                      Try it <FaArrowRight size={10} />
                    </a>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.section>

          {/* PRICING */}
          <motion.section {...reveal()} className="rounded-3xl bg-white px-6 py-16 md:py-20">
            <SectionHeading id="pricing" title="Plans that grow with your fleet." text="Start free, upgrade as you grow. No hidden fees, cancel anytime." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "Trial", price: "Free", sub: "14 days", items: ["Up to 3 vehicles", "Live GPS tracking", "Basic trip history", "Email support"], cta: "Start free trial", href: "/register" },
                { name: "Basic", price: formatKes(PLAN_PRICING_KES.basic), sub: "per vehicle / month", items: ["Up to 15 vehicles", "Live GPS tracking", "Trip history & reports", "Speeding & idle alerts", "Geofences & zone alerts"], cta: "Get started", href: "/register" },
                { name: "Pro", price: formatKes(priceForPlan("pro")), sub: "per vehicle / month", items: ["Up to 50 vehicles", "Everything in Basic", "Route deviation alerts", "Fuel anomaly detection", "Driver behaviour alerts", "AI fleet assistant", "Priority support"], cta: "Get started", href: "/register", featured: true },
                { name: "Enterprise", price: "Custom", sub: "contact us", items: ["Unlimited vehicles", "Everything in Pro", "Dedicated account manager", "Custom integrations", "SLA-backed support"], cta: "Contact sales", href: "#" },
              ].map((p, i) => (
                <motion.div
                  key={p.name}
                  {...reveal(i * 0.1)}
                  className={`relative flex flex-col rounded-2xl p-6 ${p.featured ? "bg-gray-950 text-white" : "border border-gray-200"}`}
                >
                  {p.featured && (
                    <span className="absolute -top-3 left-6 rounded-full bg-orange-500 px-3 py-1 text-xs font-medium text-white">
                      {SPECIAL_OFFER.active && SPECIAL_OFFER.plan === "pro" ? `Save ${SPECIAL_OFFER.discountPercent}%` : "Most popular"}
                    </span>
                  )}
                  <h3 className={`text-sm font-semibold uppercase ${p.featured ? "text-orange-400" : "text-gray-500"}`}>{p.name}</h3>
                  {p.featured && SPECIAL_OFFER.active && SPECIAL_OFFER.plan === "pro" && (
                    <p className="mt-2 text-sm text-gray-400 line-through">{formatKes(PLAN_PRICING_KES.pro)}</p>
                  )}
                  <p className="mt-2 text-3xl font-bold tracking-tight">{p.price}</p>
                  <p className={`text-xs ${p.featured ? "text-gray-400" : "text-gray-400"}`}>{p.sub}</p>
                  <ul className={`mt-6 flex-1 space-y-2 text-sm ${p.featured ? "text-gray-300" : "text-gray-600"}`}>
                    {p.items.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                  <a
                    href={p.href}
                    className={`mt-8 rounded-full px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                      p.featured ? "bg-orange-500 text-white hover:bg-orange-600" : "border border-gray-300 text-gray-800 hover:border-gray-500"
                    }`}
                  >
                    {p.cta}
                  </a>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* CTA */}
          <motion.section {...reveal()} className="rounded-3xl bg-gray-950 px-6 py-16 text-center text-white">
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">Ready to see your fleet in real time?</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">Set up your company in minutes and start tracking your first vehicle today.</p>
            <a href="/register" className="mt-8 inline-block rounded-full bg-orange-500 px-6 py-3 text-sm font-medium text-white hover:bg-orange-600">
              Register your company
            </a>
          </motion.section>
        </main>

        {/* FOOTER */}
        <footer className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="mb-3">
                <BrandWordmark />
              </div>
              <p className="text-sm text-gray-500">Real-time vehicle tracking and fleet analytics for growing businesses.</p>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-950">Product</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#features" className="hover:text-gray-800">Features</a></li>
                <li><a href="#driver-app" className="hover:text-gray-800">Driver app</a></li>
                <li><a href="#pricing" className="hover:text-gray-800">Pricing</a></li>
                <li><a href="/register" className="hover:text-gray-800">Get started</a></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-950">Company</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-800">About</a></li>
                <li><a href="#" className="hover:text-gray-800">Careers</a></li>
                <li><a href="#" className="hover:text-gray-800">Contact</a></li>
                <li><a href="#" className="hover:text-gray-800">Support</a></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-950">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-800">Privacy policy</a></li>
                <li><a href="#" className="hover:text-gray-800">Terms of service</a></li>
                <li><a href="#" className="hover:text-gray-800">Cookie policy</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-black/5 pt-6 sm:flex-row">
            <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} FIGBLOOM FLEET. All rights reserved.</p>
            <p className="flex items-center gap-1.5 text-xs text-gray-400">
              <img loading="lazy" decoding="async" src="/movec logo 1.png" className="h-10 w-10" alt="" />
              Movec Systems
            </p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
