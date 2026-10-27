import mongoose from "mongoose";

const locationPingSchema = new mongoose.Schema({
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  speedKph: { type: Number },
  heading: { type: Number },
  fuelLevelLiters: { type: Number, default: null }, // null = no fuel sensor data available
  accuracyM: { type: Number, default: null }, // GPS-reported accuracy radius, meters
  isMocked: { type: Boolean, default: false }, // phone reported a mock-location provider
  source: { type: String, enum: ["device", "driver_app", "manual"], default: "manual" },
  // When the fix was taken — sent by the phone (so buffered offline points
  // keep their real time), otherwise when the server received it.
  recordedAt: { type: Date, default: Date.now },
});

locationPingSchema.index({ vehicleId: 1, recordedAt: -1 });

export default mongoose.model("LocationPing", locationPingSchema);