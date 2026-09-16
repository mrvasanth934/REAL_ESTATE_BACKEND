const express = require("express");
const router = express.Router();

const {
  getReportsOverview,
  getAgencyReportsOverview,
} = require("../controllers/reportController");
const { protect, tenantScope } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");

router.get(
  "/overview",
  protect,
  checkPermission("reports", "view"),
  getReportsOverview,
);

router.get(
  "/agency-overview",
  protect,
  tenantScope,
  checkPermission("reports", "view"),
  getAgencyReportsOverview,
);

module.exports = router;
