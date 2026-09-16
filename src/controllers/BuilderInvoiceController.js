const Invoice = require("../models/BuilderInvoice");

// 1. Create a new Invoice
exports.createInvoice = async (req, res) => {
  try {
    const {
      lead_id,
      invoice_date,
      project_id,
      tower_id,
      unit_id,
      customer_name,
      taxable_amount,
      gst_amount,
      total_amount,
      status,
    } = req.body;

    const lastInvoice = await Invoice.findOne({ tenant_id: req.tenantId })
      .sort({ createdAt: -1 })
      .select("invoice_no");

    let generatedInvoiceNo = "INV-001";

    if (lastInvoice && lastInvoice.invoice_no) {
      const parts = lastInvoice.invoice_no.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);

      if (!isNaN(lastNum)) {
        const nextNum = lastNum + 1;
        generatedInvoiceNo = `INV-${String(nextNum).padStart(3, "0")}`;
      } else {
        generatedInvoiceNo = `INV-${Date.now().toString().slice(-4)}`;
      }
    }
    const newInvoice = new Invoice({
      tenant_id: req.tenantId,
      lead_id,
      invoice_no: generatedInvoiceNo,
      invoice_date,
      project_id,
      tower_id,
      unit_id,
      customer_name,
      taxable_amount,
      gst_amount,
      total_amount,
      status: status || "Pending",
    });

    const savedInvoice = await newInvoice.save();

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: savedInvoice,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error creating invoice",
      error: error.message,
    });
  }
};

// 2. Get All Invoices
exports.getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find().populate([
      "unit_id",
      "project_id",
      "lead_id",
      "tower_id",
    ]);

    res.status(200).json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching invoices",
      error: error.message,
    });
  }
};

// 3. Update an Invoice
exports.updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedInvoice = await Invoice.findOneAndUpdate(
      { _id: id, tenant_id: req.tenantId },
      req.body,
      { new: true, runValidators: true },
    );

    if (!updatedInvoice) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }

    res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      data: updatedInvoice,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating invoice",
      error: error.message,
    });
  }
};

// 4. Delete an Invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedInvoice = await Invoice.findOneAndDelete({
      _id: id,
      tenant_id: req.tenantId,
    });

    if (!deletedInvoice) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }

    res.status(200).json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting invoice",
      error: error.message,
    });
  }
};
