import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    type: {
      type: String,
      enum: [
        "speeding",
        "geofence_entry",
        "geofence_exit",
        "unauthorized_movement",
        "device_offline",
        "maintenance_due",
        "route_deviation",
        "fuel_anomaly",
        "ai_pattern_anomaly",
      ],
      required: true,
    },
    message: { type: String, required: true },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

alertSchema.index({ companyId: 1, resolved: 1 });

export default mongoose.model("Alert", alertSchema);