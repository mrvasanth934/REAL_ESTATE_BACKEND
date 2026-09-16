const mongoose = require("mongoose");

const towerSchema = new mongoose.Schema(
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
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    tower_name: {
      type: String,
      required: true,
      trim: true,
    },
    tower_code: {
      type: String,
      trim: true,
      default: "",
    },
    tower_type: {
      type: String,
      enum: ["Residential", "Commercial", "Mixed"],
      default: "Residential",
    },
    tower_status: {
      type: String,
      enum: ["Active", "Inactive", "Completed", "On Hold"],
      default: "Active",
    },

    total_floors: {
      type: Number,
      default: 0,
    },
    units:[
      {
        type:mongoose.Schema.Types.ObjectId,
        ref:"Unit"
      }
    ],
    configuration: {
      type: String,
      trim: true,
      default: "",
    },
    // available_units: {
    //   type: Number,
    //   default: 0,
    // },
    // booked_units: {
    //   type: Number,
    //   default: 0,
    // },
    // sold_units: {
    //   type: Number,
    //   default: 0,
    // },
    start_date: {
      type: Date,
      default: null,
    },
    expected_completion_date: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },

    amenities: [{ type: String }],
    image_url: {
      type: String,
      default: "", 
    },
  },
  { timestamps: true },
);
towerSchema.index({ tenant_id: 1, project_id: 1 });
towerSchema.index({ tenant_id: 1, tower_status: 1 });

module.exports = mongoose.model("Tower", towerSchema);
