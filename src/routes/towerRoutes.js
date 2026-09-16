const express = require("express");
const router = express.Router();
const {
  createTower,
  getTowers,
  updateTower,
  deleteTower,
  bulkCreateTowers,
} = require("../controllers/towerController");
const {
  protect,
  isSuperAdmin,
  tenantScope,
} = require("../middleware/authMiddleware");
const {
  requireActiveSubscription,
} = require("../middleware/subscriptionMiddleware");

router.use(protect);
router.use(tenantScope);
router.use(requireActiveSubscription);

router.post("/", isSuperAdmin, createTower);
router.put("/update/:id", isSuperAdmin, updateTower);
router.get("/", getTowers);
router.delete("/delete/:id/:project_id", isSuperAdmin, deleteTower);
router.post("/bulk", isSuperAdmin, bulkCreateTowers);

module.exports = router;
