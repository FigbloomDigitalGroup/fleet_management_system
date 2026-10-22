import crypto from "crypto";
import mongoose from "mongoose";
import Upload from "../models/Upload.js";

const MAX_BYTES = 2 * 1024 * 1024;
const KINDS = ["inspection", "receipt", "pod_photo", "signature"];
const CONTENT_TYPES = ["image/jpeg", "image/png"];

// Images are shown in plain <img> tags on the web dashboard, which can't
// send the Bearer token — so each one is served from an unguessable signed
// URL instead of an authenticated endpoint.
function signatureFor(id) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update(String(id)).digest("hex").slice(0, 32);
}

export function uploadUrl(id) {
  if (!id) return null;
  return `/api/uploads/${id}/raw?sig=${signatureFor(id)}`;
}

// DRIVER (or admin) — store one image sent as base64 JSON
// ({ kind, contentType, dataBase64 }). The phone compresses before sending.
export async function createUpload(req, res) {
  try {
    const { kind, contentType, dataBase64 } = req.body;
    if (!KINDS.includes(kind)) return res.status(400).json({ error: `kind must be one of: ${KINDS.join(", ")}` });
    if (!CONTENT_TYPES.includes(contentType)) return res.status(400).json({ error: "Only JPEG or PNG images are supported" });
    if (typeof dataBase64 !== "string" || !dataBase64) return res.status(400).json({ error: "dataBase64 is required" });

    const data = Buffer.from(dataBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (!data.length) return res.status(400).json({ error: "The image is empty" });
    if (data.length > MAX_BYTES) return res.status(413).json({ error: "Image is too large (max 2 MB)" });

    const upload = await Upload.create({
      companyId: req.user.companyId,
      uploadedBy: req.user.id,
      kind,
      contentType,
      sizeBytes: data.length,
      data,
    });
    return res.status(201).json({ id: upload._id, url: uploadUrl(upload._id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save image" });
  }
}

// Public but signed — see signatureFor
export async function serveUpload(req, res) {
  try {
    const { id } = req.params;
    const expected = signatureFor(id);
    const given = String(req.query.sig || "");
    if (
      !mongoose.isValidObjectId(id) ||
      given.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    ) {
      return res.status(404).json({ error: "Image not found" });
    }
    const upload = await Upload.findById(id).select("+data contentType");
    if (!upload) return res.status(404).json({ error: "Image not found" });

    // helmet defaults to same-origin, which would block the dashboard
    // (a different origin) from displaying the image.
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.set("Cache-Control", "private, max-age=86400");
    res.type(upload.contentType).send(upload.data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load image" });
  }
}

// Confirms every given upload id belongs to the requester's company, so a
// driver can't attach someone else's image by guessing an id.
export async function ownedUploadIds(ids, companyId) {
  const clean = (ids || []).filter((id) => mongoose.isValidObjectId(id));
  if (!clean.length) return [];
  const found = await Upload.find({ _id: { $in: clean }, companyId }).select("_id");
  return found.map((u) => u._id);
}
