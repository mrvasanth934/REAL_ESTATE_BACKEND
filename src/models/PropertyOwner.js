const mongoose = require("mongoose");

const propertyOwnerSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true },

    phone: { type: String, required: true },
    country: { type: String, default: "IN" },

    email: String,
    proof_type: {
      type: String,
      enum: ["PAN", "AADHAAR", "PASSPORT", "VOTER_ID"],
    },
    proof_number: String,

    address: String,
    properties:[
      {
        type:mongoose.Schema.Types.ObjectId,
        ref:"Property",
      },
    ]
  },
  { timestamps: true }
);

propertyOwnerSchema.index({ tenant_id: 1, phone: 1 });
propertyOwnerSchema.index({ tenant_id: 1, name: 1 });

module.exports = mongoose.model("PropertyOwner", propertyOwnerSchema);