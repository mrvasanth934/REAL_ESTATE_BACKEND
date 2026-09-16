const PlatformSettings = require("../models/PlatformSettings");

exports.getSettings = async (req, res) => {
  try {
    let settings = await PlatformSettings.findOne();
    if (!settings) settings = await PlatformSettings.create({});
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const allowedFields = ["cgst_percent", "sgst_percent", "default_trial_days", "grace_period_days", "invoice_prefix", "currency"];
    const updateData = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });

    let settings = await PlatformSettings.findOne();
    if (!settings) settings = await PlatformSettings.create(updateData);
    else { Object.assign(settings, updateData); await settings.save(); }

    res.json({ success: true, data: settings, message: "Settings updated." });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};