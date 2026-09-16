const express = require("express");
const router = express.Router();

const {
  getAgencyBookings,
  getAgencyBookingById,
  createAgencyBooking,
  updateAgencyBooking,
  deleteAgencyBooking,
} = require("../controllers/bookingController");

const { protect, tenantScope } = require("../middleware/authMiddleware");
const { requireActiveSubscription } = require("../middleware/subscriptionMiddleware");
const checkPermission = require("../middleware/checkPermission");

router.use(protect, tenantScope, requireActiveSubscription);

router.get("/", checkPermission("bookings", "view"), getAgencyBookings);
router.get("/:id", checkPermission("bookings", "view"), getAgencyBookingById);
router.post("/", checkPermission("bookings", "create"), createAgencyBooking);
router.patch("/:id", checkPermission("bookings", "edit"), updateAgencyBooking);
router.delete("/:id", checkPermission("bookings", "delete"), deleteAgencyBooking);

module.exports = router;
