const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Property = require("../models/Property");
const PropertyOwner = require("../models/PropertyOwner");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const { createNotification } = require("./notificationController");

// Roles that represent the primary "owner" account of a tenant
const TENANT_OWNER_ROLES = ["admin", "tenant_owner"];

// GET /api/tenants (super admin only, see all; tenant users see only theirs)
const getTenants = async (req, res) => {
  try {
    let query = {};

    // Non-super-admin users should only see their own tenant
    if (req.user.role !== "super_admin") {
      if (!req.user.tenant_id) {
        return res
          .status(403)
          .json({ success: false, message: "User must belong to a tenant." });
      }
      query._id = req.user.tenant_id;
    }

    const tenants = await Tenant.find(query).sort({ createdAt: -1 });

    // Attach each tenant's owner user (isActive/id) so the super admin UI
    // can show and toggle whether the tenant's account is active.
    const tenantsWithStatus = await Promise.all(
      tenants.map(async (t) => {
        const tenantObj = t.toObject();
        try {
          const owner =
            (await User.findOne({
              tenant_id: t._id,
              role: { $in: TENANT_OWNER_ROLES },
            })) ||
            (await User.findOne({ tenant_id: t._id }).sort({ createdAt: 1 }));

          tenantObj.ownerId = owner?._id || null;
          tenantObj.isActive = owner ? !!owner.isActive : true;
        } catch (err) {
          tenantObj.ownerId = null;
          tenantObj.isActive = true;
        }
        return tenantObj;
      }),
    );

    return res.status(200).json({ success: true, tenants: tenantsWithStatus });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getTenantById = async (req, res) => {
  console.log(req.params);

  const tenant_id = req.params.id;
  try {
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "tenant_id is required",
      });
    }
    const tenantInfo = await Tenant.findById(tenant_id);
    if (!tenantInfo) {
      return res.status(200).json({
        success: false,
        message: "can`t get tenant info",
      });
    }
    return res.status(200).json({
      success: true,
      message: "tenant fetched",
      tenantInfo,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error,
    });
  }
};

// POST /api/tenants (super admin only)
const createTenant = async (req, res) => {
  try {
    const {
      business_name,
      business_type,
      subscription_plan,
      subscription_status,
      gst_number,
      rera_number,
      address,
      city,
      state,
      pincode,
      owner_name,
      owner_username,
      owner_email,
      owner_phone,
      website,
    } = req.body;

    if (!business_name || !business_type) {
      return res.status(400).json({
        success: false,
        message: "Business name and type are required.",
      });
    }

    const planName = subscription_plan || "free";

    // Look up the matching SubscriptionPlan to pull its billing duration.
    // subscription_end_date is ALWAYS server-calculated from this — never trust
    // a date sent in req.body, so it can't be tampered with from the client.
    const planDoc = await SubscriptionPlan.findOne({
      plan_name: new RegExp(`^${planName}$`, "i"),
    });
    const durationDays = planDoc?.duration_days || 30; // fallback for the default "free" plan, which may not have a SubscriptionPlan row

    const subscription_end_date = new Date();
    subscription_end_date.setDate(
      subscription_end_date.getDate() + durationDays,
    );

    const tenant = await Tenant.create({
      business_name,
      business_type,
      subscription_plan: planName,
      subscription_status: subscription_status || "trial",
      subscription_end_date,
      gst_number,
      rera_number,
      address,
      city,
      state,
      pincode,
      owner_name,
      owner_username,
      owner_email,
      owner_phone,
      website,
    });
    if (tenant) {
      await createNotification(
        "",
        "super_admin",
        "New Tenant Registered",
        `${tenant.owner_name} has registered as a new tenant with the ${tenant.business_type} business type.`,
        `/tenants`,
      );
    }
    return res.status(201).json({
      success: true,
      message: "Tenant created successfully.",
      tenant,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

// PATCH /api/tenants/:id (admin/tenant_owner can update only own tenant, super admin can update any)
const updateTenant = async (req, res) => {
  try {
    // Enforce tenant isolation
    if (
      req.user.role !== "super_admin" &&
      req.user.tenant_id.toString() !== req.params.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Cannot update another tenant's data.",
      });
    }

    // Only allow whitelisted fields to be updated
    const allowedFields = [
      "business_name",
      "business_type",
      "subscription_plan",
      "subscription_status",
      "gst_number",
      "rera_number",
      "address",
      "city",
      "state",
      "pincode",
      "website",
      "owner_name",
      "owner_email",
      "owner_phone",
      // NOTE: subscription_end_date intentionally NOT in this list — it is never
      // directly editable. It only changes via createTenant (initial) or
      // confirmPayment in subscriptionPlanController (renewal/upgrade).
    ];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // If the plan is being changed here (e.g. Super Admin manually reassigns a
    // tenant's plan), recalculate the end date from the new plan's duration too —
    // keeps this endpoint consistent with createTenant's behavior.
    if (updateData.subscription_plan) {
      const planDoc = await SubscriptionPlan.findOne({
        plan_name: new RegExp(`^${updateData.subscription_plan}$`, "i"),
      });
      const durationDays = planDoc?.duration_days || 30;
      const subscription_end_date = new Date();
      subscription_end_date.setDate(
        subscription_end_date.getDate() + durationDays,
      );
      updateData.subscription_end_date = subscription_end_date;
    }
    const tenant = await Tenant.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    await createNotification(
      "",
      "super_admin",
      "Tenant Details Updated",
      `${tenant.owner_name} has updated the tenant details for ${tenant.business_type}.`,
      `/tenants`,
    );

    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, message: "Tenant not found." });
    }

    return res.status(200).json({ success: true, tenant });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/tenants/:id (super admin only, with soft-delete pattern recommended for production)
const deleteTenant = async (req, res) => {
  try {
    // Only super admin can delete tenants
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin can delete tenants.",
      });
    }

    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, message: "Tenant not found." });
    }

    // Check linked records
    const [userCount, propertyCount, ownerCount] = await Promise.all([
      User.countDocuments({ tenant_id: tenant._id }),
      Property.countDocuments({ tenant_id: tenant._id }),
      PropertyOwner.countDocuments({ tenant_id: tenant._id }),
    ]);

    const linked = [];
    if (userCount > 0) linked.push("Users");
    if (propertyCount > 0) linked.push("Properties");
    if (ownerCount > 0) linked.push("Property Owners");

    if (linked.length > 0) {
      return res.status(400).json({
        success: false,
        message: `This tenant cannot be deleted because it has linked ${linked.join("/")}. Remove the linked data first.`,
      });
    }

    // Safe to delete
    const deleteTenant = await Tenant.findByIdAndDelete(tenant._id);

    await createNotification(
      "",
      "super_admin",
      "Tenant Deleted",
      `${deleteTenant.owner_name} has deleted the tenant account for ${deleteTenant.business_type}.`,
      `/tenants`,
    );

    return res
      .status(200)
      .json({ success: true, message: "Tenant deleted successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  getTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantById,
};
