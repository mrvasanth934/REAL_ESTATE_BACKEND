const User = require("../models/User");
const Property = require("../models/Property");
const Lead = require("../models/Lead");
const Booking = require("../models/Booking");
const Invoice = require("../models/Invoice");

// GET /api/subscription-plans/my-subscription — tenant's own plan + live usage
exports.getMySubscription = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    if (!tenant_id) {
      return res.status(400).json({ success: false, message: "Tenant context required." });
    }

    const tenant = await Tenant.findById(tenant_id);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found." });

    const allPlans = await SubscriptionPlan.find({ status: "active" }).sort({ price_monthly: 1 });
    const currentPlan = allPlans.find((p) => p.plan_name.toLowerCase() === tenant.subscription_plan?.toLowerCase()) || null;

    const [userCount, propertyCount, leadCount, bookingCount, brokerageAgg] = await Promise.all([
      User.countDocuments({ tenant_id }),
      Property.countDocuments({ tenant_id }),
      Lead.countDocuments({ tenant_id }),
      Booking.countDocuments({ tenant_id }),
      Booking.aggregate([{ $match: { tenant_id: tenant._id } }, { $group: { _id: null, total: { $sum: "$brokerage_amount" } } }]),
    ]);

    res.json({
      success: true,
      data: {
        tenant: {
          business_name: tenant.business_name,
          subscription_status: tenant.subscription_status,
          subscription_end_date: tenant.subscription_end_date,
        },
        current_plan: currentPlan,
        all_plans: allPlans,
        usage: {
          users: userCount,
          properties: propertyCount,
          leads: leadCount,
          bookings: bookingCount,
          brokerage_total: brokerageAgg[0]?.total || 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// GET /api/subscription-plans/my-invoices — tenant's billing history
exports.getMyInvoices = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const invoices = await Invoice.find({ tenant_id }).sort({ billing_date: -1 }).limit(20);
    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/subscription-plans/auto-renewal — toggle auto-renewal for the tenant
exports.updateAutoRenewal = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { auto_renewal } = req.body;
    await Tenant.findByIdAndUpdate(tenant_id, { auto_renewal: !!auto_renewal });
    res.json({ success: true, message: "Auto-renewal preference updated." });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/subscription-plans/change-plan — tenant requests a plan change
exports.changePlan = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { plan_id } = req.body;

    const plan = await SubscriptionPlan.findById(plan_id);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found." });
    if (plan.status !== "active") return res.status(400).json({ success: false, message: "This plan is not currently available." });

    await Tenant.findByIdAndUpdate(tenant_id, { subscription_plan: plan.plan_name.toLowerCase() });
    res.json({ success: true, message: `Plan changed to ${plan.plan_name}.` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};