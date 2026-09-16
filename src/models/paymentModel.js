const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  payer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  paymentMethod: {
    type: String,
    enum: ["Cash", "Online", "UPI"],
    default: "Cash",
  },
  paymentType: {
    type: String,
    enum: ["BOOKING", "SUBSCRIPTION", "DIRECT_TRANSFER"],
    required: true,
  },

  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
  },

  subscriptionDetails: {
    planId: { type: String },
    razorpaySubscriptionId: { type: String },
    cycleCount: { type: Number, default: 1 },
  },

  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  platformFee: { type: Number, default: 0 },
  transferAmount: { type: Number },

  status: {
    type: String,
    enum: ["Pending", "Paid", "Failed", "Active", "Cancelled", "Completed"],
    default: "Pending",
  },

  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  razorpayTransferId: { type: String },
  transferStatus: {
    type: String,
    enum: ["Pending", "Paid", "Failed", "Active", "Cancelled"],
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Payment", paymentSchema);
