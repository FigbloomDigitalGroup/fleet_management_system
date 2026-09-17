import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["active", "suspended", "pending"],
      default: "pending",
    },
    subscriptionPlan: { type: String, default: "trial" },
    // Where drivers should start their day — must fall inside one of the
    // company's geofence zones (enforced in companyController.updateStartPoint).
    dailyStartPoint: {
      lat: { type: Number },
      lng: { type: Number },
      geofenceId: { type: mongoose.Schema.Types.ObjectId, ref: "Geofence" },
      updatedAt: { type: Date },
    },
  },
  { timestamps: true } // automatically adds createdAt and updatedAt
);

export default mongoose.model("Company", companySchema);