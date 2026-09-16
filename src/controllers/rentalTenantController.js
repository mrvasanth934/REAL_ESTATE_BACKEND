const mongoose = require("mongoose");
const RentalTenant = require("../models/RentalTenant");
const RentalBooking = require("../models/rentalBooking");

const requireTenant = (req, res) => {
  if (!req.tenantId) {
    res.status(400).json({ success: false, message: "x-tenant-id header required." });
    return false;
  }
  return true;
};

// LIST — always scoped to the current tenant_id
exports.getRentalTenants = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;

    const { search, status, property_id, page = 1, limit = 50 } = req.query;

    const filter = { tenant_id: req.tenantId };
    if (status && status !== "all") {
      const statusArray = status.includes(",") ? status.split(",") : [status];
      filter.status = { $in: statusArray };
    }
    if (property_id && mongoose.Types.ObjectId.isValid(property_id)) {
      filter.property_id = property_id;
    }
    if (search) {
      const rx = new RegExp(search.trim(), "i");
      filter.$or = [{ name: rx }, { phone: rx }, { email: rx }, { city: rx }];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [rentalTenants, total, stats] = await Promise.all([
      RentalTenant.find(filter)
        .populate("property_id")
        .populate("created_by", "name email")
        .populate("bankdetails")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      RentalTenant.countDocuments(filter),
      RentalTenant.aggregate([
        { $match: { tenant_id: new mongoose.Types.ObjectId(String(req.tenantId)) } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
            vacated: { $sum: { $cond: [{ $eq: ["$status", "vacated"] }, 1, 0] } },
            booked: { $sum: { $cond: [{ $eq: ["$status", "booked"] }, 1, 0] } },
            rent: { $sum: "$monthly_rent" },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: rentalTenants,
      stats: stats[0] || { total: 0, active: 0, vacated: 0, notice: 0, rent: 0 },
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRentalTenantById = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid rental tenant id" });
    }

    const rentalTenant = await RentalTenant.findOne({ _id: id, tenant_id: req.tenantId })
      .populate("property_id", "title city locality price status media")
      .populate("created_by", "name email role");

    if (!rentalTenant) {
      return res.status(404).json({ success: false, message: "Rental tenant not found" });
    }

    res.json({ success: true, data: rentalTenant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createRentalTenant = async (req, res, next) => {
  try {
    
    if (!requireTenant(req, res)) return;

    const { fullName, phone, email } = req.body;
    if (!fullName || !phone) {
      return res.status(400).json({ success: false, message: "Name and phone are required." });
    }

    // Email format validation check
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: "Invalid email format." });
      }
    }

    // Check if phone or email already exists for this organization/tenant_id
    const duplicateQuery = { tenant_id: req.tenantId, $or: [{ phone }] };
    if (email) {
      duplicateQuery.$or.push({ email });
    }

    const existingTenant = await RentalTenant.findOne(duplicateQuery);
    if (existingTenant) {
      const field = existingTenant.phone === phone ? "Phone number" : "Email";
      return res.status(400).json({ 
        success: false, 
        message: `${field} already exists for another rental tenant.` 
      });
    }

    const payload = { ...req.body };
    delete payload.tenant_id;
    delete payload.created_by;
    if (!payload.property_id) payload.property_id = null;

    const rentalTenant = await RentalTenant.create({
      ...payload,
      tenant_id: req.tenantId,
      created_by: req.user._id,
    });
    
    req.tenant = rentalTenant;
    next();
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateRentalTenant = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    
    const { email, phone } = req.body;

    // Email format validation check if email is being updated
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: "Invalid email format." });
      }
    }

    // Check duplicate for update if phone or email is modified
    if (phone || email) {
      const conditions = [];
      if (phone) conditions.push({ phone });
      if (email) conditions.push({ email });

      const existingTenant = await RentalTenant.findOne({
        tenant_id: req.tenantId,
        _id: { $ne: req.params.id },
        $or: conditions,
      });

      if (existingTenant) {
        const field = existingTenant.phone === phone ? "Phone number" : "Email";
        return res.status(400).json({ 
          success: false, 
          message: `${field} already exists for another rental tenant.` 
        });
      }
    }

    const payload = { ...req.body };
    delete payload.tenant_id;
    delete payload.created_by;
    if (payload.property_id === "") payload.property_id = null;

    const rentalTenant = await RentalTenant.findOneAndUpdate(
      { _id: req.params.id, tenant_id: req.tenantId },
      { $set: payload },
      { new: true, runValidators: true }
    ).populate("property_id", "title city locality price status");

    if (!rentalTenant) {
      return res.status(404).json({ success: false, message: "Rental tenant not found" });
    }

    res.json({ success: true, data: rentalTenant });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteRentalTenant = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;

    const rentalTenant = await RentalTenant.findOneAndDelete({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });

    if (!rentalTenant) {
      return res.status(404).json({ success: false, message: "Rental tenant not found" });
    }

    // keep bookings consistent — remove the orphan bookings of this rental tenant
    await RentalBooking.deleteMany({
      tenant_id: req.tenantId,
      rental_tenant_id: rentalTenant._id,
    });

    res.json({ success: true, message: "Rental tenant deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};