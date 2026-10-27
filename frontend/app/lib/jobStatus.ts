import { JobStatus } from "../types/auth";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  assigned: "Assigned",
  started: "On the way",
  arrived: "Arrived",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const JOB_STATUS_STYLES: Record<JobStatus, string> = {
  assigned: "bg-blue-50 text-blue-700 border-blue-200",
  started: "bg-teal-50 text-teal-600 border-teal-200",
  arrived: "bg-teal-100 text-teal-700 border-teal-300",
  completed: "bg-teal-600 text-white border-teal-600",
  failed: "bg-red-50 text-red-600 border-red-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

export const OPEN_JOB_STATUSES: JobStatus[] = ["assigned", "started", "arrived"];

// Time windows are entered and shown in Nairobi time (where the jobs are
// scheduled), whatever timezone the dispatcher's browser happens to be in.
// Nairobi is UTC+3 all year (no DST), so a fixed offset is safe.
export function windowToIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  return `${date}T${time}:00+03:00`;
}

export function isoToNairobiTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-GB", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatWindow(start: string | null, end: string | null): string {
  if (!start && !end) return "Any time";
  if (start && end) return `${isoToNairobiTime(start)}–${isoToNairobiTime(end)}`;
  return start ? `From ${isoToNairobiTime(start)}` : `By ${isoToNairobiTime(end)}`;
}
