const mongoose = require("mongoose");

const ModuleControlAuditSchema = new mongoose.Schema(
  {
    businessType: {
      type: String,
      enum: ["Agency", "Builder", "Rental Agent"],
      required: true,
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },

    tenantName: {
      type: String,
      default: "",
    },

    action: {
      type: String,
      enum: ["ENABLE", "DISABLE", "OVERRIDE", "RESET", "UPDATE"],
      required: true,
    },

    moduleKey: {
      type: String,
      default: "",
    },

    moduleName: {
      type: String,
      default: "",
    },

    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedByName: {
      type: String,
      default: "",
    },

    reason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.ModuleControlAudit ||
  mongoose.model("ModuleControlAudit", ModuleControlAuditSchema);
