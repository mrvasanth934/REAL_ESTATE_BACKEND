const mongoose = require("mongoose");

const generatedSchema = new mongoose.Schema(
  {
    last_generated: [
      {
        reportName: {
          type: String,
        },
        last_reported: Date,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Lastgenerated", generatedSchema);
