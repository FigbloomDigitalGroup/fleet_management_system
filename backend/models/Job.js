import mongoose from "mongoose";

// A delivery/visit dispatched to one driver. `sequence` is the order the
// driver should do their open jobs in (set by hand or by /api/jobs/optimize).
// `trackingToken` backs the public customer ETA link (/track/:token) — no
// login, so it's a long random value rather than the job's id.
const proofSchema = new mongoose.Schema(
  {
    photoUploadIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Upload" }],
    signatureUploadId: { type: mongoose.Schema.Types.ObjectId, ref: "Upload", default: null },
    recipientName: { type: String, default: null },
    notes: { type: String, default: null },
    scannedCode: { type: String, default: null },
    latitude: { type: Number },
    longitude: { type: Number },
    capturedAt: { type: Date },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", default: null },
    title: { type: String, required: true },
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    contactName: { type: String, default: null },
    contactPhone: { type: String, default: null },
    notes: { type: String, default: null },
    scheduledDate: { type: String, required: true }, // YYYY-MM-DD
    windowStart: { type: Date, default: null },
    windowEnd: { type: Date, default: null },
    sequence: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["assigned", "started", "arrived", "completed", "failed", "cancelled"],
      default: "assigned",
    },
    failureReason: { type: String, default: null },
    startedAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    proof: { type: proofSchema, default: null },
    trackingToken: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

jobSchema.index({ companyId: 1, scheduledDate: 1 });
jobSchema.index({ driverId: 1, status: 1, sequence: 1 });

export default mongoose.model("Job", jobSchema);
