const express = require("express");
const router = express.Router();

const {
  protect,
  isSuperAdmin,
  tenantScope,
} = require("../middleware/authMiddleware");
const {
  createUnit,
  updateUnit,
  deleteUnit,
  getUnits,
} = require("../controllers/UnitController");

router.use(protect);
router.use(tenantScope);

router.post("/", isSuperAdmin, createUnit);
router.put("/update/:id", isSuperAdmin, updateUnit);
router.get("/", getUnits);
router.delete("/delete/:id/:tower_id", isSuperAdmin, deleteUnit);

module.exports = router;
