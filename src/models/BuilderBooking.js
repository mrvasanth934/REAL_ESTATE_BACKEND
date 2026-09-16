const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    buyer: {
      type: String,
      required: true,
      trim: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      trim: true,
    },

    towerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tower",
      required: true,
      trim: true,
    },

    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    bookingDate: {
      type: Date,
      default: Date.now(),
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "bank_transfer"],
      default: "cash",
    },

    status: {
      type: String,
      enum: ["Tentative", "Confirmed", "Completed", "Cancelled"],
      default: "Tentative",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("BuilderBooking", bookingSchema);
