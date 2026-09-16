const mongoose = require("mongoose");

const siteVisitSchema = new mongoose.Schema(
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
    property_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    scheduled_at: { type: Date, required: true },
    agent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "no_show", "cancelled"],
      default: "scheduled",
    },
    feedback: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

siteVisitSchema.index({ tenant_id: 1, lead_id: 1 });
siteVisitSchema.index({ tenant_id: 1, agent_id: 1, scheduled_at: 1 });

module.exports = mongoose.model("SiteVisit", siteVisitSchema);