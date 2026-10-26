import mongoose from "mongoose";
import { uploadUrl } from "../lib/uploadUrl.js";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    role: {
      type: String,
      enum: ["PLATFORM_ADMIN", "COMPANY_OWNER", "ADMIN", "DRIVER"],
      required: true,
    },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    // Only meaningful for role ADMIN: "full" can change everything,
    // "dispatcher" runs jobs/routes/messages, "viewer" is read-only.
    // Enforced centrally in middleware/auth.js (enforceAdminAccess).
    adminAccess: { type: String, enum: ["full", "dispatcher", "viewer"], default: "full" },
    // Drivers must accept location tracking in the mobile app before it
    // shares their position (Kenya Data Protection Act — informed consent).
    trackingConsent: {
      acceptedAt: { type: Date, default: null },
      version: { type: String, default: null },
    },
    status: { type: String, default: "active" },
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    // Extended driver profile — filled in by the driver themselves from the
    // mobile app's "Complete profile" screen, viewed by ADMIN/COMPANY_OWNER
    // on the driver's detail page. Left null until the driver fills them in.
    phone: { type: String, default: null },
    dob: { type: String, default: null },
    nationalId: { type: String, default: null },
    address: { type: String, default: null },
    licenseNumber: { type: String, default: null },
    licenseExpiry: { type: String, default: null },
    emergencyName: { type: String, default: null },
    emergencyPhone: { type: String, default: null },

    // Profile picture (an Upload of kind "avatar"); exposed as avatarUrl.
    avatarUploadId: { type: mongoose.Schema.Types.ObjectId, ref: "Upload", default: null },
  },
  { timestamps: true, toJSON: { virtuals: true, id: false }, toObject: { virtuals: true, id: false } }
);

// Signed URL the dashboard and app can put straight into an <img>.
userSchema.virtual("avatarUrl").get(function () {
  return uploadUrl(this.avatarUploadId);
});

// Speeds up queries that filter users by company (tenant scoping)
userSchema.index({ companyId: 1 });

export default mongoose.model("User", userSchema);






