import { uploadUrl } from "./uploadUrl.js";

// Turns Prisma rows into the exact JSON shape the Mongoose version returned,
// so the web dashboard and the driver app don't change:
// - `id` → `_id` (and `id` too, which the Mongoose virtuals also sent)
// - an included relation goes back under its foreign-key name, the way
//   .populate() replaced it (`vehicle` → `vehicleId: {...}`)
// - createdById/uploadedById keep their Mongo names (createdBy/uploadedBy)
// - the old virtuals (avatarUrl, logoUrl) and the nested trackingConsent
// - secrets and raw image bytes are never sent

const RELATION_FIELD = {
  company: "companyId",
  user: "userId",
  vehicle: "vehicleId",
  driver: "driverId",
  sender: "senderId",
  route: "routeId",
  startGeofence: "startGeofenceId",
  createdBy: "createdBy",
  uploadedBy: "uploadedBy",
};
const RENAMED = { createdById: "createdBy", uploadedById: "uploadedBy" };
const HIDDEN = new Set(["passwordHash", "resetPasswordTokenHash", "resetPasswordExpires", "trackerToken", "data"]);

function isRow(value) {
  return value !== null && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value);
}

export function toApi(value) {
  if (Array.isArray(value)) return value.map(toApi);
  if (!isRow(value) || !("id" in value)) return value;

  const out = {};
  const relations = {};
  for (const [key, val] of Object.entries(value)) {
    if (HIDDEN.has(key)) continue;
    if (key === "id") out._id = out.id = val;
    else if (key in RELATION_FIELD && (isRow(val) || val === null)) relations[key] = val;
    else if (key === "consentAcceptedAt" || key === "consentVersion") continue;
    else out[RENAMED[key] ?? key] = isRow(val) && "id" in val ? toApi(val) : Array.isArray(val) ? val.map(toApi) : val;
  }

  // Populated relations replace the plain id, as .populate() did (null stays null).
  for (const [key, val] of Object.entries(relations)) out[RELATION_FIELD[key]] = val ? toApi(val) : null;

  if ("consentAcceptedAt" in value || "consentVersion" in value) {
    out.trackingConsent = { acceptedAt: value.consentAcceptedAt ?? null, version: value.consentVersion ?? null };
  }
  if ("avatarUploadId" in value) out.avatarUrl = uploadUrl(value.avatarUploadId);
  if ("logoUploadId" in value) out.logoUrl = uploadUrl(value.logoUploadId);
  return out;
}

// Prisma's "unique constraint failed" — Mongo's duplicate key error 11000.
export function isUniqueViolation(err) {
  return err?.code === "P2002";
}
