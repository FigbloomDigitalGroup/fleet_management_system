import { apiRequest } from "./api";

type UploadKind = "avatar" | "logo" | "receipt";

// Longest side in px: small for pictures and logos, bigger for a receipt so
// its figures stay readable.
const MAX_SIDE: Record<UploadKind, number> = { avatar: 512, logo: 512, receipt: 1600 };

// Shrinks a picked photo (to at most 512 px on its longest side, 1600 for a
// receipt) and re-encodes it as JPEG, so it stays well under the server's
// 2 MB image limit no matter what the user picks.
async function toSmallJpeg(file: File, maxSide: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
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
// picture ("avatar"), company logo ("logo") or an expense's receipt.
export async function uploadImage(file: File, kind: UploadKind): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  const dataBase64 = await toSmallJpeg(file, MAX_SIDE[kind]);
  const upload = await apiRequest<{ id: string }>("/api/uploads", {
    method: "POST",
    body: JSON.stringify({ kind, contentType: "image/jpeg", dataBase64 }),
  });
  return upload.id;
}
