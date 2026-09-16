const express = require("express");
const router = express.Router();

const {
  createProject, getProjects, getProjectById, updateProject, deleteProject, addProjectMedia,
  createUnit, getUnitsByProject, updateUnit, deleteUnit, duplicateUnit,
  createMilestone, getMilestonesByProject, updateMilestone, deleteMilestone,
} = require("../controllers/projectController");

const { protect, tenantScope } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const upload = require("../middleware/uploadProjectMedia");
const {
  requireActiveSubscription,
} = require("../middleware/subscriptionMiddleware");

router.use(protect, tenantScope, requireActiveSubscription);

// Project
router.get("/", checkPermission("projects", "view"), getProjects);
router.post("/", checkPermission("projects", "create"), createProject);
router.get("/:id", checkPermission("projects", "view"), getProjectById);
router.patch("/:id", checkPermission("projects", "edit"), updateProject);
router.delete("/:id", checkPermission("projects", "delete"), deleteProject);
router.post("/:id/media", checkPermission("projects", "edit"), upload.single("file"), addProjectMedia);

// Units
router.post("/:id/units", checkPermission("projects", "create"), createUnit);
router.get("/:id/units", checkPermission("projects", "view"), getUnitsByProject);
router.patch("/units/:unitId", checkPermission("projects", "edit"), updateUnit);
router.delete("/units/:unitId", checkPermission("projects", "delete"), deleteUnit);
router.post("/units/:unitId/duplicate", checkPermission("projects", "create"), duplicateUnit);

// Milestones
router.post("/:id/milestones", checkPermission("projects", "edit"), createMilestone);
router.get("/:id/milestones", checkPermission("projects", "view"), getMilestonesByProject);
router.patch("/milestones/:milestoneId", checkPermission("projects", "edit"), updateMilestone);
router.delete("/milestones/:milestoneId", checkPermission("projects", "delete"), deleteMilestone);

module.exports = router;