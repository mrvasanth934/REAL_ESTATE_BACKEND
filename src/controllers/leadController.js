const Lead = require("../models/Lead");
const LeadActivity = require("../models/LeadActivity");
const SiteVisit = require("../models/SiteVist");
const mongoose = require("mongoose");

exports.createLead = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const created_by = req.user._id;

    const {
      name,
      phone,
      email,
      source,
      property_interest_id,
      budget_min,
      budget_max,
      preferred_location,
      lead_status,
      lead_score,
      assigned_agent_id,
      lost_reason,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and Phone number are required",
      });
    }

    const payload = {
      tenant_id,
      created_by,
      name,
      phone,
      email,
      source,
      property_interest_id:
        property_interest_id === "" ? null : property_interest_id,
      budget_min,
      budget_max,
      preferred_location,
      lead_status,
      lead_score,
      assigned_agent_id: assigned_agent_id === "" ? null : assigned_agent_id,
      lost_reason: lead_status === "lost" ? lost_reason : "",
    };

    const lead = await Lead.create(payload);

    await LeadActivity.create({
      tenant_id,
      lead_id: lead._id,
      activity_type: "note",
      notes: "Lead created",
      performed_by: created_by,
    });

    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    console.error("Error creating lead:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// LIST — filters: status, agent, source, search
exports.getLeads = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    if (!tenant_id) {
      return res
        .status(400)
        .json({ success: false, message: "x-tenant-id header required." });
    }

    const { status, agent, source, search, page = 1, limit = 20 } = req.query;
    const filter = { tenant_id };

    if (status) filter.lead_status = status;
    if (agent) filter.assigned_agent_id = agent;
    if (source) filter.source = source;
    if (search?.trim()) {
      filter.$or = [
        { name: new RegExp(search.trim(), "i") },
        { phone: new RegExp(search.trim(), "i") },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate("property_interest_id", "title city price")
        .populate("assigned_agent_id", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Lead.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: leads,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// board view — grouped counts by status (for Kanban)
exports.getLeadsBoard = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const statuses = [
      "new",
      "contacted",
      "site_visit_scheduled",
      "negotiation",
      "booked",
      "lost",
      "cold",
    ];

    const grouped = {};
    for (const status of statuses) {
      grouped[status] = await Lead.find({ tenant_id, lead_status: status })
        .populate("assigned_agent_id", "name")
        .populate("property_interest_id", "title")
        .sort({ createdAt: -1 })
        .limit(50); // cap per column for performance
    }

    res.json({ success: true, data: grouped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET SINGLE
exports.getLeadById = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead id" });
    }

    const lead = await Lead.findOne({ _id: id, tenant_id })
      .populate("property_interest_id", "title city price property_type")
      .populate("assigned_agent_id", "name email phone")
      .populate("created_by", "name email");

    if (!lead) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
    }

    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      source,
      property_interest_id,
      budget_min,
      budget_max,
      preferred_location,
      lead_status,
      lead_score,
      assigned_agent_id,
      lost_reason,
    } = req.body;
    const tenant_id = req.tenantId;
    const { id } = req.params;

    delete req.body.tenant_id;
    delete req.body.created_by;

    const existing = await Lead.findOne({ _id: id, tenant_id });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
    }

    const statusChanged =
      lead_status && req.body.lead_status !== existing.lead_status;
    const oldStatus = existing.lead_status;

    const propertyInterestId =
      property_interest_id === "" ? null : property_interest_id;

    const assignedAgentId = assigned_agent_id === "" ? null : assigned_agent_id;

    Object.assign(existing, {
      name,
      phone,
      email,
      source,
      property_interest_id: propertyInterestId,
      budget_min,
      budget_max,
      preferred_location,
      lead_status,
      lead_score,
      assigned_agent_id: assignedAgentId,
      lost_reason,
    });
    await existing.save();

    if (statusChanged) {
      await LeadActivity.create({
        tenant_id,
        lead_id: id,
        activity_type: "status_change",
        notes: `Status changed from ${oldStatus} to ${existing.lead_status}`,
        performed_by: req.user._id,
        old_status: oldStatus,
        new_status: existing.lead_status,
      });
    }

    res.json({ success: true, data: existing });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE
exports.deleteLead = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    const lead = await Lead.findOneAndDelete({ _id: id, tenant_id });
    if (!lead) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
    }

    // cascade cleanup — remove related activities and site visits
    await LeadActivity.deleteMany({ lead_id: id, tenant_id });
    await SiteVisit.deleteMany({ lead_id: id, tenant_id });

    res.json({ success: true, message: "Lead deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ===== LEAD ACTIVITIES ===== */

exports.addLeadActivity = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params; // lead id
    const { activity_type, notes, follow_up_date } = req.body;

    const lead = await Lead.findOne({ _id: id, tenant_id });
    if (!lead) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
    }

    const activity = await LeadActivity.create({
      tenant_id,
      lead_id: id,
      activity_type,
      notes,
      follow_up_date: follow_up_date || null,
      performed_by: req.user._id,
    });

    const populated = await activity.populate("performed_by", "name");
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getLeadActivities = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    const activities = await LeadActivity.find({ tenant_id, lead_id: id })
      .populate("performed_by", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: activities });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ===== SITE VISITS ===== */

exports.createSiteVisit = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params; // lead id

    const lead = await Lead.findOne({ _id: id, tenant_id });
    if (!lead) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
    }

    const visit = await SiteVisit.create({
      ...req.body,
      tenant_id,
      lead_id: id,
    });

    // auto-update lead status
    lead.lead_status = "site_visit_scheduled";
    await lead.save();

    await LeadActivity.create({
      tenant_id,
      lead_id: id,
      activity_type: "status_change",
      notes: "Site visit scheduled",
      performed_by: req.user._id,
      old_status: lead.lead_status,
      new_status: "site_visit_scheduled",
    });

    res.status(201).json({ success: true, data: visit });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getSiteVisitsByLead = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    const visits = await SiteVisit.find({ tenant_id, lead_id: id })
      .populate("property_id", "title city")
      .populate("agent_id", "name")
      .sort({ scheduled_at: -1 });

    res.json({ success: true, data: visits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSiteVisit = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { visitId } = req.params;

    const allowedFields = ["scheduled_at", "status", "feedback"];
    const updateData = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    });

    const visit = await SiteVisit.findOneAndUpdate(
      { _id: visitId, tenant_id },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!visit) {
      return res
        .status(404)
        .json({ success: false, message: "Site visit not found" });
    }

    res.json({ success: true, data: visit });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
// GET /api/leads/site-visits/all — tenant-wide site visits (for sidebar "Site Visits" page)
exports.getAllSiteVisits = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { status, agent, from, to, page = 1, limit = 20 } = req.query;

    const filter = { tenant_id };
    if (status) filter.status = status;
    if (agent) filter.agent_id = agent;
    if (from || to) {
      filter.scheduled_at = {};
      if (from) filter.scheduled_at.$gte = new Date(from);
      if (to) filter.scheduled_at.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [visits, total] = await Promise.all([
      SiteVisit.find(filter)
        .populate("lead_id", "name phone")
        .populate("property_id", "title city")
        .populate("agent_id", "name")
        .sort({ scheduled_at: -1 })
        .skip(skip)
        .limit(Number(limit)),
      SiteVisit.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: visits,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
