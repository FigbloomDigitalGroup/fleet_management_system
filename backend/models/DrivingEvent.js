import mongoose from "mongoose";

// One unsafe-driving incident, tied to the driver who had the vehicle at the
// time — the source of truth for driver scores. Comes either from the server
// (GPS speed deltas, speeding) or from the phone's motion sensors / screen use.
const drivingEventSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    type: {
      type: String,
      enum: ["speeding", "harsh_braking", "harsh_acceleration", "harsh_cornering", "phone_use"],
      required: true,
    },
    source: { type: String, enum: ["gps", "sensor", "app"], required: true },
    value: { type: Number, default: null }, // km/h, g-force, or seconds of phone use
    speedKph: { type: Number, default: null },
    latitude: { type: Number },
    longitude: { type: Number },
    recordedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

drivingEventSchema.index({ driverId: 1, recordedAt: -1 });
drivingEventSchema.index({ companyId: 1, recordedAt: -1 });

export default mongoose.model("DrivingEvent", drivingEventSchema);
