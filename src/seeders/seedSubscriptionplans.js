const mongoose = require("mongoose");
const SubscriptionPlan = require("../models/SubscriptionPlan");
require("dotenv").config();

const defaultPlans = [
  {
    plan_name: "Starter Plan", description: "Basic features for small teams",
    price_monthly: 999, price_yearly: 9990, duration_days: 30, trial_days: 15,
    max_users: 5, storage_gb: 2, limits: { max_properties: 200 }, status: "active",
  },
  {
    plan_name: "Professional Plan", description: "Advanced features for growing business",
    price_monthly: 2999, price_yearly: 29990, duration_days: 30, trial_days: 15,
    max_users: 20, storage_gb: 20, limits: { max_properties: 2000 }, status: "active",
  },
  {
    plan_name: "Enterprise Plan", description: "Unlimited access with priority support",
    price_monthly: 7999, price_yearly: 79990, duration_days: 30, trial_days: 30,
    max_users: null, storage_gb: 100, limits: { max_properties: null }, status: "active",
  },
  {
    plan_name: "Custom Plan", description: "Custom plan for specific tenants",
    is_custom: true, duration_days: 30, max_users: null, storage_gb: null,
    limits: {}, status: "inactive",
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  for (const plan of defaultPlans) {
    await SubscriptionPlan.findOneAndUpdate({ plan_name: plan.plan_name }, plan, { upsert: true, new: true });
  }
  console.log("Subscription plans seeded.");
  process.exit(0);
}
seed().catch((err) => { console.error(err); process.exit(1); });