import mongoose from "mongoose";

const routeSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    name: { type: String, required: true },
    waypoints: [{ lat: Number, lng: Number }], // the planned path, in order
    toleranceMeters: { type: Number, default: 300 }, // how far off-path counts as a deviation
    speedLimitKph: { type: Number, default: null }, // optional route-specific speed limit, overrides company default
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

routeSchema.index({ vehicleId: 1 });

export default mongoose.model("Route", routeSchema);