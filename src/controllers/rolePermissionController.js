const RolePermission = require("../models/RolePremission");

// CREATE role permission
exports.createRolePermission = async (req, res) => {
  try {
    const { role, module } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }

    if (!module || !Array.isArray(module)) {
      return res.status(400).json({
        success: false,
        message: "Module must be an array",
      });
    }

    // Check if permission already exists
    const existingPermission = await RolePermission.findOne({
      tenant_id: req.tenantId || null,
      role,
    });

    if (existingPermission) {
      return res.status(409).json({
        success: false,
        message: "Permission already exists for this tenant and role",
      });
    }

    const permission = await RolePermission.create({
      tenant_id: req.tenantId || null,
      role,
      module,
    });

    return res.status(201).json({
      success: true,
      message: "Role permission created successfully",
      data: permission,
    });
  } catch (error) {
    console.error("Create Role Permission Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create role permission",
      error: error.message,
    });
  }
};

// GET all role permissions
exports.getRolePermissions = async (req, res) => {
  try {
    const permissions = await RolePermission.find()
      .populate("tenant_id", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: permissions.length,
      data: permissions,
    });
  } catch (error) {
    console.error("Get Role Permissions Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get role permissions",
      error: error.message,
    });
  }
};

// GET permission by ID
exports.getRolePermissionById = async (req, res) => {
  try {
    const permission = await RolePermission.find({
      tenant_id: req.tenantId,
    }).populate("tenant_id", "name");

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Role permission not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: permission,
    });
  } catch (error) {
    console.error("Get Role Permission Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get role permission",
      error: error.message,
    });
  }
};

// GET permission by tenant + role
exports.getRolePermission = async (req, res) => {
  try {
    const permission = await RolePermission.find().populate(
      "tenant_id",
      "name",
    );

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Role permission not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: permission,
    });
  } catch (error) {
    console.error("Get Role Permission Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get role permission",
      error: error.message,
    });
  }
};

exports.updateRolePermission = async (req, res) => {
  try {
    const { role } = req.params;
    const { module } = req.body;
    const tenant_id = req.tenantId;

    if (!module || !role || !tenant_id) {
      return res.status(500).json({
        success: false,
        message: "module, role and tenant_id is requried",
      });
    }

    const permission = await RolePermission.findOne({
      role: role,
      tenant_id: tenant_id,
    });

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Role permission not found",
      });
    }

    if (module !== undefined) {
      if (!Array.isArray(module)) {
        return res.status(400).json({
          success: false,
          message: "Module must be an array",
        });
      }

      permission.module = module;
    }

    await permission.save();

    return res.status(200).json({
      success: true,
      message: "Role permission updated successfully",
      data: permission,
    });
  } catch (error) {
    console.error("Update Role Permission Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update role permission",
      error: error.message,
    });
  }
};

// DELETE role permission
exports.deleteRolePermission = async (req, res) => {
  try {
    const { id } = req.params;

    const permission = await RolePermission.findByIdAndDelete(id);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Role permission not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Role permission deleted successfully",
    });
  } catch (error) {
    console.error("Delete Role Permission Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete role permission",
      error: error.message,
    });
  }
};
