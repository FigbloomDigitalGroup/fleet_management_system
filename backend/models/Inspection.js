import mongoose from "mongoose";

// A driver's pre-trip vehicle check. `passed` is false if any item failed.
const itemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    ok: { type: Boolean, required: true },
    note: { type: String, default: null },
    photoUploadId: { type: mongoose.Schema.Types.ObjectId, ref: "Upload", default: null },
  },
  { _id: false }
);

const inspectionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [itemSchema], default: [] },
    passed: { type: Boolean, required: true },
    odometerKm: { type: Number, default: null },
    notes: { type: String, default: null },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { timestamps: true }
);

inspectionSchema.index({ companyId: 1, createdAt: -1 });
inspectionSchema.index({ vehicleId: 1, createdAt: -1 });

export default mongoose.model("Inspection", inspectionSchema);
