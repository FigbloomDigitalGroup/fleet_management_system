import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    plateNumber: { type: String, required: true },
    make: { type: String },
    model: { type: String },
    deviceId: { type: String, unique: true, sparse: true },
    status: { type: String, enum: ["active", "idle", "offline", "maintenance"], default: "offline" },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Overrides the company's default daily starting point (Company.dailyStartPoint)
    // for this specific vehicle — only meaningful when a company has more than
    // one geofence zone to choose from. Null means "use the company default".
    startGeofenceId: { type: mongoose.Schema.Types.ObjectId, ref: "Geofence", default: null },
    // Fuel monitoring — used to detect abnormal consumption
    fuelCapacityLiters: { type: Number, default: 60 },
    avgConsumptionLPer100Km: { type: Number, default: 12 }, // expected liters used per 100km, a reasonable default
  },
  { timestamps: true }
);

vehicleSchema.index({ companyId: 1, plateNumber: 1 }, { unique: true });

export default mongoose.model("Vehicle", vehicleSchema);