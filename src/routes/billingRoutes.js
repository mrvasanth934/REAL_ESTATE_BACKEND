const express = require("express");
const router = express.Router();

// TODO: adjust this import to match your existing auth middleware file/names.
// This is the same pattern you're already using for super_admin-only routes
// elsewhere (Tenants, Subscription Plans, Module Control).


const dashboardController = require("../controllers/Dashboardcontroller");
const transactionController = require("../controllers/Transactioncontroller");
const invoiceController = require("../controllers/Invoicecontroller");
const renewalController = require("../controllers/Renewalcontroller");
const settingsController = require("../controllers/Settingcontroller");
const webhookController = require("../controllers/Webhookcontroller");
const { protect, isSuperAdmin } = require("../middleware/authMiddleware");

// ── Webhook — public, verified by Razorpay signature instead of auth ──
// Must use express.raw() here, NOT express.json(), for signature verification.
router.post("/webhook", express.raw({ type: "application/json" }), webhookController.handleWebhook);

// ── Everything below is Super Admin only ──
router.use(protect, isSuperAdmin);

// Dashboard
router.get("/summary", dashboardController.getSummary);
router.get("/revenue/monthly", dashboardController.getMonthlyRevenue);
router.get("/revenue/by-plan", dashboardController.getRevenueByPlan);

// Transactions
router.get("/transactions", transactionController.listTransactions);
router.get("/transactions/:id", transactionController.getTransactionById);
router.post("/transactions", transactionController.createManualTransaction);
router.post("/transactions/:id/refund", transactionController.refundTransaction);

// Invoices
router.get("/invoices", invoiceController.listInvoices);
router.get("/invoices/:id", invoiceController.getInvoiceById);
router.post("/invoices", invoiceController.generateInvoice);
router.get("/invoices/:id/pdf", invoiceController.downloadInvoicePdf);

// Renewals
router.get("/renewals", renewalController.listRenewals);
router.post("/renewals/:tenantId/remind", renewalController.sendReminder);
router.post("/renewals/:tenantId/renew", renewalController.createRenewalOrder);

// Settings
router.get("/settings", settingsController.getSettings);
router.put("/settings/gateway", settingsController.updateGatewaySettings);
router.put("/settings/billing-config", settingsController.updateBillingConfig);
router.put("/settings/reminders", settingsController.updateReminderSettings);
router.post("/settings/test-connection", settingsController.testConnection);

module.exports = router;

// In your main app.js / server.js:
//   const billingRoutes = require("./routes/billingRoutes");
//   app.use("/api/billing", billingRoutes);