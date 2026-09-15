"use client";

import { FaCog, FaTwitter, FaLinkedin, FaFacebook } from "react-icons/fa";
import ThemeToggle from "./components/ThemeToggle";

export default function LandingPage() {
  return (
    <div className="bg-white min-h-screen">
      <header className="sticky top-0 z-50 bg-white">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-xl font-bold text-blue-950">
            <FaCog aria-hidden="true" />
            FIGBLOOM FLEET
          </span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a href="/login" className="text-sm text-gray-700 hover:text-teal-500">
              Sign in
            </a>
          </div>
        </nav>
      </header>

      <section className="relative">
        <div className="bg-cover bg-center" style={{ backgroundImage: "url('/zdrsoft-highway-7213206_1920.jpg')" }}>
          <div className="bg-black/60">
            <div className="max-w-6xl mx-auto px-6 py-28 md:py-36">
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
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid sm:grid-cols-3 gap-8">
          <div className="text-center">
            <img src="/live tracking.jpg" alt="Live tracking" className="w-15 h-15 mx-auto mb-4 object-contain" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Live tracking</h3>
            <p className="text-sm text-gray-500">See every vehicle location update in real time on one map.</p>
          </div>
          <div className="text-center">
            <img src="/alerts-icon.png" alt="Instant alerts" className="w-15 h-15 mx-auto mb-4 object-contain" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Instant alerts</h3>
            <p className="text-sm text-gray-500">Get notified the moment a vehicle speeds, idles, or leaves its route.</p>
          </div>
          <div className="text-center">
            <img src="/7581159.png" alt="Fleet analytics" className="w-15 h-15 mx-auto mb-4 object-contain" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Fleet analytics</h3>
            <p className="text-sm text-gray-500">Track trips, mileage, and driver activity with clear reports.</p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="text-sm uppercase tracking-wide text-blue-950 font-bold mb-3 block">
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

      <section className="bg-blue-950/95 py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 w-full aspect-video bg-gray-100 overflow-hidden">
            <img src="/as_photography-digital-marketing-1725340_1920.jpg" alt="Fleet admin dashboard" className="w-full h-full object-cover" />
          </div>

          <div className="order-1 md:order-2 text-white">
            <span className="text-sm uppercase tracking-wide text-blue-200 font-bold mb-3 block">
              I am a company admin
            </span>
            <h2 className="text-3xl font-bold mb-4 leading-tight">
              Run the fleet from one screen.
            </h2>
            <p className="text-sm text-blue-50/90">
              Add vehicles, assign drivers and watch every trip unfold live on the map. When
              something needs your attention such as a vehicle idling too long or straying off
              route, you will know before it becomes a problem.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="text-sm uppercase tracking-wide text-blue-950 font-bold mb-3 block">
            I am a driver
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
            Your trips and your record, in your pocket.
          </h2>
          <p className="text-sm text-gray-600">
            Soon, the FIGBLOOM FLEET mobile app will let you check in on your assigned vehicle, log
            trips as you drive and send an SOS alert the moment something goes wrong. Built
            for the road, not a desk.
          </p>
        </div>

        <div className="w-full aspect-video bg-gray-100 overflow-hidden">
          <img src="/noelsch-audi-a3-2095801_1920.jpg" alt="Driver mobile app" className="w-full h-full object-cover" />
        </div>
      </section>



      {/* PRICING */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <span className="text-sm uppercase tracking-wide text-blue-950 font-bold mb-3 block">
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

      <section className="bg-gray-900 py-16">
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
              <span className="flex items-center gap-2 text-lg font-bold text-blue-950 mb-3">
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
                <li><a href="#" className="hover:text-gray-800">Analytics</a></li>
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
    </div >
  );
}