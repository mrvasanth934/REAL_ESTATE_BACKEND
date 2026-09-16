const express = require("express");
const router = express.Router();
const rentalCollectionController = require("../controllers/RentalCollectionController");
const checkPermission = require("../middleware/checkPermission");

router.post(
  "/create",
  checkPermission("rentcollection", "create"),
  rentalCollectionController.createRentalCollection,
);

router.get(
  "/",
  checkPermission("rentcollection", "view"),
  rentalCollectionController.getAllRentalCollections,
);

router.get(
  "/:id",
  checkPermission("rentcollection", "view"),
  rentalCollectionController.getRentalCollectionById,
);

router.put(
  "/update/:id",
  checkPermission("rentcollection", "edit"),
  rentalCollectionController.updatePaymentStatus,
);

router.delete(
  "/:id",
  checkPermission("rentcollection", "delete"),
  rentalCollectionController.deleteRentalCollection,
);

module.exports = router;
