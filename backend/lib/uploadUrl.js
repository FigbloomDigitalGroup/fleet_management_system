import crypto from "crypto";

// Images are shown in plain <img> tags on the web dashboard, which can't
// send the Bearer token — so each one is served from an unguessable signed
// URL instead of an authenticated endpoint (see uploadController.serveUpload).
export function signatureFor(id) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update(String(id)).digest("hex").slice(0, 32);
}

export function uploadUrl(id) {
  if (!id) return null;
  return `/api/uploads/${id}/raw?sig=${signatureFor(id)}`;
}
