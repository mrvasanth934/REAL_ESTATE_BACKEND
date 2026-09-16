const generatedSchema = require("../models/lastGenerated");

exports.updateLastGenerated = async (req, res) => {
  try {
    const { documentName } = req.body;

    if (!documentName) {
      return res.status(400).json({
        success: false,
        message: "documentName is required",
      });
    }

    const now = new Date();

    let result = await generatedSchema.findOne();

    if (!result) {
      result = await generatedSchema.create({
        last_generated: [
          {
            reportName: documentName,
            last_reported: now,
          },
        ],
      });
    } else {
      const existingReport = result.last_generated.find(
        (item) => item.reportName === documentName,
      );

      if (existingReport) {
        existingReport.last_reported = now;
      } else {
        result.last_generated.push({
          reportName: documentName,
          last_reported: now,
        });
      }

      await result.save();
    }

    return res.status(200).json({
      success: true,
      message: "Last generated updated successfully",
      data: result,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getLastGenerated = async (req, res) => {
  try {
    const result = await generatedSchema.find();

    if (!result || result.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No generated history found",
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Last generated fetched successfully",
      data: result,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};
