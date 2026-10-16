import mongoose from "mongoose";

// One row per day a vehicle reaches the final waypoint of its assigned
// Route. Routes are standing plans that recur daily/weekly rather than
// one-off assignments, so "completed" can't live as a single flag on the
// Route document itself — it has to be tracked per calendar day instead.
const routeCompletionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Server-local calendar day the route was completed on, "YYYY-MM-DD".
    dateKey: { type: String, required: true },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

routeCompletionSchema.index({ routeId: 1, dateKey: 1 });
routeCompletionSchema.index({ vehicleId: 1, dateKey: 1 });

export default mongoose.model("RouteCompletion", routeCompletionSchema);
