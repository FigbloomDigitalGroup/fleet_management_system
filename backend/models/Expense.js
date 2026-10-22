import mongoose from "mongoose";

// A real, driver-logged cost against a vehicle — fuel purchases and other
// on-the-road spend (tolls, parking, repairs). Distinct from Company's
// estimatedExpenses (a projection from plan price), this is actual money
// drivers report spending, visible to ADMIN/COMPANY_OWNER on the web.
const expenseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    category: { type: String, enum: ["fuel", "toll", "parking", "repair", "other"], required: true },
    amount: { type: Number, required: true, min: 0 }, // KES
    note: { type: String, default: null },
    incurredAt: { type: Date, default: Date.now },
    receiptUploadId: { type: mongoose.Schema.Types.ObjectId, ref: "Upload", default: null },
  },
  { timestamps: true }
);

expenseSchema.index({ companyId: 1, incurredAt: -1 });
expenseSchema.index({ vehicleId: 1, incurredAt: -1 });

export default mongoose.model("Expense", expenseSchema);
