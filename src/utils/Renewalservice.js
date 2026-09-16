const Invoice = require("../models/Invoice");

const DAY_MS = 24 * 60 * 60 * 1000;

// Works out each tenant's current expiry purely from their invoice history:
// take the most recent PAID invoice, add the plan's duration_days (falling
// back to 30/365 based on billing_cycle if the plan was deleted or custom).
//
// If you already track expiry_date directly on the Tenant model from your
// subscription module, prefer that — it's simpler and won't drift if an
// invoice gets edited manually. This is the fallback that needs nothing else.
async function computeRenewals({ windowDays = 30 } = {}) {
  const latestPaidPerTenant = await Invoice.aggregate([
    { $match: { status: "paid" } },
    { $sort: { billing_date: -1 } },
    {
      $group: {
        _id: "$tenant_id",
        invoiceId: { $first: "$_id" },
        plan_id: { $first: "$plan_id" },
        plan_name: { $first: "$plan_name" },
        total_amount: { $first: "$total_amount" },
        billing_date: { $first: "$billing_date" },
        billing_cycle: { $first: "$billing_cycle" },
      },
    },
    {
      $lookup: {
        from: "subscriptionplans",
        localField: "plan_id",
        foreignField: "_id",
        as: "plan",
      },
    },
    { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "tenants",
        localField: "_id",
        foreignField: "_id",
        as: "tenant",
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
  ]);

  const now = Date.now();

  const renewals = latestPaidPerTenant.map((row) => {
    const durationDays = row.plan?.duration_days || (row.billing_cycle === "yearly" ? 365 : 30);

    const expiryDate = new Date(row.billing_date.getTime() + durationDays * DAY_MS);
    const daysLeft = Math.ceil((expiryDate.getTime() - now) / DAY_MS);

    let status = "Upcoming";
    if (daysLeft < 0) status = "Expired";
    else if (daysLeft <= 7) status = "Expiring Soon";

    return {
      tenant_id: row._id,
      tenant: row.tenant?.name || row.tenant?.company_name || "Unknown tenant",
      plan: row.plan_name,
      expiry: expiryDate,
      daysLeft,
      amount: row.total_amount,
      status,
    };
  });

  // Only return what's actually relevant to the Renewals tab: already
  // expired, or expiring within the requested window.
  return renewals.filter((r) => r.daysLeft <= windowDays);
}

module.exports = { computeRenewals };