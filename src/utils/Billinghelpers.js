const BillingSettings = require("../models/BillingSettings");

// Atomically claims the next invoice number so two simultaneous invoice
// creations never get the same number (findOneAndUpdate with $inc is
// atomic at the DB level, unlike "read next_invoice_number then +1 then save").
async function getNextInvoiceNumber() {
  const settings = await BillingSettings.findOneAndUpdate(
    {},
    { $inc: { next_invoice_number: 1 } },
    { new: false, upsert: true, setDefaultsOnInsert: true }
  );

  const prefix = settings?.invoice_prefix || "INV";
  const number = settings?.next_invoice_number || 1001;
  return `${prefix}-${number}`;
}

// Simple intra-state split (CGST + SGST, 50/50 of the GST%).
// If you sell inter-state, swap this for an IGST-only calculation based
// on whether the tenant's billing state matches your company's state.
function splitGst(amount, gstPercent) {
  const totalGst = Math.round((amount * gstPercent) / 100);
  const cgst = Math.round(totalGst / 2);
  const sgst = totalGst - cgst;
  return { cgst_amount: cgst, sgst_amount: sgst, total_amount: amount + cgst + sgst };
}

module.exports = { getNextInvoiceNumber, splitGst };