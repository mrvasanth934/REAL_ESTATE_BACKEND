const express = require("express");
const router = express.Router();

const {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  addPropertyMedia,
  loadPropertyForMedia,
  uploadDraftMedia,
  createPropertyOwner,
  getPropertyOwners,
  getPropertyOwnerById,
  updatePropertyOwner,
  deletePropertyOwner,
  loadOwnerForMedia,
  addOwnerMedia,
  getPropertyByIds,
  deletePropertyMedia,
  updatePropertyMedia,
  getAllPropertyMedia,
} = require("../controllers/propertyController");

const { protect, tenantScope } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/checkPermission");
const {
  draftUploader,
  scopedUploader,
  ownerUploader,
} = require("../middleware/uploadMedia");
const { uploadPropertyMedia } = require("../middleware/upload");
const {
  requireActiveSubscription,
} = require("../middleware/subscriptionMiddleware");

router.use(protect, tenantScope, requireActiveSubscription);

router.get("/", checkPermission("rentalproperties", "view"), getProperties);
router.get(
  "/owners/list",
  checkPermission("rentalproperties", "view"),
  getPropertyOwners,
);
router.get(
  "/owners/:id",
  checkPermission("rentalproperties", "view"),
  getPropertyOwnerById,
);
router.get(
  "/getbasedontenant",
  checkPermission("rentalproperties", "view"),
  getPropertyByIds,
);
router.get(
  "/media/all",
  getAllPropertyMedia,
);
router.get("/:id", getPropertyById);
router.post(
  "/",
  checkPermission("rentalproperties", "create"),
  uploadPropertyMedia.single("propertyImage"),
  createProperty,
);
router.patch(
  "/:id",
  checkPermission("rentalproperties", "edit"),
  updateProperty,
);
router.delete(
  "/:id",
  checkPermission("rentalproperties", "delete"),
  deleteProperty,
);
router.post(
  "/media/upload",
  checkPermission("rentalproperties", "create"),
  draftUploader.array("files", 10),
  uploadDraftMedia,
);
router.post(
  "/:id/media",
  checkPermission("rentalproperties", "edit"),
  loadPropertyForMedia,
  scopedUploader.array("files", 10),
  addPropertyMedia,
);
router.patch(
  "/:id/media/:mediaId",
  checkPermission("rentalproperties", "edit"),
  updatePropertyMedia,
);
router.delete(
  "/:id/media/:mediaId",
  checkPermission("rentalproperties", "edit"),
  deletePropertyMedia,
);
router.post(
  "/owners",
  checkPermission("rentalproperties", "create"),
  createPropertyOwner,
);
router.patch(
  "/owners/:id",
  checkPermission("rentalproperties", "edit"),
  updatePropertyOwner,
);
router.delete(
  "/owners/:id",
  checkPermission("rentalproperties", "delete"),
  deletePropertyOwner,
);
router.post(
  "/owners/:id/media",
  checkPermission("rentalproperties", "edit"),
  loadOwnerForMedia,
  ownerUploader.array("files", 10),
  addOwnerMedia,
);

module.exports = router;
