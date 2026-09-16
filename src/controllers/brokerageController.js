const mongoose = require("mongoose");
const Brokerage = require("../models/Brokerage");

const editableFields = [
  "broker_name",
  "commission_amount",
  "commission_rate",
  "payout_amount",
  "conversion_rate",
  "payout_date",
  "pipeline_stage",
  "agency_split",
  "agent_split",
  "external_broker_split",
];

const pickFields = (body) =>
  editableFields.reduce((payload, field) => {
    if (body[field] !== undefined) payload[field] = body[field];
    return payload;
  }, {});

const validatePayload = (payload) => {
  if (!payload.broker_name?.trim()) return "Broker name is required";
  if (
    payload.commission_amount === undefined ||
    payload.commission_amount === ""
  ) {
    return "Commission amount is required";
  }
  if (payload.commission_rate === undefined || payload.commission_rate === "") {
    return "Commission rate is required";
  }
  if (payload.payout_amount === undefined || payload.payout_amount === "") {
    return "Payout amount is required";
  }
  if (!payload.payout_date) return "Payout date is required";
  return null;
};

exports.getBrokerages = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res
        .status(400)
        .json({ success: false, message: "x-tenant-id header required." });
    }
    const data = await Brokerage.find({ tenant_id: req.tenantId }).sort({
      payout_date: 1,
      createdAt: -1,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBrokerageById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid brokerage id" });
    }
    const data = await Brokerage.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });
    if (!data)
      return res
        .status(404)
        .json({ success: false, message: "Brokerage record not found" });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createBrokerage = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Tenant context required to create brokerage record.",
        });
    }
    const payload = pickFields(req.body);
    const validationError = validatePayload(payload);
    if (validationError)
      return res.status(400).json({ success: false, message: validationError });
    const data = await Brokerage.create({
      ...payload,
      tenant_id: req.tenantId,
      created_by: req.user._id,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateBrokerage = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Tenant context required to update brokerage record.",
        });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid brokerage id" });
    }
    const payload = pickFields(req.body);
    const existing = await Brokerage.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Brokerage record not found" });
    const validationError = validatePayload({
      ...existing.toObject(),
      ...payload,
    });
    if (validationError)
      return res.status(400).json({ success: false, message: validationError });
    Object.assign(existing, payload);
    await existing.save();
    res.json({ success: true, data: existing });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteBrokerage = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Tenant context required to delete brokerage record.",
        });
    }
    const data = await Brokerage.findOneAndDelete({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });
    if (!data)
      return res
        .status(404)
        .json({ success: false, message: "Brokerage record not found" });
    res.json({ success: true, message: "Brokerage record deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
