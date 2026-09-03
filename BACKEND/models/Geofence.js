import mongoose from "mongoose";

const geofenceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["circle", "polygon"], required: true },
    centerLat: { type: Number }, // used when type = circle
    centerLng: { type: Number },
    radiusM: { type: Number }, // meters, used when type = circle
    polygon: [{ lat: Number, lng: Number }], // used when type = polygon
  },
  { timestamps: true }
);

geofenceSchema.index({ companyId: 1 });

export default mongoose.model("Geofence", geofenceSchema);