const express = require("express");
const router = express.Router();
const {
  protect,
  isSuperAdmin,
  tenantScope,
} = require("../middleware/authMiddleware");
const {
  createMaintenanceRequest,
  updateMaintenanceRequest,
  deleteMaintenanceRequest,
  getMaintenanceRequests,
} = require("../controllers/MaintenanceRequestController");

router.use(protect);
router.use(tenantScope);

router.post("/", createMaintenanceRequest);
router.put("/update/:id", updateMaintenanceRequest);
router.get("/", getMaintenanceRequests);
router.delete("/delete/:id", deleteMaintenanceRequest);

module.exports = router;
