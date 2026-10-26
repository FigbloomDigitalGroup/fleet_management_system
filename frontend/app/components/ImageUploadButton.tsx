"use client";

import { useRef, useState } from "react";
import { apiRequest, errorMessage } from "../lib/api";
import { uploadImage } from "../lib/imageUpload";

// "Change photo" / "Remove" controls for a profile picture or logo. Uploads
// the picked image, then PATCHes `endpoint` with { uploadId } (or null to
// remove) and reports the new URL.
export default function ImageUploadButton({
  endpoint,
  kind,
  hasImage,
  onChange,
  label = "Change photo",
  tone = "light",
}: {
  endpoint: string;
  kind: "avatar" | "logo";
  hasImage: boolean;
  onChange: (url: string | null) => void;
  label?: string;
  // "dark" for use on the teal side menu: small text links instead of a button.
  tone?: "light" | "dark";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(uploadId: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{ avatarUrl?: string | null; logoUrl?: string | null }>(endpoint, {
        method: "PATCH",
        body: JSON.stringify({ uploadId }),
      });
      onChange(res.avatarUrl ?? res.logoUrl ?? null);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the image"));
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const id = await uploadImage(file, kind);
      await save(id);
    } catch (err) {
      setError(errorMessage(err, "Couldn't upload the image"));
      setBusy(false);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={
            tone === "dark"
              ? "text-[11px] text-teal-200 hover:text-white disabled:opacity-50"
              : "rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-teal-400 hover:text-teal-700 disabled:opacity-50"
          }
        >
          {busy ? "Saving…" : label}
        </button>
        {hasImage && !busy && (
          <button
            type="button"
            onClick={() => save(null)}
            className={tone === "dark" ? "text-[11px] text-teal-100/50 hover:text-red-300" : "text-xs text-gray-400 hover:text-red-600"}
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className={`mt-1 text-xs ${tone === "dark" ? "text-red-300" : "text-red-600"}`}>{error}</p>}
    </div>
  );
}
