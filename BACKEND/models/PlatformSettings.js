import mongoose from "mongoose";

// This is a singleton — only ever one document exists
const platformSettingsSchema = new mongoose.Schema(
  {
    requireManualApproval: { type: Boolean, default: true },
    defaultPlan: { type: String, enum: ["trial", "basic", "pro", "enterprise"], default: "trial" },
    trialDays: { type: Number, default: 14 },
    vehicleLimits: {
      trial: { type: Number, default: 3 },
      basic: { type: Number, default: 15 },
      pro: { type: Number, default: 50 },
      enterprise: { type: Number, default: 999 },
    },
    supportEmail: { type: String, default: "support@getour.com" },
  },
  { timestamps: true }
);

export default mongoose.model("PlatformSettings", platformSettingsSchema);