import mongoose from "mongoose";

// Small images (inspection photos, expense receipts, proof-of-delivery
// photos and signatures, profile pictures and company logos) stored straight in MongoDB — the app has no file
// storage service, and the phone compresses them well under the 16MB
// document limit (capped at 2MB in uploadController).
const uploadSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["inspection", "receipt", "pod_photo", "signature", "avatar", "logo"], required: true },
    contentType: { type: String, enum: ["image/jpeg", "image/png"], required: true },
    sizeBytes: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: true }
);

export default mongoose.model("Upload", uploadSchema);
