const mongoose = require("mongoose");

const agencyBookingSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    booking_code: {
      type: String,
      trim: true,
      required: true,
    },
    customer_name: {
      type: String,
      required: true,
      trim: true,
    },
    customer_phone: {
      type: String,
      required: true,
      trim: true,
    },
    customer_email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    property_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    property_owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyOwner",
      default: null,
    },
    property_status_before_booking: {
      type: String,
      enum: ["available", "hold", "booked", "sold", "rented", "inactive"],
      default: "available",
    },
    sales_agent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    booking_date: {
      type: Date,
      default: Date.now,
    },
    expected_closing: {
      type: Date,
      default: null,
    },
    total_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    advance_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    booking_status: {
      type: String,
      enum: ["Confirmed", "Pending", "Cancelled"],
      default: "Pending",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

agencyBookingSchema.index({ tenant_id: 1, booking_code: 1 }, { unique: true });
agencyBookingSchema.index({ tenant_id: 1, property_id: 1, booking_status: 1 });
agencyBookingSchema.index({ tenant_id: 1, booking_date: -1 });

module.exports =
  mongoose.models.AgencyBooking ||
  mongoose.model("AgencyBooking", agencyBookingSchema);
