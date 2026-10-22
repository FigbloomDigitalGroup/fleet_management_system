"use client";

import { FiX } from "react-icons/fi";
import { API_URL } from "../lib/api";
import { JOB_STATUS_LABELS, JOB_STATUS_STYLES, formatWindow } from "../lib/jobStatus";
import { formatDateTime } from "../lib/dateKeys";
import { JobRecord } from "../types/auth";

function TimelineRow({ label, at, tone = "teal" }: { label: string; at: string | null; tone?: "teal" | "red" | "gray" }) {
  const dot = !at ? "bg-gray-200" : tone === "red" ? "bg-red-500" : tone === "gray" ? "bg-gray-400" : "bg-teal-600";
  return (
    <li className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <span className={`flex-1 text-sm ${at ? "text-gray-900" : "text-gray-400"}`}>{label}</span>
      <span className="text-xs text-gray-500">{at ? formatDateTime(at) : "—"}</span>
    </li>
  );
}

// Side drawer with everything about one job — how it progressed and what
// the driver captured as proof of delivery.
export default function JobDetailModal({ job, onClose }: { job: JobRecord; onClose: () => void }) {
  const proof = job.proof;

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-blue-950">{job.title}</h2>
            <p className="mt-0.5 text-xs text-teal-600">{job.address}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <FiX size={18} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${JOB_STATUS_STYLES[job.status]}`}>
            {JOB_STATUS_LABELS[job.status]}
          </span>
          {job.late && (
            <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
              Late
            </span>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">Driver</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{job.driverId?.fullName ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Vehicle</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{job.vehicleId?.plateNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Date</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{job.scheduledDate}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Time window</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{formatWindow(job.windowStart, job.windowEnd)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Contact</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              {job.contactName || job.contactPhone ? [job.contactName, job.contactPhone].filter(Boolean).join(" · ") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Stop #</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{job.sequence}</dd>
          </div>
        </dl>
        {job.notes && <p className="mt-3 rounded bg-gray-50 p-3 text-xs text-gray-600">{job.notes}</p>}

        <h3 className="mt-6 text-sm font-medium text-gray-700">Timeline</h3>
        <ul className="mt-3 space-y-2.5">
          <TimelineRow label="Created" at={job.createdAt} tone="gray" />
          <TimelineRow label="Driver started" at={job.startedAt} />
          <TimelineRow label="Arrived" at={job.arrivedAt} />
          {job.status === "failed" ? (
            <TimelineRow label="Failed" at={job.failedAt} tone="red" />
          ) : (
            <TimelineRow label="Completed" at={job.completedAt} />
          )}
        </ul>

        {job.failureReason && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-medium text-red-600">Why it failed</p>
            <p className="mt-0.5 text-sm text-red-700">{job.failureReason}</p>
          </div>
        )}

        <h3 className="mt-6 text-sm font-medium text-gray-700">Proof of delivery</h3>
        {!proof ? (
          <p className="mt-2 text-sm text-gray-400">Nothing captured yet — shows up once the driver completes the job.</p>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-gray-500">Received by</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{proof.recipientName || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Captured</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{formatDateTime(proof.capturedAt)}</dd>
              </div>
              {proof.scannedCode && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Scanned code</dt>
                  <dd className="mt-0.5 font-mono text-xs text-gray-900">{proof.scannedCode}</dd>
                </div>
              )}
            </dl>
            {proof.notes && <p className="rounded bg-gray-50 p-3 text-xs text-gray-600">{proof.notes}</p>}
            {proof.photoUrls.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-gray-500">Photos</p>
                <div className="grid grid-cols-3 gap-2">
                  {proof.photoUrls.map((url) => (
                    <a key={url} href={API_URL + url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={API_URL + url} alt="Delivery photo" className="h-24 w-full rounded object-cover ring-1 ring-black/5" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {proof.signatureUrl && (
              <div>
                <p className="mb-1.5 text-xs text-gray-500">Signature</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={API_URL + proof.signatureUrl}
                  alt="Recipient signature"
                  className="h-28 w-full rounded bg-white object-contain ring-1 ring-black/10"
                />
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
