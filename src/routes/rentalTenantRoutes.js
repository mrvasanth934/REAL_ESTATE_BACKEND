const express = require("express");
const router = express.Router();

const {
  getRentalTenants,
  getRentalTenantById,
  createRentalTenant,
  updateRentalTenant,
  deleteRentalTenant,
} = require("../controllers/rentalTenantController");

const { protect, tenantScope } = require("../middleware/authMiddleware");
const { createBankAccount } = require("../controllers/bankAccountController");
const {
  requireActiveSubscription,
} = require("../middleware/subscriptionMiddleware");

router.use(protect, tenantScope);

router.get("/", getRentalTenants);
router.get("/:id", getRentalTenantById);
router.post("/", createRentalTenant,createBankAccount);
router.patch("/:id", updateRentalTenant);
router.delete("/:id", deleteRentalTenant);

module.exports = router;
