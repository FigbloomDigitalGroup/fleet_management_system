import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { signatureFor, uploadUrl } from "../lib/uploadUrl.js";

export { uploadUrl };

const MAX_BYTES = 2 * 1024 * 1024;
const KINDS = ["inspection", "receipt", "pod_photo", "signature", "avatar", "logo"];
const CONTENT_TYPES = ["image/jpeg", "image/png"];


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

    const upload = await prisma.upload.create({
      data: {
        companyId: req.user.companyId,
        uploadedById: req.user.id,
        kind,
        contentType,
        sizeBytes: data.length,
        data,
      },
      select: { id: true },
    });
    return res.status(201).json({ id: upload.id, url: uploadUrl(upload.id) });
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
      given.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    ) {
      return res.status(404).json({ error: "Image not found" });
    }
    const upload = await prisma.upload.findUnique({ where: { id }, select: { data: true, contentType: true } });
    if (!upload) return res.status(404).json({ error: "Image not found" });

    // helmet defaults to same-origin, which would block the dashboard
    // (a different origin) from displaying the image.
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.set("Cache-Control", "private, max-age=86400");
    res.type(upload.contentType).send(Buffer.from(upload.data));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load image" });
  }
}

// Confirms every given upload id belongs to the requester's company, so a
// driver can't attach someone else's image by guessing an id.
export async function ownedUploadIds(ids, companyId) {
  const clean = (ids || []).filter((id) => typeof id === "string" && id);
  if (!clean.length) return [];
  const found = await prisma.upload.findMany({ where: { id: { in: clean }, companyId: String(companyId) }, select: { id: true } });
  // Keep the caller's order (e.g. proof-of-delivery photos).
  const owned = new Set(found.map((u) => u.id));
  return clean.filter((id) => owned.has(id));
}

// Points a profile picture / logo field (`model` is "user" or "company",
// `field` avatarUploadId / logoUploadId) at a freshly uploaded image, or
// clears it with null, removing the image it replaces. The upload must be
// the right kind and belong to the same company, so nobody can borrow
// another company's image by id. Returns { error } or { url }.
export async function setImageField(model, id, field, uploadId, { companyId, kind }) {
  let next = null;
  if (uploadId !== null) {
    if (typeof uploadId !== "string" || !uploadId) return { error: "uploadId must be a valid id or null" };
    const upload = await prisma.upload.findFirst({ where: { id: uploadId, companyId: String(companyId), kind }, select: { id: true } });
    if (!upload) return { error: "Image not found — upload it first" };
    next = upload.id;
  }
  const current = await prisma[model].findUnique({ where: { id }, select: { [field]: true } });
  const previous = current?.[field];
  await prisma[model].update({ where: { id }, data: { [field]: next } });
  if (previous && previous !== next) await prisma.upload.deleteMany({ where: { id: previous } });
  return { url: uploadUrl(next) };
}
