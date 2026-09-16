const express = require("express");
const router = express.Router();
const {
  createMilestone,
  updateMilestone,
  deleteMilestone,
  getMilestones,
} = require("../controllers/ConstructionMilestonesController");
const { protect, tenantScope } = require("../middleware/authMiddleware");

router.use(protect);
router.use(tenantScope);

router.post("/", createMilestone);
router.put("/update/:id", updateMilestone);
router.get("/", getMilestones);
router.delete("/delete/:id", deleteMilestone);

module.exports = router;
