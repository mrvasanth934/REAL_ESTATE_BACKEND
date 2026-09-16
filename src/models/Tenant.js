const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    business_name: { type: String, required: true, trim: true },
    business_type: {
      type: String,
      enum: ["agency", "builder", "rental_agent", "hybrid"],
      required: true,
    },
    subscription_plan: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    subscription_end_date: { type: Date, default: null },
    subscription_status: {
      type: String,
      enum: ["active", "trial", "expired", "cancelled"],
      default: "trial",
    },
    subscription_onboarded: { type: Boolean, default: false },
    owner_name: String,
    owner_username: String,
    owner_email: String,
    owner_phone: String,
    auto_renewal: { type: Boolean, default: true },
    gst_number: { type: String, trim: true, default: "" },
    rera_number: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, default: "" },
    razorpay_account_id: { type: String, trim: true, default: "" },
    kyc_status: { type: String, trim: true, default: "" },
    website: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Tenant", tenantSchema);