const express = require("express");
const router = express.Router();
const siteVisitController = require("../controllers/siteVisitController");
const { protect, tenantScope } = require("../middleware/authMiddleware");

router.post("/", protect, tenantScope, siteVisitController.createSiteVisit);
router.get("/", protect, tenantScope, siteVisitController.getSiteVisits);
router.get("/:id", protect, tenantScope, siteVisitController.getSiteVisitById);
router.put("/:id", protect, tenantScope, siteVisitController.updateSiteVisit);
router.delete(
  "/:id",
  protect,
  tenantScope,
  siteVisitController.deleteSiteVisit,
);

module.exports = router;
