const express = require("express");
const router = express.Router();

const {
  createPlan, getPlans, getPlanById, updatePlan, deletePlan,
  getDashboard, getRecentSubscriptions,
  getMySubscription, getMyInvoices, updateAutoRenewal,
  requestPlanChange, requestRenewal,
  getAllInvoices, markInvoicePaid, acknowledgeOnboarding,createSubscriptionOrder,verifySubscriptionPayment
} = require("../controllers/subscriptionPlanController");
const { getSettings, updateSettings } = require("../controllers/platformSettingsController");
const { protect, isSuperAdmin, tenantScope } = require("../middleware/authMiddleware");

// ── Tenant-facing ──
router.get("/my-subscription", protect, tenantScope, getMySubscription);
router.get("/my-invoices", protect, tenantScope, getMyInvoices);
router.patch("/auto-renewal", protect, tenantScope, updateAutoRenewal);
// router.post("/request-plan-change", protect, tenantScope, requestPlanChange);
// router.post("/request-renewal", protect, tenantScope, requestRenewal);
router.post(
  "/payment/order",
  protect,
  tenantScope,
  createSubscriptionOrder
);

router.post(
  "/payment/verify",
  protect,
  tenantScope,
  verifySubscriptionPayment
);
// ── Super Admin — Dashboard & Settings ──
router.patch("/acknowledge-onboarding", protect, tenantScope, acknowledgeOnboarding);
router.get("/dashboard", protect, isSuperAdmin, getDashboard);
router.get("/recent-subscriptions", protect, isSuperAdmin, getRecentSubscriptions);
router.get("/settings", protect, isSuperAdmin, getSettings);
router.patch("/settings", protect, isSuperAdmin, updateSettings);

// ── Super Admin — Invoices (manual payment) ──
// router.get("/invoices", protect, isSuperAdmin, getAllInvoices);
// router.patch("/invoices/:invoiceId/mark-paid", protect, isSuperAdmin, markInvoicePaid);

// ── Super Admin — Plan CRUD ──
router.get("/", protect, isSuperAdmin, getPlans);
router.post("/", protect, isSuperAdmin, createPlan);
router.get("/:id", protect, isSuperAdmin, getPlanById);
router.patch("/:id", protect, isSuperAdmin, updatePlan);
router.delete("/:id", protect, isSuperAdmin, deletePlan);

module.exports = router;