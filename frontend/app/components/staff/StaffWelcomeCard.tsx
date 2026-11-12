"use client";

import { useState } from "react";
import Link from "next/link";
import { FiBriefcase, FiExternalLink, FiEye, FiHelpCircle, FiPlus, FiX } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { FIGBLOOM_CONSOLE_URL } from "../NoCompaniesYet";

const storageKey = (userId: string) => `fleet:staffWelcomeHidden:${userId}`;

function readHidden(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

// The first thing on the staff home: what this account is and how to get
// into a fleet. Each staff member can hide it; a small link brings it back.
export default function StaffWelcomeCard({ onCreateFleet }: { onCreateFleet: () => void }) {
  const { user } = useAuth();
  const key = user ? storageKey(user.id) : null;
  const [hidden, setHidden] = useState(() => (key ? readHidden(key) : false));

  function setStored(next: boolean) {
    setHidden(next);
    if (!key) return;
    try {
      if (next) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
    } catch {
      // private mode: it just shows again next time
    }
  }

  if (hidden) {
    return (
      <div className="mb-4 flex justify-end">
        <button onClick={() => setStored(false)} className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline">
          <FiHelpCircle size={12} /> What is this staff account for?
        </button>
      </div>
    );
  }

  const button = "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors";
  return (
    <section className="relative mb-6 rounded-lg border-l-4 border-amber-400 bg-white p-5 shadow-sm ring-1 ring-black/5">
      <button
        onClick={() => setStored(true)}
        aria-label="Hide this guide"
        title="Hide this guide"
        className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <FiX size={16} />
      </button>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Figbloom staff account</p>
      <h2 className="mt-1 pr-8 text-base font-semibold text-gray-900">This is the Figbloom staff view.</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">
        You see every customer fleet here; vehicles, drivers and the live map live inside each fleet. Open a fleet to look at
        it the way its owner does (read-only, and your visit is recorded), or create one when you set up a new client.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/platform/companies" className={`${button} bg-blue-950 text-white hover:bg-blue-900`}>
          <FiEye size={14} /> Open a fleet
        </Link>
        <button onClick={onCreateFleet} className={`${button} bg-orange-500 text-white hover:bg-orange-600`}>
          <FiPlus size={14} /> Create a fleet
        </button>
        <a
          href={FIGBLOOM_CONSOLE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${button} border border-gray-300 text-gray-700 hover:bg-gray-50`}
        >
          <FiBriefcase size={14} /> Fleet approvals happen in the Figbloom console <FiExternalLink size={12} />
        </a>
        <Link href="/help#figbloom" className={`${button} border border-gray-300 text-gray-700 hover:bg-gray-50`}>
          <FiHelpCircle size={14} /> Help
        </Link>
      </div>
    </section>
  );
}
