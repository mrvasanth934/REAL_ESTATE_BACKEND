const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },

    source: {
      type: String,
      enum: ["website", "whatsapp", "call", "walkin", "referral", "portal"],
      required: true,
    },

    property_interest_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },

    budget_min: { type: Number, default: null },
    budget_max: { type: Number, default: null },
    preferred_location: { type: String, trim: true, default: "" },

    lead_status: {
      type: String,
      enum: ["new", "contacted", "site_visit_scheduled", "negotiation", "booked", "lost", "cold"],
      default: "new",
    },

    lead_score: { type: Number, min: 0, max: 100, default: 0 },

    assigned_agent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lost_reason: { type: String, trim: true, default: "" },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

leadSchema.index({ tenant_id: 1, lead_status: 1 });
leadSchema.index({ tenant_id: 1, assigned_agent_id: 1 });
leadSchema.index({ tenant_id: 1, name: 1 });
leadSchema.index({ tenant_id: 1, phone: 1 });

module.exports = mongoose.model("Lead", leadSchema);