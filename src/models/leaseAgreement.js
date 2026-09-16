const mongoose = require("mongoose");

const leaseAgreementSchema = new mongoose.Schema(
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

    agreement_code: { type: String, trim: true, default: "" },

    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RentalBooking",
      default: null,
    },
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
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyOwner",
      default: null,
    },

    agreement_type: {
      type: String,
      enum: ["rental", "lease", "leave_and_license", "commercial"],
      default: "rental",
    },

    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    duration_months: { type: Number, default: 11 },

    monthly_rent: { type: Number, required: true },
    security_deposit: { type: Number, default: 0 },
    maintenance_charge: { type: Number, default: 0 },
    rent_due_day: { type: Number, min: 1, max: 31, default: 5 },

    escalation_percent: { type: Number, default: 0 },
    escalation_after_months: { type: Number, default: 12 },
    lock_in_months: { type: Number, default: 0 },

    stamp_duty_amount: { type: Number, default: 0 },
    registration_number: { type: String, trim: true, default: "" },
    registration_date: { type: Date, default: null },

    document_url: { type: String, trim: true, default: "" },

    signed_by_tenant: { type: Boolean, default: false },
    signed_by_owner: { type: Boolean, default: false },
    signed_date: { type: Date, default: null },

    status: {
      type: String,
      enum: ["draft", "pending_signature", "active", "expired", "terminated", "renewed"],
      default: "draft",
    },

    terminated_on: { type: Date, default: null },
    termination_reason: { type: String, trim: true, default: "" },

    renewed_from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaseAgreement",
      default: null,
    },

    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

leaseAgreementSchema.index({ tenant_id: 1, status: 1 });
leaseAgreementSchema.index({ tenant_id: 1, property_id: 1 });
leaseAgreementSchema.index({ tenant_id: 1, rental_tenant_id: 1 });

module.exports =
  mongoose.models.LeaseAgreement ||
  mongoose.model("LeaseAgreement", leaseAgreementSchema);
