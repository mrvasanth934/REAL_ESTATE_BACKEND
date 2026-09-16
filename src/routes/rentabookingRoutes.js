const express = require("express");
const router = express.Router();
const { agreementUpload } = require("../middleware/upload");
const {
  getRentalBookings,
  getRentalBookingById,
  createRentalBooking,
  updateRentalBooking,
  deleteRentalBooking,
  uploadDraftMedia,
  addRentalCollection,
  getRentalBookingByIds,
} = require("../controllers/retalBookingController");
const {
  updateLastGenerated,
  getLastGenerated,
} = require("../controllers/lastGeneratedController");

const { protect, tenantScope } = require("../middleware/authMiddleware");
const {
  requireActiveSubscription,
} = require("../middleware/subscriptionMiddleware");
const checkPermission = require("../middleware/checkPermission");

router.use(protect, tenantScope, requireActiveSubscription);

router.get(
  "/getbasedontenant",
  checkPermission("rentalbooking", "view"),
  getRentalBookingByIds,
);
router.get("/getLastGenerate", getLastGenerated);
router.get("/", checkPermission("rentalbooking", "view"), getRentalBookings);
router.get(
  "/:id",
  checkPermission("rentalbooking", "view"),
  getRentalBookingById,
);
router.post("/", agreementUpload.single("agreementImage"), createRentalBooking);
router.patch(
  "/:id",
  checkPermission("rentalbooking", "edit"),
  updateRentalBooking,
);
router.post(
  "/addcollection/:id",
  checkPermission("rentcollection", "create"),
  addRentalCollection,
);
router.delete(
  "/:id",
  checkPermission("rentalbooking", "delete"),
  deleteRentalBooking,
);
router.post(
  "/media/upload",
  agreementUpload.single("agreementImage"),
  uploadDraftMedia,
);
router.put("/updateLastGenerate/:id", updateLastGenerated);

module.exports = router;
