const mongoose = require("mongoose");

const unitSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
    },
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project ID is required"],
    },
    tower_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tower",
    },
    floor_no: {
      type: String,
      trim: true,
    },
    unit_no: {
      type: String,
      required: [true, "Unit Number is required"],
      trim: true,
    },
    unit_type: {
      type: String,
      enum: ["1BHK", "2BHK", "3BHK", "villa", "plot"],
      default: "2BHK",
    },
    area_sqft: {
      type: Number,
      min: 0,
    },
    base_price: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ["available", "booked", "sold", "blocked", "maintenance"],
      default: "available",
    },
    owner_name: {
      type: String,
      trim: true,
      default: "",
    },
    linked_property_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Unit", unitSchema);
