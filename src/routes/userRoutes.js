const express = require("express");
const router = express.Router();

const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updatePassword,
  createTenantOwner,
  getUserSecurity,
  toggleTwoFactor,
  logoutUserSession,
  logoutAllUserSessions,
  getUserByRoleAndTenantID,
  changeAvatar,
  deactivateUser,
} = require("../controllers/userController");

const {
  protect,
  tenantScope,
  authorize,
} = require("../middleware/authMiddleware");
const {
  requireActiveSubscription,
} = require("../middleware/subscriptionMiddleware");
const checkPermission = require("../middleware/checkPermission");

router.use(protect);
router.use(tenantScope);
router.use(requireActiveSubscription);

router.get("/", getUsers);
router.get("/:id", getUser);

router.post(
  "/",
  authorize("super_admin", "admin", "tenant_owner", "manager"),
  checkPermission("users", "create"),
  createUser,
);

router.patch(
  "/:id",
  authorize("super_admin", "admin", "tenant_owner", "manager"),
  checkPermission("users", "edit"),
  updateUser,
);

router.delete(
  "/:id",
  authorize("super_admin", "admin", "tenant_owner"),
  checkPermission("users", "delete"),
  deleteUser,
);

router.patch("/:id/password", checkPermission("users", "edit"), updatePassword);

router.get("/:id/security", getUserSecurity);
router.patch(
  "/:id/two-factor",
  checkPermission("users", "edit"),
  toggleTwoFactor,
);
router.post("/:id/sessions/:sessionId/logout", logoutUserSession);
router.post("/:id/sessions/logout-all", logoutAllUserSessions);
router.get(
  "/:role/:tenant_id",
  getUserByRoleAndTenantID,
);
router.put("/change-avatar", checkPermission("users", "edit"), changeAvatar);
router.put("/deactivate", checkPermission("users", "edit"), deactivateUser);

router.post(
  "/create-tenant-owner",
  authorize("super_admin"),
  createTenantOwner,
);

module.exports = router;
