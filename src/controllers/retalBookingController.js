const mongoose = require("mongoose");
const path = require("path");
const RentalBooking = require("../models/rentalBooking");
const { inferMediaType } = require("../middleware/uploadMedia");

const requireTenant = (req, res) => {
  if (!req.tenantId) {
    res
      .status(400)
      .json({ success: false, message: "x-tenant-id header required." });
    return false;
  }
  return true;
};

exports.getRentalBookings = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;

    const {
      search,
      status,
      payment_status,
      property_id,
      rental_tenant_id,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = { tenant_id: req.tenantId };
    if (status && status !== "all") filter.status = status;
    if (payment_status && payment_status !== "all")
      filter.payment_status = payment_status;
    if (property_id && mongoose.Types.ObjectId.isValid(property_id))
      filter.property_id = property_id;
    if (rental_tenant_id && mongoose.Types.ObjectId.isValid(rental_tenant_id)) {
      filter.rental_tenant_id = rental_tenant_id;
    }
    if (search) filter.booking_code = new RegExp(search.trim(), "i");

    const skip = (Number(page) - 1) * Number(limit);

    const [bookings, total, stats] = await Promise.all([
      RentalBooking.find(filter)
        .populate("property_id", "title city locality price status media")
        .populate({
          path: "rental_tenant_id",
          select: "name phone email status fullName occupation bankdetails",
          populate: { path: "bankdetails" },
        })
        .populate("created_by", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      RentalBooking.countDocuments(filter),
      RentalBooking.aggregate([
        {
          $match: {
            tenant_id: new mongoose.Types.ObjectId(String(req.tenantId)),
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
            cancelled: {
              $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
            },
            vacated: {
              $sum: { $cond: [{ $eq: ["$status", "vacated"] }, 1, 0] },
            },
            rent: { $sum: "$monthly_rent" },
            deposit: { $sum: "$security_deposit" },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: bookings,
      stats: stats[0] || {
        total: 0,
        active: 0,
        confirmed: 0,
        cancelled: 0,
        rent: 0,
        deposit: 0,
      },
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRentalBookingById = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid booking id" });
    }

    const booking = await RentalBooking.findOne({
      _id: id,
      tenant_id: req.tenantId,
    })
      .populate("property_id", "title city locality price status media")
      .populate({
        path: "rental_tenant_id",
        populate: { path: "bankdetails" },
      })
      .populate("created_by", "name email role");

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRentalBookingByIds = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;

    const booking = await RentalBooking.find({
      tenant_id: req.tenantId,
    })
      .populate("property_id", "title city locality price status media")
      .populate({
        path: "rental_tenant_id",
        populate: { path: "bankdetails" },
      })
      .populate("created_by", "name email role");

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createRentalBooking = async (req, res, next) => {
  try {
    if (!requireTenant(req, res)) return;

    const { property_id, rental_tenant_id, monthly_rent } = req.body;

    if (
      !property_id ||
      !rental_tenant_id ||
      monthly_rent === undefined ||
      monthly_rent === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Property, rental tenant and monthly rent are required.",
      });
    }

    const payload = { ...req.body };

    delete payload.tenant_id;
    delete payload.created_by;

    if (!payload.booking_code) {
      payload.booking_code = `RB-${Date.now().toString().slice(-8)}`;
    }

    const booking = await RentalBooking.create({
      ...payload,
      tenant_id: req.tenantId,
      created_by: req.user._id,
    });

    console.log("BOOKING CREATED:", booking._id);

    return res.status(201).json({
      success: true,
      message: "Rental Booked Successfully",
      data: booking,
      file: req.file
        ? {
            filename: req.file.filename,
            url: payload.agreement_image,
          }
        : null,
    });
  } catch (err) {
    console.error("CREATE RENTAL BOOKING ERROR:", err);

    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateRentalBooking = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const payload = { ...req.body };
    delete payload.tenant_id;
    delete payload.created_by;

    const booking = await RentalBooking.findOneAndUpdate(
      { _id: req.params.id, tenant_id: req.tenantId },
      { $set: payload },
      { new: true, runValidators: true },
    )
      .populate("property_id", "title city locality price status")
      .populate({
        path: "rental_tenant_id",
        select: "name phone email status fullName occupation bankdetails",
        populate: { path: "bankdetails" },
      });

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.addRentalCollection = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;

    const booking = await RentalBooking.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const now = new Date();

    const alreadyPaid = booking.rental_collection.some((collection) => {
      if (collection.status !== "Paid" || !collection.paymentDate) {
        return false;
      }

      const paymentDate = new Date(collection.paymentDate);

      return (
        paymentDate.getFullYear() === now.getFullYear() &&
        paymentDate.getMonth() === now.getMonth()
      );
    });

    if (alreadyPaid) {
      return res.status(400).json({
        success: false,
        message: "Already payment received for this month.",
      });
    }

    const collectionData = {
      rent: req.body.rent,
      dueDate: req.body.dueDate,
      status: req.body.status || "Pending",
      paymentMethod: req.body.paymentMethod || "Cash",
    };

    booking.rental_collection.push(collectionData);

    await booking.save();

    return res.json({
      success: true,
      message: "Rental collection added successfully",
      data: booking,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.deleteRentalBooking = async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;

    const existingBooking = await RentalBooking.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });

    if (!existingBooking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    if (existingBooking.status === "active") {
      return res.status(400).json({
        success: false,
        message:
          "This lease agreement is tied to an active booking and cannot be deleted. Please cancel or vacate the booking first.",
      });
    }

    await RentalBooking.findOneAndDelete({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });

    res.json({ success: true, message: "Booking deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.uploadDraftMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file received.",
      });
    }

    const folder = req._uploadFolder || "";

    const data = {
      media_type: inferMediaType(req.file.mimetype),
      url: `/uploads/rentalBooking/${folder}/${req.file.filename}`,
      sort_order: 0,
    };

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};
