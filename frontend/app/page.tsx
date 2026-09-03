"use client";

import { FaUsers, FaUserTie, FaTruck } from "react-icons/fa";

export default function LandingPage() {
  return (
    <div className="bg-white min-h-screen">
      {/* STICKY HEADER */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="text-xl font-bold text-gray-900">DETOUR</span>
          <div className="flex items-center gap-6">
            <a href="/login" className="text-sm text-gray-700 hover:text-green-500">
              Sign in
            </a>
            <a
              href="/register"
              className="text-sm px-4 py-2 rounded-md font-medium text-white bg-orange-500 hover:bg-orange-600"
            >
              Get started
            </a>
          </div>
        </nav>
      </header>

      {/* SECTION 1 — COMPANY */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-green-400 font-medium mb-4">
            <FaUsers /> We are a company
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
            Know where your fleet is, without chasing it.
          </h1>
          <p className="text-gray-600 mb-6">
            DETOUR gives vehicle-owning businesses one place to see every
            truck, van, or car in real time. Register your company, add your
            vehicles, and start tracking — no hardware headaches, no
            spreadsheets, no guessing where a vehicle went.
          </p>
          <a
            href="/register"
            className="inline-block px-5 py-2.5 rounded-md font-medium text-white bg-orange-500 hover:bg-orange-600"
          >
            Register your company
          </a>
        </div>

        <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
            <img src="viarami-fleet-5153286_1920.jpg" alt="Company Dashboard" className="w-full h-full object-cover" />
        </div>
      </section>

      {/* SECTION 2 — ADMIN / COMPANY ASSISTANT */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div className="order-2 md:order-1 w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
          <img src="/as_photography-digital-marketing-1725340_1920.jpg" alt="Admin Dashboard" className="w-full h-full object-cover" />
        </div>

        <div className="order-1 md:order-2">
          <span className="inline-flex items-center gap-2 text-green-400 font-medium mb-4">
            <FaUserTie /> I am a company admin
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
            Run the fleet from one screen.
          </h2>
          <p className="text-gray-600">
            Add vehicles, assign drivers, and watch every trip unfold live on
            the map. When something needs your attention — a vehicle idling
            too long, or straying off route — you'll know before it becomes
            a problem, not after.
          </p>
        </div>
      </section>

      {/* SECTION 3 — DRIVER */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-green-400 font-medium mb-4">
            <FaTruck /> I am a driver
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
            Your trips, your record, in your pocket.
          </h2>
          <p className="text-gray-600">
            Soon, the DETOUR mobile app will let you check in on your
            assigned vehicle, log trips as you drive, and send an SOS alert
            the moment something goes wrong. Built for the road, not a desk.
          </p>
        </div>

        <div className="w-full aspect-video bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
          <img src="/noelsch-audi-a3-2095801_1920.jpg" alt="Driver Dashboard" className="w-full h-full object-cover" />
        </div>
      </section>

      {/* POWERED BY / PARTNERSHIP */}
      <section className="border-t border-gray-200 py-12">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-500 mb-1">Powered by Figbloom</p>
          <p className="text-sm text-gray-500">In partnership with Movec Systems</p>
        </div>
      </section>
    </div>
  );
}