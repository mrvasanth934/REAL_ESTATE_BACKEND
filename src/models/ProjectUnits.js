const mongoose = require("mongoose");

const projectUnitSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    tower_name: { type: String, trim: true, default: "" },
    floor_no: { type: String, trim: true, default: "" },
    unit_no: { type: String, required: true, trim: true },

    unit_type: {
      type: String,
      enum: ["1BHK", "2BHK", "3BHK", "4BHK", "villa", "plot", "office", "shop"],
      required: true,
    },

    area_sqft: { type: Number, default: null },
    base_price: { type: Number, required: true },

    status: {
      type: String,
      enum: ["available", "booked", "sold", "blocked"],
      default: "available",
    },

    // set only when this unit is converted into a standalone marketable Property listing
    linked_property_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
  },
  { timestamps: true }
);

projectUnitSchema.index({ tenant_id: 1, project_id: 1, status: 1 });
projectUnitSchema.index({ tenant_id: 1, project_id: 1, unit_no: 1 }, { unique: true });

module.exports = mongoose.model("ProjectUnit", projectUnitSchema);