import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    startLat: { type: Number },
    startLng: { type: Number },
    endLat: { type: Number },
    endLng: { type: Number },
    distanceKm: { type: Number },
  },
  { timestamps: true }
);

tripSchema.index({ vehicleId: 1, startTime: 1 });

export default mongoose.model("Trip", tripSchema);




