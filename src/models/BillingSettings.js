const mongoose = require("mongoose");

// Singleton document — only ONE row ever exists in this collection.
// Everything the Settings tab in the frontend saves lives here.
const billingSettingsSchema = new mongoose.Schema(
  {
    // Invoice numbering
    invoice_prefix: { type: String, default: "INV" },
    next_invoice_number: { type: Number, default: 1001 },

    // Tax / billing cycle defaults
    gst_percent: { type: Number, default: 18 },
    default_billing_cycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },

    // Reminder / retry behaviour
    reminder_before_days: { type: Number, default: 7 },
    retry_failed_after_days: { type: Number, default: 3 },
    enable_online_payments: { type: Boolean, default: true },
    allow_auto_renewal: { type: Boolean, default: true },
    send_failed_payment_alerts: { type: Boolean, default: false },
    email_invoice_automatically: { type: Boolean, default: true },

    // Razorpay gateway
    gateway_mode: { type: String, enum: ["test", "live"], default: "test" },
    razorpay_key_id: { type: String, default: "" },
    // NOTE (security): storing the secret in plaintext in Mongo is OK to ship
    // for now since you're on test mode, but before going live, either:
    //   (a) encrypt this field (e.g. mongoose-encryption / a KMS), or
    //   (b) keep secrets in env vars only and just store key_id + mode here.
    razorpay_key_secret: { type: String, default: "" },
    razorpay_webhook_secret: { type: String, default: "" },
  },
  { timestamps: true }
);

// Always returns the single settings doc, creating it with defaults on first use.
billingSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model("BillingSettings", billingSettingsSchema);