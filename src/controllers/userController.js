const SuperAdmin = require("../models/SuperAdmin");
const User = require("../models/User");

const getUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      tenant_id: req.user.tenant_id,
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getUsers = async (req, res) => {
  try {
    let query = {};

    if (req.tenantId) {
      query.tenant_id = req.tenantId;
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

const createUser = async (req, res) => {
  try {

    const { name, username, email, phone, password, role } = req.body;

    if (!name || !username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, username, email, password and role are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const validRoles = [
      "admin",
      "manager",
      "agent",
      "accountant",
    ];

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { username: username.toLowerCase().trim() },
        { email: email.toLowerCase().trim() },
      ],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username or email already taken.",
      });
    }

    let tenantId;

    if (req.user.role === "super_admin") {
      if (!req.body.tenant_id) {
        return res.status(400).json({
          success: false,
          message: "tenant_id is required",
        });
      }

      tenantId = req.body.tenant_id;
    } else {
      tenantId = req.user.tenant_id;
    }

    const newUser = await User.create({
      name: name.trim(),
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      phone: phone || "",
      password,
      role,
      tenant_id: tenantId,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      user: newUser.toJSON(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

/* =========================
   UPDATE USER
========================= */
const updateUser = async (req, res) => {
  try {
    console.log("body", req.body);
    console.log("params", req.params);
    console.log("req.tenant", req.tenantId);

    if (req.body.email != '') {
      const account = await User.findOne({ email: req.body.email })
      if (!account) {
        const account = await SuperAdmin.findOne({ email: req.body.email })
        if (account) {
          return res.status(200).json({
            success: false,
            message: "User already Exisit by the email"
          })
        }
      }
      return res.status(200).json({
        success: false,
        message: "User already Exisit by the email"
      })
    }

    if (req.body.username != '') {
      const account = await User.findOne({ username: req.body.username })
      if (!account) {
        const account = await SuperAdmin.findOne({ email: req.body.username })
        if (account) {
          return res.status(200).json({
            success: false,
            message: "User already Exisit by the Username"
          })
        }
      }
      return res.status(200).json({
        success: false,
        message: "User already Exisit by the Username"
      })
    }

    const user = await User.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or access denied.",
      });
    }
    const allowedFields = ["name", "phone", "role", "isActive", "email", "username", "avatar"];
    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (updateData.role) {
      const validRoles = [
        "admin",
        "tenant_owner",
        "manager",
        "agent",
        "accountant",
      ];
      if (!validRoles.includes(updateData.role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
        });
      }
    }
    if (updateData.email == '') {
      updateData.email = user.email
    }
    if (updateData.username == '') {
      updateData.username = user.username
    }
    if (updateData.phone == '') {
      updateData.phone = user.phone
    }
    delete req.body.tenant_id;

    Object.assign(user, updateData);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User updated successfully.",
      user: user.toJSON(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || error.response.data.message,
    });
  }
};

/* =========================
   DELETE USER (SOFT)
========================= */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or access denied.",
      });
    }

    if (user.role === "admin" || user.role === "tenant_owner") {
      return res.status(403).json({
        success: false,
        message: "Cannot delete the tenant admin/owner account.",
      });
    }

    user.isActive = false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User deactivated successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

/* =========================
   UPDATE PASSWORD
========================= */
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    }).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password incorrect.",
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

/* =========================
   GET USER SECURITY (2FA, active sessions, login history)
   Used by super_admin (with x-tenant-id) to view a tenant's owner,
   or by a tenant user viewing their own record.
========================= */
const getUserSecurity = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.tenantId) query.tenant_id = req.tenantId;

    const user = await User.findOne(query).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or access denied.",
      });
    }

    const activeSessions = (user.deviceSession || [])
      .filter((s) => s.isActive)
      .sort((a, b) => new Date(b.lastLoginAt) - new Date(a.lastLoginAt));

    const loginHistory = [...(user.loginHistory || [])].sort(
      (a, b) => new Date(b.time) - new Date(a.time)
    );

    return res.status(200).json({
      success: true,
      twoFactorEnabled: !!user.twoFactorEnabled,
      activeSessions,
      loginHistory,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/* =========================
   TOGGLE TWO-FACTOR AUTH
========================= */
const toggleTwoFactor = async (req, res) => {
  try {
    const { enabled } = req.body;
    const query = { _id: req.params.id };
    if (req.tenantId) query.tenant_id = req.tenantId;

    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or access denied.",
      });
    }

    user.twoFactorEnabled = !!enabled;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: `Two-factor authentication ${enabled ? "enabled" : "disabled"}.`,
      twoFactorEnabled: user.twoFactorEnabled,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/* =========================
   LOGOUT A SINGLE SESSION
========================= */
const logoutUserSession = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.tenantId) query.tenant_id = req.tenantId;

    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or access denied.",
      });
    }

    const session = user.deviceSession?.id(req.params.sessionId);
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found." });
    }

    session.isActive = false;
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json({ success: true, message: "Session logged out." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/* =========================
   LOGOUT ALL SESSIONS
========================= */
const logoutAllUserSessions = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.tenantId) query.tenant_id = req.tenantId;

    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or access denied.",
      });
    }

    (user.deviceSession || []).forEach((session) => {
      session.isActive = false;
    });
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json({ success: true, message: "Logged out from all devices." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getUserByRoleAndTenantID = async (req, res) => {
  try {
    const { role, tenant_id } = req.params
    const user = await User.findOne({ role, tenant_id })
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "can`t get user"
      })
    }
    return res.status(200).json({
      success: true,
      message: "user fetched",
      user
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error
    })
  }
}

const createTenantOwner = async (req, res) => {
  try {
    const { tenant_id, name, username, email, phone, password } = req.body;

    const user = await User.create({
      name,
      username,
      email,
      phone,
      password,
      role: "tenant_owner",
      tenant_id,
    });

    return res.status(201).json({
      success: true,
      user,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const changeAvatar = async (req, res) => {
  try {
    const { avatar, user_id } = req.body
    if (!avatar) {
      return res.status(400).json({
        success: false,
        message: "choose avatar"
      })
    }
    const response = await User.updateOne({ _id: user_id }, { avatar })
    if (!response) {
      return res.status(400).json({
        success: false,
        message: "can`t update avatar"
      })
    }
    return res.status(200).json({
      success: true,
      message: "avatar Updated"
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

const deactivateUser = async (req, res) => {
  try {
    const { user_id } = req.body
    const response = await User.updateOne({ _id: user_id }, { isActive: false })
    if (!response) {
      return res.status(400).json({
        success: false,
        message: "can`t update user"
      })
    }
    return res.status(200).json({
      success: true,
      message: "User deActivated"
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/* =========================
   EXPORTS
========================= */
module.exports = {
  getUser,
  getUsers,
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
  deactivateUser
};
