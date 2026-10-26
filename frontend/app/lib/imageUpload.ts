import { apiRequest } from "./api";

const MAX_SIDE = 512;

// Shrinks a picked photo to at most 512 px on its longest side and re-encodes
// it as JPEG, so profile pictures and logos stay well under the server's
// 2 MB image limit no matter what the user picks.
async function toSmallJpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't read that image");
  // White behind transparent PNG logos, which JPEG can't keep.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

// Uploads a picked image and returns its id, ready to attach as a profile
// picture ("avatar") or company logo ("logo").
export async function uploadImage(file: File, kind: "avatar" | "logo"): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  const dataBase64 = await toSmallJpeg(file);
  const upload = await apiRequest<{ id: string }>("/api/uploads", {
    method: "POST",
    body: JSON.stringify({ kind, contentType: "image/jpeg", dataBase64 }),
  });
  return upload.id;
}
