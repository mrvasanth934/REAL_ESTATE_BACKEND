const PDFDocument = require("pdfkit");
const Invoice = require("../models/Invoice");
const BillingSettings = require("../models/BillingSettings");
const { getNextInvoiceNumber, splitGst } = require("../utils/Billinghelpers");
 const Tenant = require("../models/Tenant");
// GET /api/billing/invoices?search=&status=&page=&limit=
exports.listInvoices = async (req, res) => {
  try {
    const { search = "", status = "", page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    if (search) {
    

const matchingTenants = await Tenant.find(
  { business_name: { $regex: search, $options: "i" } },
  { _id: 1 }
).lean();
      filter.$or = [
        { invoice_no: { $regex: search, $options: "i" } },
        { tenant_id: { $in: matchingTenants.map((t) => t._id) } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [rows, total] = await Promise.all([
      Invoice.find(filter)
        .populate("tenant_id", "business_name email business_type")
        .sort({ billing_date: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: rows.map(formatInvoice),
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("tenant_id", "business_name email business_type address").lean();
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, data: formatInvoice(invoice) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/billing/invoices  (create a fresh "pending" invoice for a tenant — e.g. before they've paid)
exports.generateInvoice = async (req, res) => {
  try {
    const { tenant_id, plan_id, plan_name, amount, billing_cycle, reason } = req.body;

    if (!tenant_id || !plan_name || !amount) {
      return res.status(400).json({ success: false, message: "tenant_id, plan_name and amount are required" });
    }

    const settings = await BillingSettings.getSettings();
    const invoice_no = await getNextInvoiceNumber();
    const { cgst_amount, sgst_amount, total_amount } = splitGst(Number(amount), settings.gst_percent);

    const invoice = await Invoice.create({
      tenant_id,
      plan_id: plan_id || null,
      invoice_no,
      plan_name,
      amount,
      cgst_amount,
      sgst_amount,
      total_amount,
      billing_date: new Date(),
      reason: reason || "renewal",
      status: "pending",
      billing_cycle: billing_cycle || settings.default_billing_cycle,
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/billing/invoices/:id/pdf — streams a real PDF, not a stub.
// npm install pdfkit
exports.downloadInvoicePdf = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("tenant_id", "business_name email").lean();
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${invoice.invoice_no}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text("Tax Invoice", { align: "right" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#555").text(invoice.invoice_no, { align: "right" });
    doc.text(new Date(invoice.billing_date).toLocaleDateString("en-IN"), { align: "right" });

    doc.moveDown(2);
    doc.fillColor("#000").fontSize(12).text("Billed to:");
doc.fontSize(11).text(invoice.tenant_id?.business_name || "Unknown tenant");
    doc.fontSize(10).fillColor("#555").text(invoice.tenant_id?.email || "");

    doc.moveDown(2);
    doc.fillColor("#000");

    const tableTop = doc.y;
    doc.fontSize(10).text("Description", 50, tableTop);
    doc.text("Amount", 400, tableTop, { width: 100, align: "right" });
    doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();

    let y = tableTop + 25;
    doc.text(`${invoice.plan_name} — ${invoice.billing_cycle}`, 50, y);
    doc.text(`Rs.${invoice.amount.toLocaleString("en-IN")}`, 400, y, { width: 100, align: "right" });

    y += 20;
    doc.text("CGST", 50, y);
    doc.text(`Rs.${invoice.cgst_amount.toLocaleString("en-IN")}`, 400, y, { width: 100, align: "right" });

    y += 20;
    doc.text("SGST", 50, y);
    doc.text(`Rs.${invoice.sgst_amount.toLocaleString("en-IN")}`, 400, y, { width: 100, align: "right" });

    y += 15;
    doc.moveTo(50, y).lineTo(500, y).stroke();
    y += 10;

    doc.fontSize(12).text("Total", 50, y, { bold: true });
    doc.fontSize(12).text(`Rs.${invoice.total_amount.toLocaleString("en-IN")}`, 400, y, { width: 100, align: "right" });

    doc.moveDown(3);
    doc.fontSize(9).fillColor("#888").text(`Status: ${invoice.status.toUpperCase()}`, 50);

    doc.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function formatInvoice(invoice) {
  return {
    id: invoice._id,
    invoice: invoice.invoice_no,
   tenant: invoice.tenant_id?.business_name || "Unknown",
    plan: invoice.plan_name,
    amount: invoice.amount,
    gst: invoice.cgst_amount + invoice.sgst_amount,
    total: invoice.total_amount,
    dueDate: invoice.billing_date,
    status: capitalize(invoice.status),
  };
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}