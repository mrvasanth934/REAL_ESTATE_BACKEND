const mongoose = require("mongoose");

const modulePermissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    can_view: {
      type: Boolean,
      default: false,
    },
    can_edit: {
      type: Boolean,
      default: false,
    },
    can_create: {
      type: Boolean,
      default: false,
    },
    can_delete: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const rolePermissionSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
      index: true,
    },

    role: {
      type: String,
      enum: [
        "super_admin",
        "admin",
        "tenant_owner",
        "manager",
        "agent",
        "accountant",
      ],
      required: true,
    },

    module: {
      type: [modulePermissionSchema],
      default: [],
    },
  },
  { timestamps: true },
);

// One permission document per tenant + role
rolePermissionSchema.index({ tenant_id: 1, role: 1 }, { unique: true });

module.exports = mongoose.model("RolePermission", rolePermissionSchema);
