import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    plateNumber: { type: String, required: true },
    make: { type: String },
    model: { type: String },
    deviceId: { type: String, unique: true, sparse: true },
    // Secret credential a hardware GPS tracker presents (x-tracker-token header)
    // to authenticate pings for this vehicle without a user login — see
    // authenticateTracking in middleware/auth.js. Excluded from queries by
    // default; only pulled in explicitly when verifying a ping.
    trackerToken: { type: String, select: false, index: true, sparse: true },
    // One shared list covering every industry this platform serves (logistics,
    // school/public transport, construction, security, agriculture, oil & gas,
    // rental, etc.) — every company picks from the same list regardless of
    // their industry, rather than a per-industry restricted subset.
    vehicleType: {
      type: String,
      enum: [
        "car",
        "van",
        "truck",
        "bus",
        "motorcycle",
        "tractor",
        "excavator",
        "crane",
        "dump_truck",
        "tanker",
        "armored_vehicle",
        "trailer",
      ],
      default: "car",
    },
    status: { type: String, enum: ["active", "idle", "offline", "maintenance"], default: "offline" },
    // When an admin manually sets status, it sticks (pings stop recomputing it)
    // until the vehicle is next seen moving — at which point tracking pings
    // resume automatic active/idle/offline control.
    statusManuallySet: { type: Boolean, default: false },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Overrides the company's default daily starting point (Company.dailyStartPoint)
    // for this specific vehicle — only meaningful when a company has more than
    // one geofence zone to choose from. Null means "use the company default".
    startGeofenceId: { type: mongoose.Schema.Types.ObjectId, ref: "Geofence", default: null },
    // Fuel monitoring — used to detect abnormal consumption
    fuelCapacityLiters: { type: Number, default: 60 },
    avgConsumptionLPer100Km: { type: Number, default: 12 }, // expected liters used per 100km, a reasonable default
    // Odometer reading when the vehicle was onboarded (or last corrected);
    // current odometer = this + all recorded trip distance. Drives
    // mileage-based maintenance reminders.
    odometerBaseKm: { type: Number, default: 0, min: 0 },
    // Last state the driver's phone reported (POST /api/tracking/device-status)
    // — battery, whether location is on, app in foreground/background.
    device: {
      lastSeenAt: { type: Date, default: null },
      batteryLevel: { type: Number, default: null }, // 0..1
      isCharging: { type: Boolean, default: null },
      locationEnabled: { type: Boolean, default: null },
      permission: { type: String, default: null }, // "background" | "foreground" | "denied"
      appState: { type: String, default: null }, // "active" | "background"
      isSharing: { type: Boolean, default: null },
      platform: { type: String, default: null },
      appVersion: { type: String, default: null },
      offlineAlertedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

vehicleSchema.index({ companyId: 1, plateNumber: 1 }, { unique: true });

export default mongoose.model("Vehicle", vehicleSchema);







