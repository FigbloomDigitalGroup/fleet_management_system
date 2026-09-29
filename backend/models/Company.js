import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["active", "suspended", "pending"],
      default: "pending",
    },
    subscriptionPlan: { type: String, default: "trial" },
    // Selected checkout method — real charging isn't wired up yet, this just
    // records what the company picked during the upgrade flow.
    paymentMethod: { type: String, enum: ["mpesa", "paystack", null], default: null },
    // Self-reported — there's no invoicing/earnings data anywhere else in the
    // system to derive this from, so the company owner enters and updates it
    // themselves from the Billing page.
    totalRevenue: { type: Number, default: 0, min: 0 },
    // Where drivers should start their day — must fall inside one of the
    // company's geofence zones (enforced in companyController.updateStartPoint).
    dailyStartPoint: {
      lat: { type: Number },
      lng: { type: Number },
      geofenceId: { type: mongoose.Schema.Types.ObjectId, ref: "Geofence" },
      updatedAt: { type: Date },
    },
  },
  { timestamps: true } // automatically adds createdAt and updatedAt
);

export default mongoose.model("Company", companySchema);