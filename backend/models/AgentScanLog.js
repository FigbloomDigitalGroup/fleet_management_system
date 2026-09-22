import mongoose from "mongoose";

// One entry per vehicle checked in a scan run — kept even when no anomaly was
// found, so the Agent Overview page can show "checked, nothing unusual" too,
// not just positive hits.
const scanDetailSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    plateNumber: { type: String },
    anomaly: { type: Boolean, default: false },
    reason: { type: String, default: "" },
  },
  { _id: false }
);

const agentScanLogSchema = new mongoose.Schema({
  runAt: { type: Date, default: Date.now },
  vehiclesScanned: { type: Number, default: 0 },
  anomaliesFound: { type: Number, default: 0 },
  status: { type: String, enum: ["success", "failed"], default: "success" },
  errorMessage: { type: String, default: null },
  details: [scanDetailSchema],
});

agentScanLogSchema.index({ runAt: -1 });

export default mongoose.model("AgentScanLog", agentScanLogSchema);
