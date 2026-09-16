const mongoose = require("mongoose");

const subscriptionPlanSchema = new mongoose.Schema(
  {
    plan_name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: "" },

    applicable_business_types: [
      { type: String, enum: ["agency", "builder", "rental_agent"] },
    ],

    is_custom: { type: Boolean, default: false },
    price_monthly: { type: Number, default: null },
    price_yearly: { type: Number, default: null },

    duration_days: { type: Number, required: true, default: 30 },
    trial_days: { type: Number, default: 0 },

    max_users: { type: Number, default: null },
    storage_gb: { type: Number, default: null },

    limits: {
      max_properties: { type: Number, default: null },
      max_projects: { type: Number, default: null },
      max_units: { type: Number, default: null },
      max_rental_properties: { type: Number, default: null },
      max_leases: { type: Number, default: null },
    },

    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
