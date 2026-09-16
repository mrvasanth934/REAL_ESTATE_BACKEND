const express = require("express");
const router = express.Router();
const {
  getBrokerages,
  getBrokerageById,
  createBrokerage,
  updateBrokerage,
  deleteBrokerage,
} = require("../controllers/brokerageController");
const { protect, tenantScope } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const {
  requireActiveSubscription,
} = require("../middleware/subscriptionMiddleware");

router.use(protect, tenantScope, requireActiveSubscription);
router.get("/", checkPermission("brokerage", "view"), getBrokerages);
router.get("/:id", checkPermission("brokerage", "view"), getBrokerageById);
router.post("/", checkPermission("brokerage", "create"), createBrokerage);
router.patch("/:id", checkPermission("brokerage", "edit"), updateBrokerage);
router.delete("/:id", checkPermission("brokerage", "delete"), deleteBrokerage);

module.exports = router;
