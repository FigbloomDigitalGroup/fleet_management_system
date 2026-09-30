"use client";

import {
  FaCog,
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
} from "react-icons/fa";
import { useState } from "react";

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
    q: "How does the AI assistant differ from regular alerts?",
    a: "Standard alerts fire on fixed rules, like a set speed limit. The AI layer instead learns each vehicle's normal pattern and flags behavior that's unusual for that specific vehicle, even if it stays within fixed limits.",
  },
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
  { slug: "security_cash_transit", name: "Security & cash-in-transit", description: "High-value cargo protection and panic alerts." },
  { slug: "agriculture", name: "Agriculture", description: "Track tractors and trucks across farms and routes." },
  { slug: "government_municipal", name: "Government & municipal", description: "Fuel accountability, no unauthorized use." },
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

      <header className="sticky top-0 z-50 bg-white">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-xl font-bold text-teal-950">
            <FaCog aria-hidden="true" />
            FIGBLOOM FLEET
          </span>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-sm text-gray-700 hover:text-gray-900 px-5 py-2.5 font-medium">
              Sign in
            </a>
            <a href="/register" className="text-sm text-white hover:text-gray-200 bg-orange-500 hover:bg-orange-600 px-5 py-2.5 font-medium rounded-full">
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
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-teal-50 text-teal-950 flex items-center justify-center">
              <FaMapMarkerAlt size={22} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Live tracking</h3>
            <p className="text-sm text-gray-500">See every vehicle location update in real time on one map.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
              <FaBell size={22} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Instant alerts</h3>
            <p className="text-sm text-gray-500">Get notified the moment a vehicle speeds, idles, or leaves its route.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
              <FaChartLine size={22} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Fleet analytics</h3>
            <p className="text-sm text-gray-500">Track trips, mileage, and driver activity with clear reports.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
              <FaMapMarkedAlt size={22} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Geofencing</h3>
            <p className="text-sm text-gray-500">Draw zones and get notified the moment a vehicle enters or leaves one.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center">
              <FaTachometerAlt size={22} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Driver behavior</h3>
            <p className="text-sm text-gray-500">Catch harsh braking, harsh acceleration, and excessive idling automatically.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
              <FaShieldAlt size={22} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">SOS emergency alerts</h3>
            <p className="text-sm text-gray-500">Drivers can send an emergency alert straight to your dashboard in one tap.</p>
          </div>
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
            <li>• See your assigned vehicle's status and zone at a glance</li>
            <li>• Review your trip history anytime</li>
            <li>• Get real-time alerts for your vehicle as they happen</li>
            <li>• Reset your password right from the app if you ever get locked out</li>
          </ul>
        </div>

        <div className="w-full aspect-video bg-gray-100 overflow-hidden">
          <img src="/noelsch-audi-a3-2095801_1920.jpg" alt="Driver mobile app" className="w-full h-full object-cover" />
        </div>
      </section>

      {/* GET THE APP */}
      <section className="bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-900 py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 flex justify-center">
            <img
              src="/driver-app-phone.jpg"
              alt="FIGBLOOM FLEET driver app on a phone"
              className="w-full max-w-sm rounded-2xl shadow-2xl object-cover"
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
              Download the driver app to check in on your vehicle, review your trips, and send
              an SOS alert in one tap — right from your pocket.
            </p>
            <a
              href="#"
              className="inline-flex items-center gap-3 bg-black hover:bg-gray-900 text-white px-5 py-3 rounded-xl transition-colors"
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
              step. See a snapshot of a vehicle's recent routes right from its own page, or
              open the full replay to scrub through exactly what happened.
            </p>
          </div>
        </div>
      </section>

      {/* INDUSTRIES WE SERVE */}
      <section className="max-w-6xl mx-auto px-6 py-20">
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
            <div key={industry.slug}>
              <div className="w-full aspect-square bg-gray-100 overflow-hidden rounded-lg mb-3">
                <img
                  src={`/industries/${industry.slug}.jpg`}
                  alt={industry.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{industry.name}</h3>
              <p className="text-xs text-gray-500">{industry.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="max-w-6xl mx-auto px-6 py-20">
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
          <div className="rounded-lg p-6 flex flex-col">
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
          <div className="rounded-lg p-6 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Basic</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">$29</p>
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
          <div className="rounded-lg p-6 flex flex-col relative ring-2 ring-orange-500">
            <span className="absolute -top-3 left-6 bg-orange-500 text-white text-xs font-medium px-3 py-1 rounded-full">
              Most popular
            </span>
            <h3 className="text-sm font-semibold text-orange-500 uppercase mb-2">Pro</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">$49</p>
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
          <div className="rounded-lg p-6 flex flex-col">
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
      <section className="max-w-3xl mx-auto px-6 py-20">
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
              <div key={i} className="border border-gray-200 rounded-lg">
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
                  <FaCog aria-hidden="true" />
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

