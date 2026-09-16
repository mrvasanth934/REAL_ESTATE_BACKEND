const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  doc_type: {
    type: String,
    enum: [
      "sale_agreement",
      "patta",
      "ec",
      "rera_cert",
      "kyc",
      "allotment_letter",
      "noc",
    ],
    required: true,
  },
  file_url: {
    type: String,
    required: true,
  },
  uploaded_by: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "uploaded_by_model",
  },

  uploaded_by_model: {
    type: String,
    required: true,
    enum: ["User", "SuperAdmin"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = documentSchema;

