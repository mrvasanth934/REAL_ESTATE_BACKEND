const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    lead_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    invoice_no: {
      type: String,
      required: true,
      unique: true,
    },
    invoice_date: {
      type: Date,
      required: true,
    },
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    tower_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tower",
      required: true,
    },
    unit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
    },
    taxable_amount: {
      type: Number,
      required: true,
    },
    gst_amount: {
      type: Number,
      required: true,
    },
    total_amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Paid", "Pending", "Overdue", "Cancelled"],
      default: "Pending",
    },
  },
  { timestamps: true },
);

invoiceSchema.index({ tenant_id: 1, invoice_no: 1 });
invoiceSchema.index({ tenant_id: 1, status: 1 });
invoiceSchema.index({ tenant_id: 1, project_id: 1, tower_id: 1 });

module.exports = mongoose.model("BuilderInvoice", invoiceSchema);
