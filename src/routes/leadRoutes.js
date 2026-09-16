const express = require("express");
const router = express.Router();

const {
  createLead, getLeads, getLeadsBoard, getLeadById, updateLead, deleteLead,
  addLeadActivity, getLeadActivities,
  createSiteVisit, getSiteVisitsByLead, updateSiteVisit,getAllSiteVisits
} = require("../controllers/leadController");

const { protect, tenantScope } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const {
  requireActiveSubscription,
} = require("../middleware/subscriptionMiddleware");


router.use(protect, tenantScope, requireActiveSubscription);

router.get("/", checkPermission("leads", "view"), getLeads);
router.get("/board", checkPermission("leads", "view"), getLeadsBoard);
router.get("/:id", checkPermission("leads", "view"), getLeadById);
router.get("/site-visits/all", checkPermission("site_visits", "view"), getAllSiteVisits);
router.post("/", checkPermission("leads", "create"), createLead);
router.patch("/:id", checkPermission("leads", "edit"), updateLead);
router.delete("/:id", checkPermission("leads", "delete"), deleteLead);

router.post("/:id/activities", checkPermission("leads", "edit"), addLeadActivity);
router.get("/:id/activities", checkPermission("leads", "view"), getLeadActivities);

router.post("/:id/site-visits", checkPermission("leads", "edit"), createSiteVisit);
router.get("/:id/site-visits", checkPermission("leads", "view"), getSiteVisitsByLead);
router.patch("/site-visits/:visitId", checkPermission("leads", "edit"), updateSiteVisit);

module.exports = router;