const mongoose = require("mongoose");

const platformSettingsSchema = new mongoose.Schema(
  {
    cgst_percent: { type: Number, default: 0 },
    sgst_percent: { type: Number, default: 0 },
    default_trial_days: { type: Number, default: 14 },
    grace_period_days: { type: Number, default: 7 },
    invoice_prefix: { type: String, default: "INV" },
    currency: { type: String, default: "INR" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlatformSettings", platformSettingsSchema);
