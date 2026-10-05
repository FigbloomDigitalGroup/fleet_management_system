import mongoose from "mongoose";

// One row per real payment attempt against Paystack — the ledger that makes
// billing auditable. Company.subscriptionPlan only ever changes as a result
// of a row here reaching "success" (via the webhook or the verify
// endpoint), never from a direct client request.
const transactionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    plan: { type: String, enum: ["basic", "pro"], required: true },
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true }, // in the currency's base unit (KES), not subunits
    currency: { type: String, default: "KES" },
    status: { type: String, enum: ["pending", "success", "failed", "abandoned"], default: "pending" },
    channel: { type: String, default: null }, // "card" | "mobile_money", known once Paystack reports it
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

transactionSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.model("Transaction", transactionSchema);
