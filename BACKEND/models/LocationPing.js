import mongoose from "mongoose";

const locationPingSchema = new mongoose.Schema({
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  speedKph: { type: Number },
  heading: { type: Number },
  recordedAt: { type: Date, default: Date.now },
});

// Speeds up "get latest location" and "get history between dates" queries
locationPingSchema.index({ vehicleId: 1, recordedAt: -1 });

export default mongoose.model("LocationPing", locationPingSchema);