const mongoose = require("mongoose");

const ModuleItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    enabled: { type: Boolean, default: true },
    mandatory: { type: Boolean, default: false },
    group: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const TenantOverrideSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    tenantName: { type: String, required: true },
    overrides: {
      propertyMedia: { type: Boolean, default: false },
      brokerage: { type: Boolean, default: false },
      reports: { type: Boolean, default: false },
    },
  },
  { _id: false },
);

const ModuleControlSchema = new mongoose.Schema(
  {
    businessType: {
      type: String,
      enum: ["Agency", "Builder", "Rental Agent"],
      required: true,
      unique: true,
    },
    modules: [ModuleItemSchema],
    tenantOverrides: [TenantOverrideSchema],
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedByName: { type: String, default: "" },
    updateReason: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ModuleControl", ModuleControlSchema);
