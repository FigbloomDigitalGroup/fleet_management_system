"use client";

import { FaCog, FaMapMarkerAlt, FaBell, FaChartLine, FaTwitter, FaLinkedin, FaFacebook } from "react-icons/fa";
import { HiOutlineLightningBolt } from "react-icons/hi";

export default function LandingPage() {
  return (
    <div className="bg-white min-h-screen">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-xl font-bold text-blue-950">
            <FaCog aria-hidden="true" />
            MOVEC FLEET
          </span>
          <a href="/login" className="text-sm text-gray-700 hover:text-green-500">
            Sign in
          </a>
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
                <p className="text-gray-200 text-lg mb-8">
                  MOVEC FLEET is a fleet tracking platform built for vehicle-owning businesses.
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
            <div className="w-12 h-12 rounded-full text-black flex items-center justify-center mx-auto mb-4">
              <FaMapMarkerAlt size={30} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Live tracking</h3>
            <p className="text-sm text-gray-500">See every vehicle location update in real time on one map.</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full text-black flex items-center justify-center mx-auto mb-4">
              <FaBell size={30} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Instant alerts</h3>
            <p className="text-sm text-gray-500">Get notified the moment a vehicle speeds, idles, or leaves its route.</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full text-black flex items-center justify-center mx-auto mb-4">
              <FaChartLine size={30} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Fleet analytics</h3>
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
          <p className="text-gray-600 mb-6">
            MOVEC FLEET gives vehicle-owning businesses one place to see every truck, van or car in
            real time. Register your company, add your vehicles and start tracking with no
            hardware headaches and no spreadsheets.
          </p>
          <a href="/register" className="inline-block px-5 py-2.5 font-medium text-white bg-orange-500 hover:bg-orange-600">
            Register your company
          </a>
        </div>

        <div className="w-full aspect-video bg-gray-100 border border-gray-200 overflow-hidden">
          <img src="/viarami-fleet-5153286_1920.jpg" alt="Company fleet dashboard" className="w-full h-full object-cover" />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div className="order-2 md:order-1 w-full aspect-video bg-gray-100 border border-gray-200 overflow-hidden">
          <img src="/as_photography-digital-marketing-1725340_1920.jpg" alt="Fleet admin dashboard" className="w-full h-full object-cover" />
        </div>

        <div className="order-1 md:order-2">
          <span className="text-sm uppercase tracking-wide text-blue-950 font-bold mb-3 block">
            I am a company admin
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
            Run the fleet from one screen.
          </h2>
          <p className="text-gray-600">
            Add vehicles, assign drivers and watch every trip unfold live on the map. When
            something needs your attention such as a vehicle idling too long or straying off
            route, you will know before it becomes a problem.
          </p>
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
          <p className="text-gray-600">
            Soon, the MOVEC FLEET mobile app will let you check in on your assigned vehicle, log
            trips as you drive and send an SOS alert the moment something goes wrong. Built
            for the road, not a desk.
          </p>
        </div>

        <div className="w-full aspect-video bg-gray-100 border border-gray-200 overflow-hidden">
          <img src="/noelsch-audi-a3-2095801_1920.jpg" alt="Driver mobile app" className="w-full h-full object-cover" />
        </div>
      </section>

      <section className="bg-gray-900 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to see your fleet in real time?
          </h2>
          <p className="text-gray-300 mb-8">
            Set up your company in minutes and start tracking your first vehicle today.
          </p>
          <a href="/register" className="inline-block px-6 py-3 font-medium text-white bg-orange-500 hover:bg-orange-600">
            Register your company
          </a>
        </div>
      </section>

      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <span className="flex items-center gap-2 text-lg font-bold text-blue-950 mb-3">
                <FaCog aria-hidden="true" />
                MOVEC FLEET
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
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Product</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-800">Live tracking</a></li>
                <li><a href="#" className="hover:text-gray-800">Alerts</a></li>
                <li><a href="#" className="hover:text-gray-800">Analytics</a></li>
                <li><a href="/register" className="hover:text-gray-800">Get started</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Company</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-800">About</a></li>
                <li><a href="#" className="hover:text-gray-800">Careers</a></li>
                <li><a href="#" className="hover:text-gray-800">Contact</a></li>
                <li><a href="#" className="hover:text-gray-800">Support</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-800">Privacy policy</a></li>
                <li><a href="#" className="hover:text-gray-800">Terms of service</a></li>
                <li><a href="#" className="hover:text-gray-800">Cookie policy</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} MOVEC FLEET. All rights reserved.
            </p>
            <p className="flex items-center gap-1.5 text-xs text-gray-400">
              <img src="/movec logo 1.png" className="h-10 w-10" alt="" />
              Movec Systems
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}