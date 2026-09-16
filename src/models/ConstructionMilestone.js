const mongoose = require("mongoose");

const constructionMilestoneSchema = new mongoose.Schema(
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
    tower_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tower",
      required: true,
      index: true,
    },
    milestone_name: { type: String, required: true, trim: true }, // e.g. "Foundation", "Slab 3"
    planned_date: { type: Date, default: null },
    actual_date: { type: Date, default: null },

    status: {
      type: String,
      enum: ["pending", "in progress", "completed", "delayed"],
      default: "pending",
    },

    // % of total payment linked to this milestone — stored for future Finance module use,
    // not used for any calculation yet (loose coupling, see architecture notes)
    payment_trigger_pct: { type: Number, min: 0, max: 100, default: 0 },

    sort_order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

constructionMilestoneSchema.index({
  tenant_id: 1,
  project_id: 1,
  sort_order: 1,
});

module.exports = mongoose.model(
  "ConstructionMilestone",
  constructionMilestoneSchema,
);
