const express = require("express");
const router = express.Router();

const {
  getModuleControl,
  updateModuleControl,
  updateTenantOverride,
  getAuditLogs,
} = require("../controllers/moduleControlController");

const {
  protect,
  tenantScope,
  isSuperAdmin,
} = require("../middleware/authMiddleware");

// Tenant + Super Admin sidebar read
router.get(
  "/",
  protect,
  tenantScope,
  getModuleControl
);

// Only Super Admin can update global module settings
router.put(
  "/",
  protect,
  isSuperAdmin,
  updateModuleControl
);

// Only Super Admin can update tenant override
router.put(
  "/tenant-override",
  protect,
  isSuperAdmin,
  updateTenantOverride
);

// Only Super Admin can view audit logs
router.get(
  "/audit-logs",
  protect,
  isSuperAdmin,
  getAuditLogs
);

module.exports = router;