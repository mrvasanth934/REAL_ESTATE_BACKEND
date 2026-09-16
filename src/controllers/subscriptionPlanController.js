const SubscriptionPlan = require("../models/SubscriptionPlan");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Property = require("../models/Property");
const Lead = require("../models/Lead");
// const Booking = require("../models/Booking");
const Invoice = require("../models/Invoice");
const PlatformSettings = require("../models/PlatformSettings");
 const Project = require("../models/Project");
const ProjectUnit = require("../models/ProjectUnits");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");
const axios = require("axios");
const { getSubscriptionState } = require("../utils/subscriptionState");
/* ===== CRUD ===== */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
console.log("RAZORPAY_KEY_ID loaded:", process.env.RAZORPAY_KEY_ID ? "yes" : "MISSING");
console.log("RAZORPAY_KEY_SECRET loaded:", process.env.RAZORPAY_KEY_SECRET ? "yes" : "MISSING");
exports.createPlan = async (req, res) => {
  try {
    const {
      plan_name, description, applicable_business_types,
      is_custom, price_monthly, price_yearly, duration_days, trial_days,
      max_users, storage_gb, limits, status,
    } = req.body;

    if (!plan_name?.trim()) {
      return res.status(400).json({ success: false, message: "Plan name is required." });
    }
    if (!is_custom) {
      if (price_monthly === null || price_monthly === undefined || price_monthly < 0) {
        return res.status(400).json({ success: false, message: "A valid monthly price is required for non-custom plans." });
      }
      if (price_yearly === null || price_yearly === undefined || price_yearly < 0) {
        return res.status(400).json({ success: false, message: "A valid yearly price is required for non-custom plans." });
      }
    }

    const plan = await SubscriptionPlan.create({
      plan_name: plan_name.trim(),
      description: description?.trim() || "",
      applicable_business_types: applicable_business_types || [],
      is_custom: !!is_custom,
      price_monthly: is_custom ? null : price_monthly,
      price_yearly: is_custom ? null : price_yearly,
      duration_days: duration_days || 30,
      trial_days: trial_days || 0,
      max_users: max_users ?? null,
      storage_gb: storage_gb ?? null,
      limits: {
        max_properties: limits?.max_properties ?? null,
        max_projects: limits?.max_projects ?? null,
        max_units: limits?.max_units ?? null,
        max_rental_properties: limits?.max_rental_properties ?? null,
        max_leases: limits?.max_leases ?? null,
      },
      status: status || "active",
    });

    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "A plan with this name already exists." });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ createdAt: 1 });
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPlanById = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      "plan_name", "description", "applicable_business_types", "is_custom",
      "price_monthly", "price_yearly", "duration_days", "trial_days",
      "max_users", "storage_gb", "status",
    ];
    const updateData = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    });

    if (req.body.limits) {
      updateData.limits = {
        max_properties: req.body.limits.max_properties ?? null,
        max_projects: req.body.limits.max_projects ?? null,
        max_units: req.body.limits.max_units ?? null,
        max_rental_properties: req.body.limits.max_rental_properties ?? null,
        max_leases: req.body.limits.max_leases ?? null,
      };
    }

    if (updateData.is_custom === true) {
      updateData.price_monthly = null;
      updateData.price_yearly = null;
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    res.json({ success: true, data: plan });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "A plan with this name already exists." });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    const inUseCount = await Tenant.countDocuments({ subscription_plan: plan.plan_name.toLowerCase() });
    if (inUseCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — ${inUseCount} tenant(s) are currently on this plan. Move them to another plan first.`,
      });
    }

    await SubscriptionPlan.findByIdAndDelete(id);
    res.json({ success: true, message: "Plan deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ===== Helper: build an invoice for a tenant + plan (used by both admin & tenant flows) ===== */

// async function generateInvoiceForPlan({ tenant_id, plan, reason }) {
//   const settings = (await PlatformSettings.findOne()) || {};
//   const cgstPct = settings.cgst_percent || 0;
//   const sgstPct = settings.sgst_percent || 0;

//   const amount = plan.is_custom ? 0 : plan.price_monthly;
//   const cgst_amount = Math.round((amount * cgstPct) / 100 * 100) / 100;
//   const sgst_amount = Math.round((amount * sgstPct) / 100 * 100) / 100;
//   const total_amount = Math.round((amount + cgst_amount + sgst_amount) * 100) / 100;

//   const count = await Invoice.countDocuments();
//   const prefix = settings.invoice_prefix || "INV";
//   const invoice_no = `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;

//   return Invoice.create({
//     tenant_id,
//     plan_id: plan._id,
//     invoice_no,
//     plan_name: plan.plan_name,
//     amount,
//     cgst_amount,
//     sgst_amount,
//     total_amount,
//     billing_date: new Date(),
//     reason,
//     status: "pending",
//   });
// }
function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getPlanAmount(plan, billing_cycle = "monthly") {
  if (plan.is_custom) return 0;

  return billing_cycle === "yearly"
    ? Number(plan.price_yearly || 0)
    : Number(plan.price_monthly || 0);
}

async function getNextInvoiceNumber() {
  const settings = (await PlatformSettings.findOne()) || {};
  const prefix = settings.invoice_prefix || "INV";

  const count = await Invoice.countDocuments();

  return `${prefix}-${new Date().getFullYear()}-${String(
    count + 1
  ).padStart(6, "0")}`;
}
/* ===== Tenant-facing subscription actions ===== */

exports.getMySubscription = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    if (!tenant_id) {
      return res.status(400).json({ success: false, message: "Tenant context required." });
    }

    const tenant = await Tenant.findById(tenant_id);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found." });


const test4 = await SubscriptionPlan.find({
  status: "active",
  applicable_business_types: { $size: 0 },
});

const allPlans = await SubscriptionPlan.find({
  status: "active",
  $or: [
    { applicable_business_types: tenant.business_type },
    { applicable_business_types: { $size: 0 } },
    { applicable_business_types: { $exists: false } },   // 👈 இது add பண்ணுங்க
  ],
}).sort({ price_monthly: 1 });
    const currentPlan = allPlans.find(
      (p) => p.plan_name.toLowerCase() === tenant.subscription_plan?.toLowerCase()
    ) || null;
    const subscriptionState = getSubscriptionState(tenant);

    const userCount = await User.countDocuments({ tenant_id });
    let usage = { users: userCount };

    // if (tenant.business_type === "agency") {
    //   usage.properties = await Property.countDocuments({ tenant_id });
    //   usage.leads = await Lead.countDocuments({ tenant_id });
    //   usage.bookings = await Booking.countDocuments({ tenant_id });
    //   const brokerageAgg = await Booking.aggregate([
    //     { $match: { tenant_id: tenant._id } },
    //     { $group: { _id: null, total: { $sum: { $ifNull: ["$brokerage_amount", 0] } } } },
    //   ]);
    //   usage.brokerage_total = brokerageAgg.length > 0 ? brokerageAgg[0].total : 0;
    // }
if (tenant.business_type === "agency") {
    usage.properties = await Property.countDocuments({ tenant_id });
    usage.leads = await Lead.countDocuments({ tenant_id });

    // Booking module not implemented
    usage.bookings = 0;
    usage.brokerage_total = 0;
}
    if (tenant.business_type === "builder") {
      try {
       
        usage.projects = await Project.countDocuments({ tenant_id });
        usage.units = await ProjectUnit.countDocuments({ tenant_id });
      } catch {
        usage.projects = 0;
        usage.units = 0;
      }
    }

    if (tenant.business_type === "rental_agent") {
      usage.rental_properties = 0;
      usage.leases = 0;
    }

    res.json({
      success: true,
      data: {
        tenant: {
          business_name: tenant.business_name,
          business_type: tenant.business_type,
          subscription_status: tenant.subscription_status,
          subscription_end_date: tenant.subscription_end_date,
          subscription_onboarded: tenant.subscription_onboarded, 
          auto_renewal: tenant.auto_renewal,
          createdAt: tenant.createdAt,
          subscription_state: subscriptionState,
        },
        current_plan: currentPlan,
        all_plans: allPlans,
        usage,
      },
    });
  } catch (err) {
    console.error("getMySubscription error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyInvoices = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const invoices = await Invoice.find({ tenant_id }).sort({ billing_date: -1 }).limit(20);
    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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
exports.createSubscriptionOrder = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { plan_id, billing_cycle = "monthly" } = req.body;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant context required.",
      });
    }

    if (!["monthly", "yearly"].includes(billing_cycle)) {
      return res.status(400).json({
        success: false,
        message: "Invalid billing cycle.",
      });
    }

    const [tenant, plan] = await Promise.all([
      Tenant.findById(tenant_id),
      SubscriptionPlan.findById(plan_id),
    ]);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found.",
      });
    }

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found.",
      });
    }

    if (plan.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "This plan is not currently available.",
      });
    }

    if (plan.is_custom) {
      return res.status(400).json({
        success: false,
        message: "Custom plans require contacting support.",
      });
    }

    const applicableTypes = plan.applicable_business_types || [];

    if (
      applicableTypes.length > 0 &&
      !applicableTypes.includes(tenant.business_type)
    ) {
      return res.status(400).json({
        success: false,
        message: "This plan is not available for your business type.",
      });
    }

    // const existingPending = await Invoice.findOne({
    //   tenant_id,
    //   plan_id: plan._id,
    //   billing_cycle,
    //   status: "pending",
    // });

    // if (existingPending) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "A pending invoice already exists for this plan.",
    //     data: existingPending,
    //   });
    // }
    const existingPending = await Invoice.findOne({
  tenant_id,
  plan_id: plan._id,
  billing_cycle,
  status: "pending",
});

if (existingPending?.razorpay_order_id) {
  try {
    const existingOrder = await razorpay.orders.fetch(
      existingPending.razorpay_order_id
    );

    if (
      existingOrder.status === "created" ||
      existingOrder.status === "attempted"
    ) {
      return res.status(200).json({
        success: true,
        message: "Existing payment order reused.",
        data: {
          invoice: existingPending,
          razorpay: {
            order_id: existingOrder.id,
            amount: existingOrder.amount,
            currency: existingOrder.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
          },
        },
      });
    }
  } catch (error) {
    console.error(
      "Existing Razorpay order fetch failed:",
      error.message
    );
  }
}

    const settings = (await PlatformSettings.findOne()) || {};
    const amount = getPlanAmount(plan, billing_cycle);

    const cgstPct = Number(settings.cgst_percent || 0);
    const sgstPct = Number(settings.sgst_percent || 0);

    const cgst_amount = roundMoney((amount * cgstPct) / 100);
    const sgst_amount = roundMoney((amount * sgstPct) / 100);
    const total_amount = roundMoney(
      amount + cgst_amount + sgst_amount
    );
      const invoice_no = await getNextInvoiceNumber();  
let order;
    try {
      const rzpRes = await axios.post(
        "https://api.razorpay.com/v1/orders",
        {
          amount: Math.round(total_amount * 100),
          currency: "INR",
          receipt: invoice_no,
          notes: {
            tenant_id: String(tenant_id),
            plan_id: String(plan._id),
            billing_cycle,
            invoice_no,
          },
        },
        {
          auth: {
            username: process.env.RAZORPAY_KEY_ID,
            password: process.env.RAZORPAY_KEY_SECRET,
          },
        }
      );
      order = rzpRes.data;
    } catch (rzpErr) {
      console.error("Razorpay order creation raw error:", rzpErr.response?.data || rzpErr.message);
      return res.status(502).json({
        success: false,
        message: rzpErr.response?.data?.error?.description || "Payment gateway error.",
      });
    }
    const reason =
      tenant.subscription_plan?.toLowerCase() ===
      plan.plan_name.toLowerCase()
        ? "renewal"
        : "upgrade";

    const invoice = await Invoice.create({
      tenant_id,
      plan_id: plan._id,
      invoice_no,
      plan_name: plan.plan_name,
      amount,
      cgst_amount,
      sgst_amount,
      total_amount,
      billing_date: new Date(),
      reason,
      status: "pending",
      billing_cycle,
      payment_method: "razorpay",
      payment_status: "created",
      razorpay_order_id: order.id,
    });

    return res.status(201).json({
      success: true,
      data: {
        invoice,
        razorpay: {
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
          key_id: process.env.RAZORPAY_KEY_ID,
        },
      },
    });
  } catch (err) {
    console.error("createSubscriptionOrder error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
exports.verifySubscriptionPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Incomplete Razorpay payment response.",
      });
    }

    const invoice = await Invoice.findOne({
      razorpay_order_id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    if (invoice.status === "paid") {
      return res.json({
        success: true,
        message: "Payment already verified.",
        data: invoice,
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${invoice.razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      invoice.status = "failed";
      invoice.payment_status = "failed";
      await invoice.save();

      return res.status(400).json({
        success: false,
        message: "Invalid payment signature.",
      });
    }

    const [tenant, plan] = await Promise.all([
      Tenant.findById(invoice.tenant_id),
      SubscriptionPlan.findById(invoice.plan_id),
    ]);

    if (!tenant || !plan) {
      return res.status(404).json({
        success: false,
        message: "Tenant or plan not found.",
      });
    }

    const now = new Date();

    const baseDate =
      tenant.subscription_end_date &&
      new Date(tenant.subscription_end_date) > now
        ? new Date(tenant.subscription_end_date)
        : now;

    const subscription_end_date = new Date(baseDate);
    subscription_end_date.setDate(
      subscription_end_date.getDate() + (plan.duration_days || 30)
    );

    invoice.status = "paid";
    invoice.payment_status = "captured";
    invoice.razorpay_payment_id = razorpay_payment_id;
    invoice.razorpay_signature = razorpay_signature;
    invoice.paid_at = new Date();

    await invoice.save();

    await Tenant.findByIdAndUpdate(tenant._id, {
      subscription_plan: plan.plan_name.toLowerCase(),
      subscription_status: "active",
      subscription_end_date,
    });

    return res.json({
      success: true,
      message: "Payment verified. Subscription activated.",
      data: {
        invoice,
        subscription_end_date,
      },
    });
  } catch (err) {
    console.error("verifySubscriptionPayment error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Tenant requests a plan change — generates a pending invoice, does NOT activate the plan yet.
// Plan only activates when Super Admin marks the invoice as paid (markInvoicePaid).
// exports.requestPlanChange = async (req, res) => {
//   try {
//     const tenant_id = req.tenantId;
//     const { plan_id } = req.body;

//     const plan = await SubscriptionPlan.findById(plan_id);
//     if (!plan) return res.status(404).json({ success: false, message: "Plan not found." });
//     if (plan.status !== "active") return res.status(400).json({ success: false, message: "This plan is not currently available." });
//     if (plan.is_custom) return res.status(400).json({ success: false, message: "Contact sales for custom plan pricing." });

//     const tenant = await Tenant.findById(tenant_id);
//     const reason = tenant.subscription_plan?.toLowerCase() === plan.plan_name.toLowerCase() ? "renewal" : "upgrade";

//     const invoice = await generateInvoiceForPlan({ tenant_id, plan, reason });

//     res.status(201).json({ success: true, data: invoice, message: `Invoice ${invoice.invoice_no} generated. Awaiting payment confirmation.` });
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };

// // Tenant clicks "Renew Now" — generates an invoice for their CURRENT plan
// exports.requestRenewal = async (req, res) => {
//   try {
//     const tenant_id = req.tenantId;
//     const tenant = await Tenant.findById(tenant_id);
//     if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found." });

//     const plan = await SubscriptionPlan.findOne({
//       plan_name: new RegExp(`^${tenant.subscription_plan}$`, "i"),
//     });
//     if (!plan) return res.status(400).json({ success: false, message: "Current plan not found. Contact support." });

//     const invoice = await generateInvoiceForPlan({ tenant_id, plan, reason: "renewal" });

//     res.status(201).json({ success: true, data: invoice, message: `Renewal invoice ${invoice.invoice_no} generated.` });
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };

/* ===== Super Admin — Invoices (manual payment confirmation) ===== */

// exports.getAllInvoices = async (req, res) => {
//   try {
//     const { status, page = 1, limit = 20 } = req.query;
//     const filter = {};
//     if (status) filter.status = status;

//     const skip = (Number(page) - 1) * Number(limit);
//     const [invoices, total] = await Promise.all([
//       Invoice.find(filter).populate("tenant_id", "business_name").sort({ billing_date: -1 }).skip(skip).limit(Number(limit)),
//       Invoice.countDocuments(filter),
//     ]);

//     res.json({ success: true, data: invoices, pagination: { total, page: Number(page), limit: Number(limit) } });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // Super Admin manually confirms payment received (bank transfer / UPI / cash) — activates the plan
// exports.markInvoicePaid = async (req, res) => {
//   try {
//     const { invoiceId } = req.params;
//     const { payment_note } = req.body;

//     const invoice = await Invoice.findById(invoiceId);
//     if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found." });
//     if (invoice.status === "paid") return res.status(400).json({ success: false, message: "Invoice is already marked paid." });

//     invoice.status = "paid";
//     invoice.paid_at = new Date();
//     invoice.marked_paid_by = req.user._id;
//     invoice.payment_note = payment_note || "";
//     await invoice.save();

//     // activate the plan on the tenant
//     const plan = await SubscriptionPlan.findById(invoice.plan_id);
//     const durationDays = plan?.duration_days || 30;
//     const subscription_end_date = new Date();
//     subscription_end_date.setDate(subscription_end_date.getDate() + durationDays);

//     await Tenant.findByIdAndUpdate(invoice.tenant_id, {
//       subscription_plan: invoice.plan_name.toLowerCase(),
//       subscription_status: "active",
//       subscription_end_date,
//     });

//     res.json({ success: true, data: invoice, message: "Payment confirmed. Subscription activated." });
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };

/* ===== DASHBOARD ===== */

exports.getDashboard = async (req, res) => {
  try {
    const [plans, totalTenants, tenantsByStatus, allTenants, pendingInvoiceCount] = await Promise.all([
      SubscriptionPlan.find().sort({ createdAt: 1 }),
      Tenant.countDocuments(),
      Tenant.aggregate([{ $group: { _id: "$subscription_status", count: { $sum: 1 } } }]),
      Tenant.find().select("business_name subscription_plan subscription_status subscription_end_date createdAt").sort({ createdAt: -1 }).limit(10),
      Invoice.countDocuments({ status: "pending" }),
    ]);

    const distribution = { active: 0, trial: 0, expired: 0, cancelled: 0 };
    tenantsByStatus.forEach((row) => {
      if (distribution[row._id] !== undefined) distribution[row._id] = row.count;
    });

    const activePlansCount = plans.filter((p) => p.status === "active").length;

    // active tenant count per plan (for the plans table "Active Tenants" column)
    const tenantCountByPlan = await Tenant.aggregate([
      { $match: { subscription_status: "active" } },
      { $group: { _id: "$subscription_plan", count: { $sum: 1 } } },
    ]);
    const tenantCountMap = {};
    tenantCountByPlan.forEach((row) => { tenantCountMap[row._id] = row.count; });

    const plansWithCounts = plans.map((p) => ({
      ...p.toObject(),
      activeTenantCount: tenantCountMap[p.plan_name.toLowerCase()] || 0,
    }));

    // revenue — this month + this year, from paid invoices
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [monthlyRevenueAgg, yearlyRevenueAgg] = await Promise.all([
      Invoice.aggregate([
        { $match: { status: "paid", paid_at: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]),
      Invoice.aggregate([
        { $match: { status: "paid", paid_at: { $gte: startOfYear } } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]),
    ]);

    // last 12 months revenue chart
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const revenueByMonthAgg = await Invoice.aggregate([
      { $match: { status: "paid", paid_at: { $gte: twelveMonthsAgo } } },
      { $group: { _id: { year: { $year: "$paid_at" }, month: { $month: "$paid_at" } }, total: { $sum: "$total_amount" } } },
    ]);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const revenueChart = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const match = revenueByMonthAgg.find((r) => r._id.year === d.getFullYear() && r._id.month === d.getMonth() + 1);
      revenueChart.push({ month: monthNames[d.getMonth()], revenue: match?.total || 0 });
    }

    // plan-type distribution (basic/professional/business/enterprise/custom) — best-effort mapping by name
    const planDistribution = {};
    tenantCountByPlan.forEach((row) => {
      const key = row._id?.toLowerCase() || "other";
      planDistribution[key] = row.count;
    });

    const recentSubscriptions = allTenants.map((t) => {
      const matched = plans.find((p) => p.plan_name.toLowerCase() === t.subscription_plan?.toLowerCase());
      return { ...t.toObject(), matched_plan: matched || null };
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalPlans: plans.length,
          activePlans: activePlansCount,
          activeTenants: distribution.active,
          trialTenants: distribution.trial,
          expiredTenants: distribution.expired,
          pendingInvoices: pendingInvoiceCount,
          monthlyRevenue: monthlyRevenueAgg[0]?.total || 0,
          yearlyRevenue: yearlyRevenueAgg[0]?.total || 0,
          distribution,
          planDistribution,
        },
        plans: plansWithCounts,
        revenueChart,
        recentSubscriptions,
      },
    });
  } catch (err) {
    console.error("getDashboard error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRecentSubscriptions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.subscription_status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [tenants, total, plans] = await Promise.all([
      Tenant.find(filter).select("business_name subscription_plan subscription_status subscription_end_date createdAt").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Tenant.countDocuments(filter),
      SubscriptionPlan.find(),
    ]);

    const data = tenants.map((t) => {
      const matched = plans.find((p) => p.plan_name.toLowerCase() === t.subscription_plan?.toLowerCase());
      return { ...t.toObject(), matched_plan: matched || null };
    });

    res.json({ success: true, data, pagination: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.acknowledgeOnboarding = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    await Tenant.findByIdAndUpdate(tenant_id, { subscription_onboarded: true });
    res.json({ success: true, message: "Onboarding acknowledged." });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};