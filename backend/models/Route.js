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

    // How often this route repeats — shown to the driver in the mobile app
    // so they know whether to expect it today. "weekly" narrows it to
    // specific days via daysOfWeek (0=Sun..6=Sat); "daily" ignores daysOfWeek.
    frequency: { type: String, enum: ["daily", "weekly"], default: "daily" },
    daysOfWeek: { type: [Number], default: [] },

    // Whether the waypoints were drafted by the AI assistant (see
    // routeAssistant.js) or drawn by hand on the map — purely cosmetic
    // (which color the path renders in), no behavioral difference.
    source: { type: String, enum: ["manual", "ai"], default: "manual" },
  },
  { timestamps: true }
);

routeSchema.index({ vehicleId: 1 });

export default mongoose.model("Route", routeSchema);