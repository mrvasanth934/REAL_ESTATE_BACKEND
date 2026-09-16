const mongoose = require("mongoose");

const rentalCollectionSchema = new mongoose.Schema(
  {
    rent: {
      type: String,
      required: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now(),
    },
    status: {
      type: String,
      enum: ["Pending", "Paid", "Overdue", "Failed"],
      default: "Pending",
    },
    paymentMethod: {
      type: String,
      enum: ["UPI", "Bank Transfer", "Cash"],
      default: "Cash",
    },
    transactionId: {
      type: String,
    },
    remarks: {
      type: String, // Extra notes (e.g., "Late fee added")
    },
  },
  { timestamps: true, _id: false },
);

const rentalBookingSchema = new mongoose.Schema(
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

    booking_code: { type: String, trim: true, default: "" },

    property_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    rental_tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RentalTenant",
      required: true,
    },

    booking_date: { type: Date, default: Date.now },
    move_in_date: { type: Date, default: null },
    move_out_date: { type: Date, default: null },

    lease_start_date: { type: Date, default: null },
    lease_end_date: { type: Date, default: null },
    lease_duration_months: { type: Number, default: 11 },

    monthly_rent: { type: Number, required: true },
    security_deposit: { type: Number, default: 0 },
    maintenance_charge: { type: Number, default: 0 },

    rent_due_day: { type: Number, min: 1, max: 31, default: 5 },

    payment_status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    payment_method: {
      type: String,
      enum: ["cash", "upi", "bank_transfer", "card", "cheque"],
      default: "cash",
    },
    deposit_refund_status: {
      type: String,
      enum: ["pending", "partially_refunded", "refunded", "deducted"],
      default: "pending",
    },
    status: {
      type: String,
      enum: ["active", "cancelled", "vacated"],
      default: "confirmed",
    },

    notes: { type: String, trim: true, default: "" },
    agreement_image: { type: String, trim: true, default: "" },
    rental_collection: [rentalCollectionSchema],
  },
  { timestamps: true },
);

rentalBookingSchema.index({ tenant_id: 1, status: 1 });
rentalBookingSchema.index({ tenant_id: 1, property_id: 1 });

module.exports =
  mongoose.models.RentalBooking ||
  mongoose.model("RentalBooking", rentalBookingSchema);
