const mongoose = require("mongoose");

const brokerageSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    broker_name: { type: String, required: true, trim: true },
    commission_amount: { type: Number, required: true, min: 0 },
    commission_rate: { type: Number, required: true, min: 0, max: 100 },
    payout_amount: { type: Number, required: true, min: 0 },
    conversion_rate: { type: Number, default: 0, min: 0, max: 100 },
    payout_date: { type: Date, required: true },
    pipeline_stage: {
      type: String,
      enum: [
        "loi_received",
        "agreement_signed",
        "invoiced",
        "received",
        "distributed",
      ],
      default: "loi_received",
    },
    agency_split: { type: Number, default: 45, min: 0, max: 100 },
    agent_split: { type: Number, default: 40, min: 0, max: 100 },
    external_broker_split: { type: Number, default: 15, min: 0, max: 100 },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

brokerageSchema.index({ tenant_id: 1, payout_date: 1 });
brokerageSchema.index({ tenant_id: 1, pipeline_stage: 1 });

module.exports = mongoose.model("Brokerage", brokerageSchema);
