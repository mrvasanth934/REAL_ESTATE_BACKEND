const express = require("express");

const BuilderBookingRoutes = express.Router();

const {
  getBookings,
  updateBooking,
  createBooking,
  deleteBooking,
} = require("../controllers/BuilderBookingController.js");

BuilderBookingRoutes.get("/", getBookings);
BuilderBookingRoutes.put("/:id", updateBooking);
BuilderBookingRoutes.post("/", createBooking);
BuilderBookingRoutes.delete("/:id", deleteBooking);

module.exports = BuilderBookingRoutes;
