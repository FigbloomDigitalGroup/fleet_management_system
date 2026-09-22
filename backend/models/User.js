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
  },
  { timestamps: true }
);

// Speeds up queries that filter users by company (tenant scoping)
userSchema.index({ companyId: 1 });

export default mongoose.model("User", userSchema);






