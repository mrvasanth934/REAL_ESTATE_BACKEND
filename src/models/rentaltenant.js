const mongoose = require("mongoose");

const rentalTenantSchema = new mongoose.Schema(
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

    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    alternate_phone: { type: String, trim: true, default: "" },

    id_proof_type: {
      type: String,
      enum: ["aadhaar", "pan", "passport", "driving_license", "voter_id", "other"],
      default: "aadhaar",
    },
    id_proof_number: { type: String, trim: true, default: "" },
    id_proof_document: { type: String, trim: true, default: "" },

    occupation: { type: String, trim: true, default: "" },
    company_name: { type: String, trim: true, default: "" },

    permanent_address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, default: "" },
    bankdetails:{
      type:mongoose.Schema.Types.ObjectId,
      ref:"BankAccount",
      default:null
    },
    property_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    booking_Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RentalBooking"
    },
    status: {
      type: String,
      enum: ["active", "notice_period", "vacated", "blacklisted","booked"],
      default: "active",
    },

    notes: { type: String, trim: true, default: "" },

    avatar_url: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

rentalTenantSchema.index({ tenant_id: 1, status: 1 });
rentalTenantSchema.index({ tenant_id: 1, name: 1 });

module.exports = mongoose.model("RentalTenant", rentalTenantSchema);
