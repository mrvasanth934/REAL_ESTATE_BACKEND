const Tenant = require("../models/Tenant");
const { getSubscriptionState } = require("../utils/subscriptionState");

const requireActiveSubscription = async (req, res, next) => {
  try {
    const userRole = String(req.user?.role || "").toLowerCase();

    const isSuperAdmin =
      req.authUserType === "super_admin" ||
      userRole === "super_admin" ||
      userRole === "superadmin";

    // Super admin is never blocked
    if (isSuperAdmin) {
      return next();
    }

    const tenant = await Tenant.findById(req.tenantId).select(
      "subscription_status subscription_end_date"
    );

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found.",
      });
    }

    const state = await getSubscriptionState(tenant);

    req.subscriptionState = state;

    // ACTIVE → full access
    if (state === "active") {
      return next();
    }

    // GRACE → read-only
    if (state === "grace") {
      if (req.method === "GET") {
        return next();
      }

      return res.status(402).json({
        success: false,
        code: "SUBSCRIPTION_GRACE_READONLY",
        message:
          "Your subscription has expired. You're in the grace period — read-only access only.",
      });
    }

    // BLOCKED → no data access
    return res.status(402).json({
      success: false,
      code: "SUBSCRIPTION_EXPIRED",
      message: "Subscription expired. Please renew your plan to continue.",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  requireActiveSubscription,
};