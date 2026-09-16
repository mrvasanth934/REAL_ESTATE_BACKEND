const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      default: null,
    },
    invoice_no: {
      type: String,
      required: true,
      unique: true,
    },
    plan_name: { type: String, required: true },
    amount: { type: Number, required: true },
    cgst_amount: { type: Number, default: 0 },
    sgst_amount: { type: Number, default: 0 },
    total_amount: { type: Number, required: true }, // amount + cgst + sgst
    billing_date: { type: Date, required: true, default: Date.now },
    reason: {
      type: String,
      enum: ["new_plan", "upgrade", "renewal"],
      default: "renewal",
    },

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled", "refunded"],
      default: "pending",
    },
    paid_at: { type: Date, default: null },
    marked_paid_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    }, // Super Admin who confirmed
    payment_note: { type: String, trim: true, default: "" }, // eg: "Bank transfer, ref #1234"
    razorpay_order_id: {
      type: String,
      unique: true,
      sparse: true,
    },

    razorpay_payment_id: {
      type: String,
      unique: true,
      sparse: true,
    },

    razorpay_signature: {
      type: String,
    },

    billing_cycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },

    payment_method: {
      type: String,
      default: "razorpay",
    },

    payment_status: {
      type: String,
      enum: ["created", "authorized", "captured", "failed"],
      default: "created",
    },
  },
  { timestamps: true },
);

invoiceSchema.index({ tenant_id: 1, billing_date: -1 });

module.exports = mongoose.model("Invoice", invoiceSchema);
