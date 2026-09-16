const PlatformSettings = require("../models/PlatformSettings");

async function getSubscriptionState(tenant) {
  const now = new Date();
  const endDate = tenant.subscription_end_date;

  // No subscription end date
  if (!endDate) {
    return "blocked";
  }

  // Subscription still active
  if (
    new Date(endDate) > now &&
    ["active", "trial"].includes(tenant.subscription_status)
  ) {
    return "active";
  }

  // Get platform-wide grace period
  const settings = (await PlatformSettings.findOne()) || {};
  const graceDays = settings.grace_period_days ?? 7;

  // Calculate grace end date
  const graceEnd = new Date(endDate);
  graceEnd.setDate(graceEnd.getDate() + graceDays);

  // Still inside grace period
  if (now <= graceEnd) {
    return "grace";
  }

  // Grace period also over
  return "blocked";
}

module.exports = {
  getSubscriptionState,
};