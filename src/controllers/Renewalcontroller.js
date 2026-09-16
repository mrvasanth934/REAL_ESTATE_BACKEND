const computeRenewals = require("../utils/Renewalservice").computeRenewals;
const { getRazorpayInstance } = require("../utils/Razorpayclient");
const Tenant = require("../models/Tenant");
const nodemailer = require("nodemailer");

// GET /api/billing/renewals?status=&search=
exports.listRenewals = async (req, res) => {
  try {
    const { status = "", search = "" } = req.query;

    let rows = await computeRenewals({ windowDays: 30 });

    if (status) rows = rows.filter((r) => r.status === status);
    if (search) rows = rows.filter((r) => r.tenant.toLowerCase().includes(search.toLowerCase()));

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("listRenewals error:", err);
    res.status(500).json({ success: false, message: "Could not load renewals." });
  }
};

// POST /api/billing/renewals/:tenantId/remind
exports.sendReminder = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    if (!process.env.SMTP_HOST) {
      return res.json({ success: true, sent: false, message: "SMTP not configured — reminder logged but not emailed." });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    // FIX: tenant's display name field is `business_name`, not `name`.
    // FIX: tenant model field for the email address — check your schema;
    // if it's stored differently (e.g. `contact_email`, `owner_email`),
    // update this reference to match.
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: tenant.email,
      subject: "Your subscription is expiring soon",
      text: `Hi ${tenant.business_name}, your subscription is expiring soon. Please renew to avoid losing access.`,
    });

    res.json({ success: true, sent: true });
  } catch (err) {
    console.error("sendReminder error:", err);
    res.status(500).json({ success: false, message: "Could not send reminder." });
  }
};

// POST /api/billing/renewals/:tenantId/renew
exports.createRenewalOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: "A valid amount is required" });
    }

    // FIX: getRazorpayInstance() is no longer async (env-var based, not a DB
    // fetch), but awaiting a plain value is harmless — kept for safety in
    // case it's made async again later (e.g. re-added a DB check).
    const razorpay = await getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount: Math.round(numericAmount * 100), // paise
      currency: "INR",
      receipt: `renewal_${req.params.tenantId}_${Date.now()}`,
      notes: { tenant_id: req.params.tenantId, reason: "renewal" },
    });

    res.json({ success: true, data: order });
  } catch (err) {
    console.error("createRenewalOrder error:", err);
    // FIX: respect the thrown statusCode (400 = "not configured") instead
    // of always masking it as a 500.
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message || "Could not start renewal." });
  }
};