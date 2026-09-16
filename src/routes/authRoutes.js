const express = require("express");
const router = express.Router();
const {
  checkSetup,
  setupSuperAdmin,
  login,
  getMe,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  getMySecurity,
  toggleMyTwoFactor,
  logoutMySession,
  logoutAllMySessions,
  verifyEmailAddress,
} = require("../controllers/authController");
const {
  protect,
  isSuperAdmin,
  tenantScope,
} = require("../middleware/authMiddleware");
const {
  requireActiveSubscription,
} = require("../middleware/subscriptionMiddleware");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const { createNotification } = require("../controllers/notificationController");
const {
  createRolePermission,
  getRolePermission,
  updateRolePermission,
  getRolePermissionById,
} = require("../controllers/rolePermissionController");
const checkPermission = require("../middleware/checkPermission");

router.get("/check-setup", checkSetup);
router.post("/setup", setupSuperAdmin);
router.post("/login", login);
router.post("/verify-otp", verifyEmailAddress);
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);
router.post(
  "/change_password",
  checkPermission("users", "edit"),
  changePassword,
);
router.post(
  "/forgot-password",
  checkPermission("users", "edit"),
  forgotPassword,
);
router.post(
  "/reset-password/:id/:token",
  checkPermission("users", "edit"),
  resetPassword,
);

// Self security (works for the logged-in account: tenant user OR super admin)
router.get("/security", protect, getMySecurity);
router.patch(
  "/two-factor",
  protect,
  checkPermission("users", "edit"),
  toggleMyTwoFactor,
);
router.post("/sessions/:sessionId/logout", protect, logoutMySession);
router.post("/sessions/logout-all", protect, logoutAllMySessions);
router.get("/google", (req, res, next) => {
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    state: req.query.state,
  })(req, res, next);
});
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=google_login_failed`,
  }),
  async (req, res) => {
    const { user, userType, deviceInfo, currentTime } = req.user;

    const deviceName =
      deviceInfo?.deviceName || deviceInfo?.browser || "Unknown Device";
    const osName = deviceInfo?.operatingSystem
      ? ` (${deviceInfo.operatingSystem})`
      : "";

    const formattedTime = (currentTime || new Date()).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const notificationTitle = "New Login Detected (Google)";
    const notificationMessage = `Your account was logged in via Google from ${deviceName}${osName} on ${formattedTime}.`;

    try {
      await createNotification(
        user.role === "super_admin" ? "" : user._id,
        user.role,
        notificationTitle,
        notificationMessage,
      );
    } catch (err) {
      console.error("Failed to send Google login notification:", err);
    }

    // 2. JWT Generation
    const token = jwt.sign({ id: user._id, userType }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    return res.redirect(
      `${frontendUrl}/auth/google/callback?token=${encodeURIComponent(token)}`,
    );
  },
);
router.post("/create-permission", protect, tenantScope, createRolePermission);
router.get("/getallpermission", getRolePermission);
router.put("/update/:role", protect, tenantScope, updateRolePermission);
router.get("/getrolesbyid", protect, tenantScope, getRolePermissionById);

module.exports = router;
