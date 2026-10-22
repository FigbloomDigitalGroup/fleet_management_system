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
    // Set by the driver from the app (see tripController's /me/current).
    purpose: { type: String, enum: ["business", "private"], default: null },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    // "driver" when ended with the app's End trip button — such a trip is
    // never reopened by later movement (see trackingController processPing).
    endedBy: { type: String, enum: ["auto", "driver"], default: null },
  },
  { timestamps: true }
);

tripSchema.index({ vehicleId: 1, startTime: 1 });

export default mongoose.model("Trip", tripSchema);




