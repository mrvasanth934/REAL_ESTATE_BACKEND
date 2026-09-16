const BillingSettings = require("../models/BillingSettings");
const { getRazorpayInstance } = require("../utils/Razorpayclient");

exports.getSettings = async (req, res) => {
  try {
    const settings = await BillingSettings.getSettings();
    const safe = settings.toObject();
    safe.razorpay_key_secret = safe.razorpay_key_secret ? "••••••••" : "";
    safe.razorpay_webhook_secret = safe.razorpay_webhook_secret ? "••••••••" : "";
    res.json({ success: true, data: safe });
  } catch (err) {
    console.error("getSettings error:", err);
    res.status(500).json({ success: false, message: "Could not load settings." });
  }
};

// PUT /api/billing/settings/gateway
// NOTE: razorpay_key_id / razorpay_key_secret saved here are NO LONGER used
// to actually talk to Razorpay — the real credentials are RAZORPAY_KEY_ID /
// RAZORPAY_KEY_SECRET in your .env (see utils/Razorpayclient.js). These
// fields are kept so the Settings UI doesn't break, but they're informational
// only right now. If you want the Settings tab to be the real source of
// truth again, update getRazorpayInstance() to read from here instead of
// env vars — just make sure createSubscriptionOrder does the same, or the
// mismatch bug comes right back.
exports.updateGatewaySettings = async (req, res) => {
  try {
    const { gateway_mode, razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret } = req.body;
    const update = { gateway_mode, razorpay_key_id };

    if (razorpay_key_secret && !razorpay_key_secret.includes("•")) update.razorpay_key_secret = razorpay_key_secret;
    if (razorpay_webhook_secret && !razorpay_webhook_secret.includes("•")) update.razorpay_webhook_secret = razorpay_webhook_secret;

    const settings = await BillingSettings.findOneAndUpdate({}, update, { new: true, upsert: true });
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error("updateGatewaySettings error:", err);
    res.status(500).json({ success: false, message: "Could not save gateway settings." });
  }
};

// PUT /api/billing/settings/billing-config
exports.updateBillingConfig = async (req, res) => {
  try {
    const { invoice_prefix, gst_percent, default_billing_cycle } = req.body;
    const settings = await BillingSettings.findOneAndUpdate(
      {},
      { invoice_prefix, gst_percent, default_billing_cycle },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error("updateBillingConfig error:", err);
    res.status(500).json({ success: false, message: "Could not save billing configuration." });
  }
};

// PUT /api/billing/settings/reminders
exports.updateReminderSettings = async (req, res) => {
  try {
    const {
      reminder_before_days,
      retry_failed_after_days,
      enable_online_payments,
      allow_auto_renewal,
      send_failed_payment_alerts,
      email_invoice_automatically,
    } = req.body;

    const settings = await BillingSettings.findOneAndUpdate(
      {},
      {
        reminder_before_days,
        retry_failed_after_days,
        enable_online_payments,
        allow_auto_renewal,
        send_failed_payment_alerts,
        email_invoice_automatically,
      },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error("updateReminderSettings error:", err);
    res.status(500).json({ success: false, message: "Could not save reminder settings." });
  }
};

// POST /api/billing/settings/test-connection
// Tests the REAL credentials (env vars) — the ones actually used for payments.
exports.testConnection = async (req, res) => {
  try {
    const razorpay = await getRazorpayInstance();
    await razorpay.orders.all({ count: 1 });
    res.json({ success: true, message: "Connected to Razorpay successfully." });
  } catch (err) {
    console.error("testConnection error:", err);
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ success: false, message: err.message || "Could not connect to Razorpay." });
  }
};