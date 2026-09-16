const express = require("express");
const router = express.Router();
const { getTenants, createTenant, updateTenant, deleteTenant, getTenantById } = require("../controllers/tenantController");
const { protect, isSuperAdmin, tenantScope } = require("../middleware/authMiddleware");
const {
  requireActiveSubscription,
} = require("../middleware/subscriptionMiddleware");

router.use(protect); // All routes require authentication
router.use(tenantScope); // Enforce tenant isolation
router.use(requireActiveSubscription); // Enforce active subscription

router.get("/", getTenants); // Super admin sees all, others see only their tenant
router.post("/", isSuperAdmin, createTenant); // Only super admin can create tenants
router.patch("/:id", updateTenant); // Agency owner can update own tenant, super admin can update any
router.delete("/:id", isSuperAdmin, deleteTenant); // Only super admin can delete
router.get('/tenant/:id',getTenantById)

module.exports = router;