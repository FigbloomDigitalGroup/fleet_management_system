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
        "sos",
        "harsh_braking",
        "harsh_acceleration",
        "excessive_idling",
        "admin_message",
        "harsh_cornering",
        "phone_use",
        "mock_location",
        "location_disabled",
        "low_battery",
        "tracking_stopped",
        "app_logout",
        "inspection_failed",
        "job_failed",
        "phone_left_vehicle",
        "wrong_vehicle",
      ],
      required: true,
    },
    message: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    // Set when the driver deletes it in the app — hidden from their phone
    // only; it stays on the dashboard until resolved.
    hiddenForDriverAt: { type: Date, default: null },
    // Set when the alert is resolved; the TTL index below deletes it from
    // the database 30 minutes later. Open alerts have no resolvedAt, so
    // they're never expired.
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

alertSchema.index({ companyId: 1, resolved: 1 });
alertSchema.index({ resolvedAt: 1 }, { expireAfterSeconds: 30 * 60 });

export default mongoose.model("Alert", alertSchema);