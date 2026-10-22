import mongoose from "mongoose";

// Two-way chat between a company's dispatch side (any ADMIN/COMPANY_OWNER)
// and one driver. Every message belongs to exactly one driver's thread.
const messageSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fromDriver: { type: Boolean, required: true },
    body: { type: String, required: true, maxlength: 2000 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ driverId: 1, createdAt: -1 });
messageSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
