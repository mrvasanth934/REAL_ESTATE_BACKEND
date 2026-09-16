const Booking = require("../models/BuilderBooking");

exports.getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().populate([
      "projectId",
      "towerId",
      "unitId",
    ]);

    res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
      error: error.message,
    });
  }
};

exports.createBooking = async (req, res) => {
  try {
    const {
      buyer,
      projectId,
      towerId,
      unitId,
      price,
      amount,
      bookingDate,
      status,
      paymentMethod,
    } = req.body;

    const lastBooking = await Booking.findOne()
      .sort({ createdAt: -1 })
      .select("bookingId");

    let nextNumber = 1;

    if (lastBooking?.bookingId) {
      const number = parseInt(lastBooking.bookingId.replace("BK-", ""), 10);

      if (!isNaN(number)) {
        nextNumber = number + 1;
      }
    }

    const bookingId = `BK-${String(nextNumber).padStart(3, "0")}`;

    const booking = await Booking.create({
      bookingId,
      buyer,
      projectId,
      towerId,
      unitId,
      price,
      amount,
      bookingDate,
      status: status || "Tentative",
      paymentMethod,
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update booking",
      error: error.message,
    });
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete booking",
      error: error.message,
    });
  }
};

exports.getBookingStats = async (req, res) => {
  try {
    const [total, tentative, confirmed, completed] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ status: "Tentative" }),
      Booking.countDocuments({ status: "Confirmed" }),
      Booking.countDocuments({ status: "Completed" }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBookings: total,
        tentative,
        confirmed,
        completed,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking statistics",
      error: error.message,
    });
  }
};
