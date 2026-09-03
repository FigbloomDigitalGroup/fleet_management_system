import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    plateNumber: { type: String, required: true },
    make: { type: String },
    model: { type: String },
    deviceId: { type: String, unique: true, sparse: true }, // GPS hardware tracker ID
    status: {
      type: String,
      enum: ["active", "idle", "offline", "maintenance"],
      default: "offline",
    },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// A company can't have two vehicles with the same plate number
vehicleSchema.index({ companyId: 1, plateNumber: 1 }, { unique: true });

export default mongoose.model("Vehicle", vehicleSchema);