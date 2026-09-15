import mongoose from "mongoose";

const locationPingSchema = new mongoose.Schema({
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  speedKph: { type: Number },
  heading: { type: Number },
  fuelLevelLiters: { type: Number, default: null }, // null = no fuel sensor data available
  recordedAt: { type: Date, default: Date.now },
});

locationPingSchema.index({ vehicleId: 1, recordedAt: -1 });

export default mongoose.model("LocationPing", locationPingSchema);