const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    project_name: { type: String, required: true, trim: true },
    rera_number: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    towers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tower"
      }
    ],
    units: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Unit"
      }
    ],

    project_status: {
      type: String,
      enum: ["planning", "under_construction", "ready_to_move", "completed"],
      default: "planning",
    },

    possession_date: { type: Date, default: null },

    description: { type: String, trim: true, default: "" },
    amenities: [{ type: String }],
    media: [
      {
        media_type: { type: String, enum: ["image", "video", "master_plan","document"] },
        label: { type: String, trim: true, default: "" },
        url: { type: String, required: true },
        sort_order: { type: Number, default: 0 },
      },
    ],

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

projectSchema.index({ tenant_id: 1, project_status: 1 });
projectSchema.index({ tenant_id: 1, project_name: 1 });

module.exports = mongoose.model("Project", projectSchema);