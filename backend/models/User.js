import mongoose from "mongoose";

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
  },
  { timestamps: true }
);

// Speeds up queries that filter users by company (tenant scoping)
userSchema.index({ companyId: 1 });

export default mongoose.model("User", userSchema);






