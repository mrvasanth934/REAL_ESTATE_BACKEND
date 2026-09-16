const mongoose = require("mongoose");
const AgencyBooking = require("../models/AgencyBooking");
const Property = require("../models/Property");
const User = require("../models/User");

const requireTenant = (req, res) => {
  if (!req.tenantId) {
    res.status(400).json({
      success: false,
      message: "x-tenant-id header required.",
    });
    return false;
  }
  return true;
};

const normalizeStatus = (value) => {
  if (!value) return undefined;
  const map = {
    confirmed: "Confirmed",
    pending: "Pending",
    cancelled: "Cancelled",
  };
  return map[String(value).toLowerCase()] || value;
};

const makeBookingCode = async (tenantId) => {
  const last = await AgencyBooking.findOne({ tenant_id: tenantId })
    .sort({ createdAt: -1 })
    .select("booking_code")
    .lean();

  const match = String(last?.booking_code || "").match(/(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;
  return `BK${String(next).padStart(4, "0")}`;
};

const populateBooking = (query) =>
  query
    .populate({
      path: "property_id",
      select: "title property_type sub_type listing_type status price owner_id city locality",
      populate: { path: "owner_id", select: "name phone email" },
    })
    .populate("property_owner_id", "name phone email")
    .populate("sales_agent_id", "name email phone role")
    .populate("created_by", "name email role");

exports.getAgencyBookings = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;

    const {
      search = "",
      status,
      property_id,
      sales_agent_id,
      page = 1,
      limit = 100,
    } = req.query;

    const filter = { tenant_id: req.tenantId };
    if (req.user?.role === "agent") filter.sales_agent_id = req.user._id;
    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus && normalizedStatus !== "All") {
      filter.booking_status = normalizedStatus;
    }
    if (property_id && mongoose.Types.ObjectId.isValid(property_id)) {
      filter.property_id = property_id;
    }
    if (sales_agent_id && mongoose.Types.ObjectId.isValid(sales_agent_id)) {
      filter.sales_agent_id = sales_agent_id;
    }

    if (search.trim()) {
      const q = search.trim();
      filter.$or = [
        { booking_code: new RegExp(q, "i") },
        { customer_name: new RegExp(q, "i") },
        { customer_phone: new RegExp(q, "i") },
      ];
    }

    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(500, Math.max(1, Number(limit) || 100));
    const skip = (pageNumber - 1) * limitNumber;

    const tenantObjectId = new mongoose.Types.ObjectId(String(req.tenantId));

    const [bookings, total, statsRows] = await Promise.all([
      populateBooking(
        AgencyBooking.find(filter)
          .sort({ booking_date: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
      ).lean(),
      AgencyBooking.countDocuments(filter),
      AgencyBooking.aggregate([
        { $match: { tenant_id: tenantObjectId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            confirmed: {
              $sum: { $cond: [{ $eq: ["$booking_status", "Confirmed"] }, 1, 0] },
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$booking_status", "Pending"] }, 1, 0] },
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ["$booking_status", "Cancelled"] }, 1, 0] },
            },
            total_amount: { $sum: "$total_amount" },
            advance_amount: { $sum: "$advance_amount" },
          },
        },
      ]),
    ]);

    const current = new Date();
    const currentMonthStart = new Date(
      current.getFullYear(),
      current.getMonth(),
      1
    );
    const lastMonthStart = new Date(
      current.getFullYear(),
      current.getMonth() - 1,
      1
    );

    const monthRows = await AgencyBooking.aggregate([
      {
        $match: {
          tenant_id: tenantObjectId,
          booking_date: { $gte: lastMonthStart },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$booking_date" },
            month: { $month: "$booking_date" },
          },
          total: { $sum: 1 },
          confirmed: {
            $sum: { $cond: [{ $eq: ["$booking_status", "Confirmed"] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$booking_status", "Pending"] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ["$booking_status", "Cancelled"] }, 1, 0] },
          },
        },
      },
    ]);

    const currentRow =
      monthRows.find(
        (r) =>
          r._id.year === currentMonthStart.getFullYear() &&
          r._id.month === currentMonthStart.getMonth() + 1
      ) || {};
    const previousRow =
      monthRows.find(
        (r) =>
          r._id.year === lastMonthStart.getFullYear() &&
          r._id.month === lastMonthStart.getMonth() + 1
      ) || {};

    const todayStart = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate()
    );
    const tomorrowStart = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + 1
    );

    const todayNewBookings = await AgencyBooking.countDocuments({
      tenant_id: req.tenantId,
      createdAt: { $gte: todayStart, $lt: tomorrowStart },
    });

    const stats = statsRows[0] || {
      total: 0,
      confirmed: 0,
      pending: 0,
      cancelled: 0,
      total_amount: 0,
      advance_amount: 0,
    };

    stats.total_change = (currentRow.total || 0) - (previousRow.total || 0);
    stats.confirmed_change =
      (currentRow.confirmed || 0) - (previousRow.confirmed || 0);
    stats.pending_change =
      (currentRow.pending || 0) - (previousRow.pending || 0);
    stats.cancelled_change =
      (currentRow.cancelled || 0) - (previousRow.cancelled || 0);
    stats.today_new = todayNewBookings;

    return res.json({
      success: true,
      data: bookings,
      stats,
      pagination: { total, page: pageNumber, limit: limitNumber },
    });
  } catch (err) {
    console.error("GET AGENCY BOOKINGS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAgencyBookingById = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }

    const bookingFilter = {
      _id: req.params.id,
      tenant_id: req.tenantId,
    };
    if (req.user?.role === "agent") bookingFilter.sales_agent_id = req.user._id;

    const booking = await populateBooking(AgencyBooking.findOne(bookingFilter));

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    return res.json({ success: true, data: booking });
  } catch (err) {
    console.error("GET AGENCY BOOKING ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createAgencyBooking = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;

    const {
      customer_name,
      customer_phone,
      customer_email,
      property_id,
      sales_agent_id,
      booking_date,
      expected_closing,
      total_amount,
      advance_amount,
      booking_status,
      notes,
    } = req.body;

    if (
      !customer_name?.trim() ||
      !customer_phone?.trim() ||
      !property_id ||
      total_amount === undefined ||
      total_amount === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Customer name, phone, property and total amount are required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(property_id)) {
      return res.status(400).json({ success: false, message: "Invalid property id." });
    }

    const property = await Property.findOne({
      _id: property_id,
      tenant_id: req.tenantId,
    }).populate("owner_id", "name phone email");

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found." });
    }

    const status = normalizeStatus(booking_status) || "Pending";
    const effectiveSalesAgentId = req.user?.role === "agent" ? req.user._id : sales_agent_id;

    if (Number(advance_amount || 0) > Number(total_amount)) {
      return res.status(400).json({
        success: false,
        message: "Advance amount cannot be greater than total amount.",
      });
    }

    if (effectiveSalesAgentId) {
      if (!mongoose.Types.ObjectId.isValid(effectiveSalesAgentId)) {
        return res.status(400).json({ success: false, message: "Invalid sales agent." });
      }
      const agent = await User.findOne({
        _id: effectiveSalesAgentId,
        tenant_id: req.tenantId,
        role: "agent",
        isActive: true,
      });
      if (!agent) {
        return res.status(400).json({ success: false, message: "Selected sales agent is invalid or inactive." });
      }
    }

    if (status !== "Cancelled") {
      const duplicate = await AgencyBooking.findOne({
        tenant_id: req.tenantId,
        property_id,
        booking_status: { $in: ["Confirmed", "Pending"] },
      }).select("_id booking_code");

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `This property already has an active booking (${duplicate.booking_code}).`,
        });
      }

      if (["booked", "sold"].includes(property.status)) {
        return res.status(409).json({
          success: false,
          message: "This property is already booked or sold.",
        });
      }
    }

    const booking = await AgencyBooking.create({
      tenant_id: req.tenantId,
      created_by: req.user._id,
      booking_code: await makeBookingCode(req.tenantId),
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      customer_email: customer_email?.trim().toLowerCase() || "",
      property_id,
      property_owner_id: property.owner_id?._id || property.owner_id || null,
      property_status_before_booking: property.status,
      sales_agent_id: effectiveSalesAgentId || null,
      booking_date: booking_date || new Date(),
      expected_closing: expected_closing || null,
      total_amount: Number(total_amount),
      advance_amount: Number(advance_amount || 0),
      booking_status: status,
      notes: notes?.trim() || "",
    });

    if (status === "Confirmed") {
      await Property.updateOne(
        { _id: property_id, tenant_id: req.tenantId },
        { $set: { status: "booked" } }
      );
    } else if (status === "Pending") {
      await Property.updateOne(
        { _id: property_id, tenant_id: req.tenantId, status: "available" },
        { $set: { status: "hold" } }
      );
    }

    const populated = await populateBooking(
      AgencyBooking.findOne({ _id: booking._id, tenant_id: req.tenantId })
    );

    return res.status(201).json({
      success: true,
      message: "Booking created successfully.",
      data: populated,
    });
  } catch (err) {
    console.error("CREATE AGENCY BOOKING ERROR:", err);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate booking code. Please try again.",
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateAgencyBooking = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;

    const existingFilter = {
      _id: req.params.id,
      tenant_id: req.tenantId,
    };
    if (req.user?.role === "agent") existingFilter.sales_agent_id = req.user._id;

    const existing = await AgencyBooking.findOne(existingFilter);

    if (!existing) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    const allowed = [
      "customer_name",
      "customer_phone",
      "customer_email",
      "property_id",
      "sales_agent_id",
      "booking_date",
      "expected_closing",
      "total_amount",
      "advance_amount",
      "booking_status",
      "notes",
    ];

    const payload = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }

    if (req.user?.role === "agent") payload.sales_agent_id = req.user._id;

    if (payload.customer_name !== undefined && !String(payload.customer_name).trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required." });
    }
    if (payload.customer_phone !== undefined && !String(payload.customer_phone).trim()) {
      return res.status(400).json({ success: false, message: "Customer phone is required." });
    }

    const nextPropertyId = payload.property_id || existing.property_id;
    if (!mongoose.Types.ObjectId.isValid(nextPropertyId)) {
      return res.status(400).json({ success: false, message: "Invalid property id." });
    }

    const nextTotal = payload.total_amount !== undefined
      ? Number(payload.total_amount)
      : existing.total_amount;
    const nextAdvance = payload.advance_amount !== undefined
      ? Number(payload.advance_amount)
      : existing.advance_amount;

    if (!Number.isFinite(nextTotal) || nextTotal < 0 || !Number.isFinite(nextAdvance) || nextAdvance < 0) {
      return res.status(400).json({ success: false, message: "Invalid booking amount." });
    }
    if (nextAdvance > nextTotal) {
      return res.status(400).json({ success: false, message: "Advance amount cannot be greater than total amount." });
    }

    const nextStatus = normalizeStatus(payload.booking_status) || existing.booking_status;
    const propertyChanged = String(existing.property_id) !== String(nextPropertyId);

    const property = await Property.findOne({
      _id: nextPropertyId,
      tenant_id: req.tenantId,
    }).populate("owner_id", "name phone email");

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found." });
    }

    if (payload.sales_agent_id) {
      const agent = await User.findOne({
        _id: payload.sales_agent_id,
        tenant_id: req.tenantId,
        role: "agent",
        isActive: true,
      });
      if (!agent) {
        return res.status(400).json({ success: false, message: "Selected sales agent is invalid or inactive." });
      }
    }

    if (nextStatus !== "Cancelled") {
      const duplicate = await AgencyBooking.findOne({
        _id: { $ne: existing._id },
        tenant_id: req.tenantId,
        property_id: nextPropertyId,
        booking_status: { $in: ["Confirmed", "Pending"] },
      }).select("booking_code");

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `This property already has an active booking (${duplicate.booking_code}).`,
        });
      }

      if (
        ["booked", "sold"].includes(property.status) &&
        String(existing.property_id) !== String(nextPropertyId)
      ) {
        return res.status(409).json({
          success: false,
          message: "Selected property is already booked or sold.",
        });
      }
    }

    payload.property_id = nextPropertyId;
    payload.property_owner_id = property.owner_id?._id || property.owner_id || null;
    if (propertyChanged) payload.property_status_before_booking = property.status;
    payload.total_amount = nextTotal;
    payload.advance_amount = nextAdvance;
    payload.booking_status = nextStatus;
    if (payload.customer_name) payload.customer_name = String(payload.customer_name).trim();
    if (payload.customer_phone) payload.customer_phone = String(payload.customer_phone).trim();
    if (payload.customer_email !== undefined) payload.customer_email = String(payload.customer_email || "").trim().toLowerCase();

    const updated = await AgencyBooking.findOneAndUpdate(
      { _id: existing._id, tenant_id: req.tenantId },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (propertyChanged) {
      await Property.updateOne(
        { _id: existing.property_id, tenant_id: req.tenantId },
        { $set: { status: existing.property_status_before_booking || "available" } }
      );
    }

    if (nextStatus === "Confirmed") {
      await Property.updateOne(
        { _id: nextPropertyId, tenant_id: req.tenantId },
        { $set: { status: "booked" } }
      );
    } else if (nextStatus === "Pending") {
      await Property.updateOne(
        { _id: nextPropertyId, tenant_id: req.tenantId },
        { $set: { status: "hold" } }
      );
    } else {
      await Property.updateOne(
        { _id: nextPropertyId, tenant_id: req.tenantId, status: { $in: ["booked", "hold"] } },
        { $set: { status: "available" } }
      );
    }

    const populated = await populateBooking(
      AgencyBooking.findOne({ _id: updated._id, tenant_id: req.tenantId })
    );

    return res.json({
      success: true,
      message: "Booking updated successfully.",
      data: populated,
    });
  } catch (err) {
    console.error("UPDATE AGENCY BOOKING ERROR:", err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteAgencyBooking = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;

    const bookingFilter = {
      _id: req.params.id,
      tenant_id: req.tenantId,
    };
    if (req.user?.role === "agent") bookingFilter.sales_agent_id = req.user._id;

    const booking = await AgencyBooking.findOne(bookingFilter);

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    await AgencyBooking.deleteOne({ _id: booking._id, tenant_id: req.tenantId });

    await Property.updateOne(
      {
        _id: booking.property_id,
        tenant_id: req.tenantId,
        status: { $in: ["booked", "hold"] },
      },
      { $set: { status: booking.property_status_before_booking || "available" } }
    );

    return res.json({
      success: true,
      message: "Booking deleted successfully.",
    });
  } catch (err) {
    console.error("DELETE AGENCY BOOKING ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
