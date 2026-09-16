const mongoose = require("mongoose");

const leadActivitySchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    lead_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    activity_type: {
      type: String,
      enum: ["call", "whatsapp", "email", "note", "status_change"],
      required: true,
    },
    notes: { type: String, trim: true, default: "" },
    performed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    follow_up_date: { type: Date, default: null },

    // used only when activity_type === "status_change", for a clean audit trail
    old_status: { type: String, default: null },
    new_status: { type: String, default: null },
  },
  { timestamps: true }
);

leadActivitySchema.index({ tenant_id: 1, lead_id: 1, createdAt: -1 });

module.exports = mongoose.model("LeadActivity", leadActivitySchema);