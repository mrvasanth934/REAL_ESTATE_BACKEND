const RolePremission = require("../models/RolePremission");

// action: "view" | "create" | "edit" | "delete"
const checkPermission = (moduleName, action) => {
  return async (req, res, next) => {
    try {
      const role = req.user?.role;
      const tenant_id = req.tenantId;

      console.log("tenant_id : ", req.tenantId);
      console.log("role : ", role);

      // Super Admin -> full access
      if (role === "super_admin") {
        return next();
      }

      if (!role || !tenant_id) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Missing role or tenant context.",
        });
      }

      const fieldMap = {
        view: "can_view",
        create: "can_create",
        edit: "can_edit",
        delete: "can_delete",
      };

      const field = fieldMap[action];

      if (!field) {
        return res.status(500).json({
          success: false,
          message: "Invalid permission action configured.",
        });
      }

      // 1. Tenant-specific permission
      let permission = await RolePremission.findOne({
        tenant_id,
        role,
      });

      const result = permission?.module?.find((v) => {
        return v.name.toLowerCase() === moduleName.toLowerCase();
      });

      if (!result[field]) {
        return res.status(403).json({
          success: false,
          message: `Access denied. No permission configured for '${moduleName}'.`,
        });
      }

      const modulePermission = permission.module.find(
        (item) => item.name?.toLowerCase() === moduleName?.toLowerCase(),
      );

      if (!modulePermission?.[field]) {
        return res.status(403).json({
          success: false,
          message: `Access denied. No '${action}' permission on '${moduleName}'.`,
        });
      }

      return next();
    } catch (err) {
      console.error("Permission middleware error:", err);

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };
};

module.exports = checkPermission;
