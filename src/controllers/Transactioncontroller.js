const Invoice = require("../models/Invoice");
const Tenant = require("../models/Tenant");
const { getRazorpayInstance } = require("../utils/Razorpayclient");

// Escapes regex special chars so user search input can never break/abuse $regex
// (e.g. someone typing "(" or ".*" would previously either error or match everything).
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/billing/transactions?search=&status=&method=&page=&limit=
exports.listTransactions = async (req, res) => {
  try {
    const { search = "", status = "", method = "" } = req.query;

    // FIX: validate page/limit so a bad query string (e.g. page=abc) can't
    // turn into NaN and crash .skip()/.limit() with a Mongo error.
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) limit = 10;

    const filter = {};
    if (status) filter.status = status;
    if (method) filter.payment_method = method;

    if (search) {
      const safeSearch = escapeRegex(search);

      const matchingTenants = await Tenant.find(
        { business_name: { $regex: safeSearch, $options: "i" } },
        { _id: 1 }
      ).lean();

      filter.$or = [
        { invoice_no: { $regex: safeSearch, $options: "i" } },
        { razorpay_payment_id: { $regex: safeSearch, $options: "i" } },
        { tenant_id: { $in: matchingTenants.map((t) => t._id) } },
      ];
    }

    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      Invoice.find(filter)
        .populate("tenant_id", "business_name email business_type")
        .sort({ billing_date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: rows.map(formatTransaction),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("listTransactions error:", err);
    // FIX: don't leak raw DB error text to the client.
    res.status(500).json({ success: false, message: "Could not load transactions." });
  }
};

exports.getTransactionById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("tenant_id", "business_name email business_type")
      .lean();
    if (!invoice) return res.status(404).json({ success: false, message: "Transaction not found" });
    res.json({ success: true, data: formatTransaction(invoice) });
  } catch (err) {
    console.error("getTransactionById error:", err);
    res.status(500).json({ success: false, message: "Could not load transaction." });
  }
};

// POST /api/billing/transactions  (the "Add Payment" button — manual/offline payment entry)
exports.createManualTransaction = async (req, res) => {
  try {
    const { tenant_id, plan_id, plan_name, amount, payment_note, billing_cycle } = req.body;

    if (!tenant_id || !plan_name || !amount) {
      return res.status(400).json({ success: false, message: "tenant_id, plan_name and amount are required" });
    }

    // FIX: amount must be a positive number — previously any string/negative
    // value would silently pass through and create a bad invoice.
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive number" });
    }

    // FIX: confirm the tenant actually exists before creating an invoice for it.
    const tenant = await Tenant.findById(tenant_id).select("_id").lean();
    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    // Lazy-require to avoid a circular-require issue between controllers/utils.
    const BillingSettings = require("../models/BillingSettings");
    const { getNextInvoiceNumber, splitGst } = require("../utils/Billinghelpers");

    const settings = await BillingSettings.getSettings();
    const invoice_no = await getNextInvoiceNumber();
    const { cgst_amount, sgst_amount, total_amount } = splitGst(numericAmount, settings.gst_percent);

    const invoice = await Invoice.create({
      tenant_id,
      plan_id: plan_id || null,
      invoice_no,
      plan_name,
      amount: numericAmount,
      cgst_amount,
      sgst_amount,
      total_amount,
      billing_date: new Date(),
      reason: "renewal",
      status: "paid",
      paid_at: new Date(),
      marked_paid_by: req.user?._id || null,
      payment_note: payment_note || "Manual entry by admin",
      payment_method: "manual",
      payment_status: "captured",
      billing_cycle: billing_cycle || settings.default_billing_cycle,
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    console.error("createManualTransaction error:", err);
    res.status(500).json({ success: false, message: "Could not save payment." });
  }
};

// POST /api/billing/transactions/:id/refund
exports.refundTransaction = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Transaction not found" });

    if (invoice.status !== "paid") {
      return res.status(400).json({ success: false, message: "Only paid transactions can be refunded" });
    }

    // FIX: guard against double-refund if two requests race each other.
    if (invoice.status === "refunded") {
      return res.status(400).json({ success: false, message: "This transaction is already refunded" });
    }

    if (!invoice.razorpay_payment_id) {
      return res.status(400).json({
        success: false,
        message: "No gateway payment ID on this invoice — cannot auto-refund. Mark it manually if this was a cash/manual payment.",
      });
    }

    const razorpay = getRazorpayInstance();
    await razorpay.payments.refund(invoice.razorpay_payment_id, {
      amount: Math.round(invoice.total_amount * 100), // paise
    });

    invoice.status = "refunded";
    invoice.payment_note = `${invoice.payment_note || ""} | Refunded by ${req.user?.username || "admin"} on ${new Date().toISOString()}`.trim();
    await invoice.save();

    res.json({ success: true, data: invoice });
  } catch (err) {
    console.error("refundTransaction error:", err);
    // FIX: respect a custom statusCode (e.g. "Razorpay not configured" = 400)
    // instead of always returning 500 — the admin needs to see the REAL
    // reason (missing .env keys) not a generic server-error message.
    const statusCode = err.statusCode || 500;
    const message = err?.error?.description || err.message || "Refund failed. Please try again or check Razorpay dashboard.";
    res.status(statusCode).json({ success: false, message });
  }
};

function formatTransaction(invoice) {
  return {
    id: invoice._id,
    transactionId: invoice.invoice_no,
    tenant: invoice.tenant_id?.business_name || "Unknown",
    plan: invoice.plan_name,
    amount: invoice.total_amount,
    paymentMethod: invoice.payment_method,
    status: capitalize(invoice.status),
    date: invoice.billing_date,
    gatewayRef: invoice.razorpay_payment_id || "—",
  };
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}