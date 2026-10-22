import mongoose from "mongoose";

// Either a completed service ("record") or an upcoming one ("reminder").
// A reminder is due by date, by odometer, or whichever comes first; the
// hourly sweep raises one maintenance_due alert per reminder (alertedAt).
const maintenanceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    kind: { type: String, enum: ["record", "reminder"], required: true },
    title: { type: String, required: true },
    notes: { type: String, default: null },
    // record fields
    performedAt: { type: Date, default: null },
    odometerKm: { type: Number, default: null },
    costKes: { type: Number, default: null, min: 0 },
    // reminder fields
    dueDate: { type: Date, default: null },
    dueOdometerKm: { type: Number, default: null },
    intervalDays: { type: Number, default: null },
    intervalKm: { type: Number, default: null },
    status: { type: String, enum: ["open", "done"], default: "open" },
    alertedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

maintenanceSchema.index({ vehicleId: 1, kind: 1, status: 1 });

export default mongoose.model("MaintenanceRecord", maintenanceSchema);
