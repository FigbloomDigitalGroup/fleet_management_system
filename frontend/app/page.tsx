"use client";

import {
  FaTwitter,
  FaLinkedin,
  FaFacebook,
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
  FaBatteryQuarter,
  FaUserShield,
  FaMobileAlt,
  FaUserLock,
  FaFileExcel,
} from "react-icons/fa";
import { useState } from "react";
import BrandIcon from "./components/BrandIcon";
import { PLAN_PRICING_KES, SPECIAL_OFFER, priceForPlan, formatKes, offerLabel } from "./lib/pricing";

const FAQS = [
  {
    q: "Do I need special hardware to start tracking?",
    a: "No. You can start with our GPS ping API today, and connect a hardware tracker or the driver mobile app whenever you're ready — the dashboard works the same either way.",
  },
  {
    q: "Can I track more than one company or fleet?",
    a: "Each company account is isolated to its own fleet, vehicles, and drivers. If you manage multiple fleets, you can register a separate company account for each one.",
  },
  {
    q: "What happens if a vehicle has no driver assigned?",
    a: "The system automatically marks it offline and flags an alert if it detects movement, so you always know when a vehicle is being used without an assigned driver.",
  },
  {
    q: "Can I change my plan later?",
    a: "Yes. You can upgrade or downgrade your plan at any time from your company settings — your data and history stay exactly as they are.",
  },
  {
    q: "Is my company's data visible to other companies on the platform?",
    a: "No. Every company's vehicles, drivers, trips, and alerts are fully isolated — no other company on the platform can see your data.",
  },
  {
    q: "What if my drivers lose network signal?",
    a: "The driver app keeps recording the route while offline and uploads it, with the real times, as soon as the phone reconnects, so trip history has no gaps. Tracking also keeps running in the background with the screen off.",
  },
  {
    q: "Can my customers see where their delivery is?",
    a: "Yes. Every job has a private tracking link you can send to the customer. It shows the driver's live position and estimated arrival while they're on the way, with no login needed.",
  },
  {
    q: "How do you handle driver privacy?",
    a: "Drivers accept a clear tracking notice in the app before anything is shared, you can limit tracking to working hours, and location history is deleted automatically after the retention period you choose, in line with Kenya's Data Protection Act.",
  },
  {
    q: "Can I give office staff limited access?",
    a: "Yes. Each admin can be a full admin, a dispatcher (runs jobs, routes and driver messages) or a view-only user, so everyone sees what they need without being able to change everything.",
  },
  {
    q: "How does the AI assistant differ from regular alerts?",
    a: "Standard alerts fire on fixed rules, like a set speed limit. The AI layer instead learns each vehicle's normal pattern and flags behavior that's unusual for that specific vehicle, even if it stays within fixed limits.",
  },
];

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Deliveries", href: "#deliveries" },
  { label: "Routes & fuel", href: "#routes" },
  { label: "Industries", href: "#industries" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const FEATURES = [
  {
    icon: FaMapMarkerAlt,
    iconBg: "bg-teal-50",
    iconColor: "text-teal-950",
    title: "Live tracking",
    description: "See every vehicle location update in real time on one map.",
  },
  {
    icon: FaBell,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    title: "Instant alerts",
    description: "Get notified the moment a vehicle speeds, idles, or leaves its route.",
  },
  {
    icon: FaChartLine,
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    title: "Fleet analytics",
    description: "Distance, hours, stops, idle time and deliveries per vehicle or driver — export to Excel or PDF.",
  },
  {
    icon: FaMapMarkedAlt,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    title: "Geofencing",
    description: "Draw zones and get notified the moment a vehicle enters or leaves one.",
  },
  {
    icon: FaTachometerAlt,
    iconBg: "bg-yellow-50",
    iconColor: "text-yellow-600",
    title: "Driver behavior",
    description: "Catch speeding, harsh braking and cornering, idling and phone use while driving — rolled into a safety score per driver.",
  },
  {
    icon: FaShieldAlt,
    iconBg: "bg-red-50",
    iconColor: "text-red-600",
    title: "SOS emergency alerts",
    description: "Drivers can send an emergency alert straight to your dashboard in one tap.",
  },
  {
    icon: FaRoute,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-700",
    title: "Jobs & proof of delivery",
    description: "Dispatch stops to drivers, order them efficiently, and get photo and signature proof for every drop.",
  },
  {
    icon: FaClipboardCheck,
    iconBg: "bg-teal-50",
    iconColor: "text-teal-700",
    title: "Vehicle inspections",
    description: "Drivers complete a pre-trip checklist with photos — you're alerted the moment something fails.",
  },
  {
    icon: FaTools,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-700",
    title: "Maintenance reminders",
    description: "Service records and reminders by date or mileage, so no vehicle misses its next service.",
  },
];

// Why phone-based tracking holds up in the real world — the reliability and
// privacy features drivers' phones need.
const RELIABILITY = [
  { icon: FaMobileAlt, title: "Tracks in the background", text: "Keeps sharing location with the screen off or the app minimised, and resumes when the app is reopened." },
  { icon: FaWifi, title: "Works through dead zones", text: "Points recorded offline are uploaded with their real times once the signal returns — no gaps in trip history." },
  { icon: FaBatteryQuarter, title: "Easy on the battery", text: "Updates often while moving and backs off when parked, so a shift doesn't drain the phone." },
  { icon: FaBell, title: "Tamper & health alerts", text: "Know when location is switched off, the battery is low, the driver logs out, or a phone goes silent." },
  { icon: FaUserShield, title: "Fake GPS detection", text: "Positions from mock-location apps are flagged, so a driver can't fake where they are." },
  { icon: FaUserLock, title: "Privacy by design", text: "Driver consent, optional tracking hours and automatic deletion after your retention period." },
];

const STEPS = [
  { n: 1, title: "Register your company", text: "Create your account in minutes and set up your company profile." },
  { n: 2, title: "Add vehicles & drivers", text: "Register each vehicle, assign a driver, and set up alerts or zones." },
  { n: 3, title: "Track live, get alerted", text: "Watch your fleet move in real time, and get notified the moment something needs attention." },
];

// Slugs match backend/models/Company.js's industry enum — image files go in
// public/industries/<slug>.jpg, dropped in later once available.
const INDUSTRIES = [
  { slug: "logistics_courier", name: "Logistics & courier", description: "Prove on-time delivery and optimize routes." },
  { slug: "public_transport", name: "Public transport", description: "Route compliance, passenger safety, speed governance." },
  { slug: "school_transport", name: "School transport", description: "Know when the bus arrives, and who's on board." },
  { slug: "construction", name: "Construction & equipment", description: "Track machinery and trucks across job sites." },
  { slug: "taxi_ride_hailing", name: "Taxi & ride-hailing", description: "Driver accountability and route verification." },
  { slug: "agriculture", name: "Agriculture", description: "Track tractors and trucks across farms and routes." },
  { slug: "oil_gas", name: "Oil & gas distribution", description: "Tanker tracking and theft prevention." },
  { slug: "rental_car", name: "Rental car", description: "Know where rentals are, enforce geofenced limits." },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-white min-h-screen">
      <style>{`
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .step-animate {
          opacity: 0;
          animation: stepIn 0.6s ease-out forwards;
        }
      `}</style>

      {SPECIAL_OFFER.active && (
        <div className="bg-teal-950">
          <div className="max-w-6xl mx-auto px-6 py-2 flex flex-wrap items-center justify-center gap-2">
            <span className="animate-shake inline-block shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Special offer
            </span>
            <span className="text-xs font-medium text-white text-center">{offerLabel()}</span>
            <a href="#pricing" className="text-xs font-semibold text-orange-300 hover:text-orange-200 underline underline-offset-2">
              See plans
            </a>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-white">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-xl font-bold text-teal-950">
            <BrandIcon variant="dark" className="h-6 w-6" />
            FIGBLOOM FLEET
          </span>
          <div className="hidden lg:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="relative pb-1 text-sm text-gray-600 font-medium transition-colors hover:text-teal-950 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-orange-500 after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-sm text-gray-700 hover:text-gray-900 px-5 py-2.5 font-medium transition-colors">
              Sign in
            </a>
            <a href="/register" className="text-sm text-white hover:text-gray-200 bg-orange-500 hover:bg-orange-600 px-5 py-2.5 font-medium rounded-full transition-colors">
              Get started
            </a>
          </div>
        </nav>
      </header>

      {/* HERO — headline on the left, 3-step tracker on the right */}
      <section className="relative">
        <div className="bg-cover bg-center" style={{ backgroundImage: "url('/zdrsoft-highway-7213206_1920.jpg')" }}>
          <div className="bg-black/60">
            <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: headline */}
              <div className="max-w-xl text-left">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
                  Know where your fleet is at every moment.
                </h1>
                <p className="text-gray-200 text-base mb-8">
                  FIGBLOOM FLEET is a fleet tracking platform built for vehicle-owning businesses.
                  Live GPS tracking, driver management and instant alerts, all in one dashboard.
                </p>
                <div className="flex items-center gap-4">
                  <a href="/register" className="px-6 py-3 font-medium text-white bg-orange-500 hover:bg-orange-600">
                    Register your company
                  </a>
                  <a href="/login" className="px-6 py-3 font-medium text-white border border-white/40 hover:border-white">
                    Sign in
                  </a>
                </div>
              </div>

              {/* Right: 3-step tracking process, animated in */}
              <div className="bg-none p-6">
                <span className="text-xs uppercase tracking-wide text-teal-200 font-bold mb-4 block">
                  How it works
                </span>
                <div className="space-y-5">
                  {STEPS.map((step, i) => (
                    <div
                      key={step.n}
                      className="step-animate flex gap-4"
                      style={{ animationDelay: `${i * 0.25}s` }}
                    >
                      <div className="shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">
                        {step.n}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-sm">{step.title}</h3>
                        <p className="text-gray-300 text-xs mt-1">{step.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE ICONS — now react-icons instead of image files */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="border border-gray-200 hover:border-orange-500 hover:shadow-lg transition-all duration-200 p-6 text-center"
              >
                <div className={`w-14 h-14 mx-auto mb-4 rounded-full ${feature.iconBg} ${feature.iconColor} flex items-center justify-center`}>
                  <Icon size={22} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="text-sm uppercase tracking-wide text-teal-950 font-bold mb-3 block">
            We are a company
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
            Know where your fleet is without chasing it.
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            FIGBLOOM FLEET gives vehicle-owning businesses one place to see every truck, van or car in
            real time. Register your company, add your vehicles and start tracking with no
            hardware headaches and no spreadsheets.
          </p>
          <a href="/register" className="inline-block px-5 py-2.5 font-medium text-white bg-orange-500 hover:bg-orange-600">
            Register your company
          </a>
        </div>

        <div className="w-full aspect-video bg-gray-100 overflow-hidden">
          <img src="/viarami-fleet-5153286_1920.jpg" alt="Company fleet dashboard" className="w-full h-full object-cover" />
        </div>
      </section>

      <section className="bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-900 py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 w-full aspect-video bg-gray-100 overflow-hidden">
            <img src="/as_photography-digital-marketing-1725340_1920.jpg" alt="Fleet admin dashboard" className="w-full h-full object-cover" />
          </div>

          <div className="order-1 md:order-2 text-white">
            <span className="text-sm uppercase tracking-wide text-teal-200 font-bold mb-3 block">
              I am a company admin
            </span>
            <h2 className="text-3xl font-bold mb-4 leading-tight">
              Run the fleet from one screen.
            </h2>
            <p className="text-sm text-teal-50/90">
              Add vehicles, assign drivers and watch every trip unfold live on the map. When
              something needs your attention such as a vehicle idling too long or straying off
              route, you will know before it becomes a problem.
            </p>
            <ul className="mt-4 text-sm text-teal-50/90 space-y-2">
              <li>• Today's jobs, safety score, inspections, maintenance and driver phones at a glance</li>
              <li>• Chat with any driver, and choose which alerts reach your email</li>
              <li>• Give staff full, dispatcher or view-only access</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="text-sm uppercase tracking-wide text-teal-950 font-bold mb-3 block">
            I am a driver
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
            Your trips and your record, in your pocket.
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            The FIGBLOOM FLEET driver app is built for the road, not a desk — everything a
            driver needs, in one pocket-sized app.
          </p>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• One-tap SOS — sends an emergency alert straight to your fleet admin's dashboard</li>
            <li>• Your jobs for the day in order, with one-tap navigation in Google Maps or Waze</li>
            <li>• Capture proof of delivery — photos, signature and notes</li>
            <li>• Pre-trip vehicle inspection checklist</li>
            <li>• Chat with dispatch, and log fuel and expenses with a receipt photo</li>
            <li>• See your own safety score and how to improve it</li>
            <li>• See your assigned vehicle's status and zone, your trips and real-time alerts</li>
            <li>• Reset your password right from the app if you ever get locked out</li>
          </ul>
        </div>

        <div className="w-full aspect-video bg-gray-100 overflow-hidden">
          <img src="/noelsch-audi-a3-2095801_1920.jpg" alt="Driver mobile app" className="w-full h-full object-cover" />
        </div>
      </section>

      {/* GET THE APP */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-900 py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 flex justify-center">
            <img
              src="/driver-app-phone.jpg"
              alt="FIGBLOOM FLEET driver app on a phone"
              className="w-full max-w-sm rounded-lg shadow-2xl object-cover"
            />
          </div>

          <div className="order-1 md:order-2 text-white">
            <span className="text-sm uppercase tracking-wide text-teal-300 font-bold mb-3 block">
              Driver app
            </span>
            <h2 className="text-3xl font-bold mb-4 leading-tight">
              Take FIGBLOOM FLEET on the road.
            </h2>
            <p className="text-sm text-teal-50/90 mb-8">
              Download the driver app to get your jobs, navigate to each stop, capture proof of
              delivery, run your pre-trip inspection and send an SOS alert in one tap — right
              from your pocket, even where the signal drops.
            </p>
            <a
              href="#"
              className="inline-flex items-center gap-3 bg-black hover:bg-gray-900 text-white px-5 py-3 rounded-md transition-colors"
            >
              <FaGooglePlay size={28} />
              <span className="text-left">
                <span className="block text-[10px] uppercase tracking-wide text-gray-300">Get it on</span>
                <span className="block text-lg font-semibold leading-tight">Google Play</span>
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* TRIP REPLAY */}
      <section className="bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-900 py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 w-full aspect-video bg-gray-100 overflow-hidden">
            <img src="/dariuszsankowski-navigation-1048294_1920.jpg" alt="Trip replay route map" className="w-full h-full object-cover" />
          </div>

          <div className="order-1 md:order-2 text-white">
            <span className="text-sm uppercase tracking-wide text-teal-200 font-bold mb-3 block">
              Trip replay
            </span>
            <h2 className="text-3xl font-bold mb-4 leading-tight">
              Every route, saved and ready to review.
            </h2>
            <p className="text-sm text-teal-50/90">
              Play back any past trip on a map, point by point, with speed and time at every
              step — or pick any date and time range to see everywhere a vehicle went, where it
              stopped and for how long.
            </p>
          </div>
        </div>
      </section>

      {/* DISPATCH & DELIVERIES */}
      <section id="deliveries" className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center scroll-mt-20">
        <div>
          <span className="text-sm uppercase tracking-wide text-teal-950 font-bold mb-3 block">
            Dispatch & deliveries
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
            From job sheet to signed delivery, in one flow.
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Send stops straight to a driver's app and let FIGBLOOM FLEET put them in the most
            efficient order, respecting each customer's time window.
          </p>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Create jobs from just an address — we find it on the map</li>
            <li>• Optimise each driver's stops in one click</li>
            <li>• Drivers navigate with Google Maps or Waze and update the status as they go</li>
            <li>• Photo, signature and notes as proof of delivery, with time and place</li>
            <li>• Failed stops come back with a reason, so nothing goes missing</li>
            <li>• Send customers a live tracking link with the driver's ETA</li>
          </ul>
        </div>

        <div className="w-full aspect-video bg-gray-100 overflow-hidden">
          <img src="/skica911-driver-3978839_1920.jpg" alt="Driver completing a delivery" className="w-full h-full object-cover" />
        </div>
      </section>

      {/* RELIABILITY & PRIVACY */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-900 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <span className="text-sm uppercase tracking-wide text-teal-300 font-bold mb-3 block text-center">
            Built for the road
          </span>
          <h2 className="text-3xl font-bold text-white mb-10 leading-tight text-center">
            Phone tracking you can actually rely on.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {RELIABILITY.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-lg bg-white/5 p-6 ring-1 ring-white/10">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-teal-400/15 text-teal-300">
                    <Icon size={18} />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-teal-50/80">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* REPORTS & DRIVER SCORES */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div className="order-2 md:order-1 w-full aspect-video bg-gray-100 overflow-hidden">
          <img src="/zdrsoft-highway-7213206_1920.jpg" alt="Fleet on the highway" className="w-full h-full object-cover" />
        </div>
        <div className="order-1 md:order-2">
          <span className="text-sm uppercase tracking-wide text-teal-950 font-bold mb-3 block">
            Reports & driver scores
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
            Numbers you can coach with.
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Every driver gets a 0–100 safety score from speeding, harsh braking and cornering,
            and phone use per 100 km — so you can compare fairly and coach the right people.
            Reports cover distance, hours, stops, idle time, deliveries completed and late, and
            expenses, per vehicle or per driver.
          </p>
          <p className="inline-flex items-center gap-2 text-sm font-medium text-teal-700">
            <FaFileExcel /> Export to Excel or PDF in one click
          </p>
        </div>
      </section>

      {/* ROUTE PLANNING & FUEL ESTIMATES */}
      <section id="routes" className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center scroll-mt-20">
        <div>
          <span className="text-sm uppercase tracking-wide text-teal-950 font-bold mb-3 block">
            Route planning & fuel insight
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
            Plan the route, know the fuel cost before you drive it.
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Draw a route point by point on the map and assign it to a vehicle — FIGBLOOM FLEET
            works out the distance in kilometers and an estimated fuel range in litres, based on
            that vehicle's own average consumption, not a generic figure.
          </p>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Draw a multi-point route on the map, or ask the AI assistant to draft one for you</li>
            <li>• Distance calculated automatically in kilometers</li>
            <li>• Fuel estimated in litres from each vehicle's real average consumption</li>
            <li>• Set a deviation tolerance so drivers stay on the planned path</li>
            <li>• See every planned route's distance and fuel estimate on your dashboard at a glance</li>
          </ul>
        </div>

        <div className="w-full aspect-video bg-gray-100 overflow-hidden">
          <img src="/schwoaze-highway-3392100_1920.jpg" alt="Planned route on the highway" className="w-full h-full object-cover" />
        </div>
      </section>

      {/* INDUSTRIES WE SERVE */}
      <section id="industries" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-20">
        <div className="text-center mb-12">
          <span className="text-sm uppercase tracking-wide text-teal-950 font-bold mb-3 block">
            Industries we serve
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Built for every kind of fleet</h2>
          <p className="text-sm text-gray-600 max-w-xl mx-auto">
            Whatever you move, protect, or manage on wheels — FIGBLOOM FLEET adapts to how your
            business actually works.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {INDUSTRIES.map((industry) => (
            <div
              key={industry.slug}
              className="group border border-gray-200 hover:border-orange-500 hover:shadow-lg transition-all duration-200"
            >
              <div className="w-full aspect-square bg-gray-100 overflow-hidden border-b border-gray-200">
                <img
                  src={`/industries/${industry.slug}.jpg`}
                  alt={industry.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{industry.name}</h3>
                <p className="text-xs text-gray-500">{industry.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-20">
        <div className="text-center mb-12">
          <span className="text-sm uppercase tracking-wide text-teal-950 font-bold mb-3 block">
            Pricing
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Plans that grow with your fleet</h2>
          <p className="text-sm text-gray-600 max-w-xl mx-auto">
            Start free, upgrade as your fleet grows. No hidden fees, cancel anytime.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Trial */}
          <div className="rounded p-6 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Trial</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">Free</p>
            <p className="text-xs text-gray-400 mb-6">14 days</p>
            <ul className="text-sm text-gray-600 space-y-2 mb-8 flex-1">
              <li>Up to 3 vehicles</li>
              <li>Live GPS tracking</li>
              <li>Basic trip history</li>
              <li>Email support</li>
            </ul>

            <a
              href="/register"
              className="text-center px-4 py-2.5 font-medium text-gray-700 border border-gray-300 hover:border-gray-400"
            >
              Start free trial
            </a>
          </div>

          {/* Basic */}
          <div className="rounded p-6 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Basic</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">{formatKes(PLAN_PRICING_KES.basic)}</p>
            <p className="text-xs text-gray-400 mb-6">per vehicle / month</p>
            <ul className="text-sm text-gray-600 space-y-2 mb-8 flex-1">
              <li>Up to 15 vehicles</li>
              <li>Live GPS tracking</li>
              <li>Trip history & reports</li>
              <li>Speeding & idle alerts</li>
              <li>Geofence zones & entry/exit alerts</li>
              <li>Email support</li>
            </ul>

            <a
              href="/register"
              className="text-center px-4 py-2.5 font-medium text-gray-700 border border-gray-300 hover:border-gray-400"
            >
              Get started
            </a>
          </div>

          {/* Pro — highlighted */}
          <div className="rounded p-6 flex flex-col relative ring-2 ring-orange-500">
            <span className="absolute -top-3 left-6 bg-orange-500 text-white text-xs font-medium px-3 py-1 rounded-full">
              {SPECIAL_OFFER.active && SPECIAL_OFFER.plan === "pro" ? `Save ${SPECIAL_OFFER.discountPercent}%` : "Most popular"}
            </span>
            <h3 className="text-sm font-semibold text-orange-500 uppercase mb-2">Pro</h3>
            {SPECIAL_OFFER.active && SPECIAL_OFFER.plan === "pro" && (
              <p className="text-sm text-gray-400 line-through">{formatKes(PLAN_PRICING_KES.pro)}</p>
            )}
            <p className="text-3xl font-bold text-gray-900 mb-1">{formatKes(priceForPlan("pro"))}</p>
            <p className="text-xs text-gray-400 mb-6">per vehicle / month</p>
            <ul className="text-sm text-gray-600 space-y-2 mb-8 flex-1">
              <li>Up to 50 vehicles</li>
              <li>Everything in Basic</li>
              <li>Route deviation alerts</li>
              <li>Fuel anomaly detection</li>
              <li>Driver behavior alerts (harsh braking, idling)</li>
              <li>AI fleet assistant chat</li>
              <li>Priority support</li>
            </ul>

            <a
              href="/register"
              className="text-center px-4 py-2.5 font-medium text-white bg-orange-500 hover:bg-orange-600"
            >
              Get started
            </a>
          </div>

          {/* Enterprise */}
          <div className="rounded p-6 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Enterprise</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">Custom</p>
            <p className="text-xs text-gray-400 mb-6">contact us</p>
            <ul className="text-sm text-gray-600 space-y-2 mb-8 flex-1">
              <li>Unlimited vehicles</li>
              <li>Everything in Pro</li>
              <li>Dedicated account manager</li>
              <li>Custom integrations</li>
              <li>SLA-backed support</li>
            </ul>

            <a
              href="#"
              className="text-center px-4 py-2.5 font-medium text-gray-700 border border-gray-300 hover:border-gray-400"
            >
              Contact sales
            </a>
          </div>
        </div>
      </section >

      {/* AI ASSISTANT */}
      <section className="bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-900 py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <span className="text-sm uppercase tracking-wide text-teal-200 font-bold mb-3 block">
              AI-Powered Insights
            </span>
            <h2 className="text-3xl font-bold mb-4 leading-tight">
              An assistant watching your fleet, beyond fixed rules.
            </h2>
            <p className="text-sm text-teal-50/90 mb-6">
              Speeding limits and geofences catch the obvious. Our AI layer looks deeper —
              reviewing driving patterns for each vehicle to flag unusual behavior that a
              fixed threshold would miss, like erratic speed changes or activity outside
              a driver's normal routine.
            </p>
            <ul className="text-sm text-teal-50/90 space-y-2">
              <li>• Learns each vehicle's normal driving pattern over time</li>
              <li>• Flags anomalies fixed speed limits alone can't catch</li>
              <li>• Runs continuously in the background, no setup required</li>
              <li>• Ask it questions about your fleet in plain English, anytime</li>
            </ul>
          </div>

          <div className="w-full aspect-video bg-gray-800 overflow-hidden">
            <img src="/hencyx-the-car-2650985.jpg" alt="AI fleet assistant" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-6 py-20 scroll-mt-20">
        <div className="text-center mb-12">
          <span className="text-sm uppercase tracking-wide text-teal-950 font-bold mb-3 block">
            FAQ
          </span>
          <h2 className="text-3xl font-bold text-gray-900">Common questions</h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i} className="border border-gray-200 rounded">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium text-gray-900">{item.q}</span>
                  <span className="text-gray-400 text-lg leading-none">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <p className="px-5 pb-4 text-sm text-gray-600">{item.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </section >

      <div>
        <section className="bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-900 py-16">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Ready to see your fleet in real time?
            </h2>
            <p className="text-sm text-gray-300 mb-8">
              Set up your company in minutes and start tracking your first vehicle today.
            </p>
            <a href="/register" className="inline-block px-6 py-3 font-medium text-white bg-orange-500 hover:bg-orange-600">
              Register your company
            </a>
          </div>
        </section>

        <footer className="bg-white">
          <div className="max-w-6xl mx-auto px-6 py-14">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
              <div>
                <span className="flex items-center gap-2 text-lg font-bold text-teal-950 mb-3">
                  <BrandIcon variant="dark" className="h-5 w-5" />
                  FIGBLOOM FLEET
                </span>
                <p className="text-sm text-gray-500 mb-4">
                  Real-time vehicle tracking and fleet analytics for growing businesses.
                </p>
                <div className="flex items-center gap-4 text-gray-400">
                  <a href="#" aria-label="Twitter" className="hover:text-gray-600">
                    <FaTwitter size={16} />
                  </a>
                  <a href="#" aria-label="LinkedIn" className="hover:text-gray-600">
                    <FaLinkedin size={16} />
                  </a>
                  <a href="#" aria-label="Facebook" className="hover:text-gray-600">
                    <FaFacebook size={16} />
                  </a>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Product</h3>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="#" className="hover:text-gray-800">Live tracking</a></li>
                  <li><a href="#" className="hover:text-gray-800">Alerts</a></li>
                  <li><a href="#" className="hover:text-gray-800">Geofencing</a></li>
                  <li><a href="#" className="hover:text-gray-800">Analytics</a></li>
                  <li><a href="#" className="hover:text-gray-800">AI assistant</a></li>
                  <li><a href="/register" className="hover:text-gray-800">Get started</a></li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Company</h3>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="#" className="hover:text-gray-800">About</a></li>
                  <li><a href="#" className="hover:text-gray-800">Careers</a></li>
                  <li><a href="#" className="hover:text-gray-800">Contact</a></li>
                  <li><a href="#" className="hover:text-gray-800">Support</a></li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Legal</h3>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="#" className="hover:text-gray-800">Privacy policy</a></li>
                  <li><a href="#" className="hover:text-gray-800">Terms of service</a></li>
                  <li><a href="#" className="hover:text-gray-800">Cookie policy</a></li>
                </ul>
              </div>
            </div>

            <div className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-gray-400">
                &copy; {new Date().getFullYear()} FIGBLOOM FLEET. All rights reserved.
              </p>
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <img src="/movec logo 1.png" className="h-10 w-10" alt="" />
                Movec Systems
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div >
  );
}

