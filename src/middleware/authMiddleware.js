const jwt = require("jsonwebtoken");
const User = require("../models/User");
const SuperAdmin = require("../models/SuperAdmin");

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized. No token." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user = null;

    if (decoded.userType === "super_admin") {
      user = await SuperAdmin.findById(decoded.id);
    } else {
      user = await User.findById(decoded.id);
    }

    if (!user) {
      user =
        (await User.findById(decoded.id)) ||
        (await SuperAdmin.findById(decoded.id));
    }

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ success: false, message: "User not found or inactive." });
    }

    req.user = user;
    req.authUserType = decoded.userType || "tenant_user";
    next();
  } catch (error) {
    console.log("err 1", error);
    return res
      .status(401)
      .json({ success: false, message: "Token invalid or expired." });
  }
};

const isSuperAdmin = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();

  const allowed =
    req.authUserType === "super_admin" ||
    role === "super_admin" ||
    role === "superadmin";

  if (allowed) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. Super Admin only.",
  });
};
const tenantScope = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();

  const isSuperAdmin =
    req.authUserType === "super_admin" ||
    role === "super_admin" ||
    role === "superadmin";

  if (isSuperAdmin) {
    req.tenantId = req.headers["x-tenant-id"] || null;
    return next();
  }

  if (!req.user?.tenant_id) {
    return res.status(403).json({
      success: false,
      message: "User must belong to a tenant.",
    });
  }

  req.tenantId = req.user.tenant_id;

  next();
};

// Role-based access check
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
    }
    next();
  };
};

module.exports = { protect, isSuperAdmin, tenantScope, authorize };
