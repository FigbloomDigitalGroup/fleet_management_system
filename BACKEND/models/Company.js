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
  },
  { timestamps: true } // automatically adds createdAt and updatedAt
);

export default mongoose.model("Company", companySchema);