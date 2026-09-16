const SiteVisit = require("../models/SiteVist");

exports.createSiteVisit = async (req, res) => {
  try {
    const { lead_id, property_id, scheduled_at, agent_id, status, feedback } =
      req.body;

    if (!lead_id || !property_id || !scheduled_at || !agent_id) {
      return res.status(400).json({
        success: false,
        message: "Lead, Property, Agent, and Scheduled Date are required.",
      });
    }

    const scheduledDate = new Date(scheduled_at);

    if (scheduledDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Scheduled time cannot be in the past.",
      });
    }

    const existingVisit = await SiteVisit.findOne({
      tenant_id: req.tenantId,
      agent_id: agent_id,
      scheduled_at: scheduledDate,
      status: { $nin: ["cancelled", "no_show"] },
    });

    if (existingVisit) {
      return res.status(400).json({
        success: false,
        message:
          "This Agent already has another site visit scheduled at this exact time.",
      });
    }

    const newSiteVisit = new SiteVisit({
      tenant_id: req.tenantId,
      lead_id,
      property_id,
      scheduled_at,
      agent_id,
      status,
      feedback,
    });

    const savedVisit = await newSiteVisit.save();

    res.status(201).json({
      success: true,
      message: "Site visit scheduled successfully",
      data: savedVisit,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error scheduling site visit",
      error: error.message,
    });
  }
};

exports.getSiteVisits = async (req, res) => {
  try {
    const { tenant_id, agent_id, status, lead_id } = req.query;

    // Build Query
    let query = {};
    if (tenant_id) query.tenant_id = tenant_id;
    if (agent_id) query.agent_id = agent_id;
    if (status) query.status = status;
    if (lead_id) query.lead_id = lead_id;

    const siteVisits = await SiteVisit.find(query)
      .populate("lead_id", "name email phone")
      .populate("property_id", "title location price")
      .populate("agent_id", "name email")
      .sort({ scheduled_at: -1 });

    res.status(200).json({
      success: true,
      count: siteVisits.length,
      data: siteVisits,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching site visits",
      error: error.message,
    });
  }
};

exports.getSiteVisitById = async (req, res) => {
  try {
    const { id } = req.params;

    const siteVisit = await SiteVisit.findById(id)
      .populate("lead_id", "name email phone")
      .populate("property_id", "title location price")
      .populate("agent_id", "name email");

    if (!siteVisit) {
      return res
        .status(404)
        .json({ success: false, message: "Site visit not found" });
    }

    res.status(200).json({
      success: true,
      data: siteVisit,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching site visit details",
      error: error.message,
    });
  }
};

exports.updateSiteVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const { lead_id, property_id, scheduled_at, agent_id } = req.body;

    if (!lead_id || !property_id || !scheduled_at || !agent_id) {
      return res.status(400).json({
        success: false,
        message: "Lead, Property, Agent, and Scheduled Date are required.",
      });
    }

    const updatedVisit = await SiteVisit.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedVisit) {
      return res
        .status(404)
        .json({ success: false, message: "Site visit not found" });
    }

    res.status(200).json({
      success: true,
      message: "Site visit updated successfully",
      data: updatedVisit,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating site visit",
      error: error.message,
    });
  }
};

// 5. Delete a Site Visit
exports.deleteSiteVisit = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedVisit = await SiteVisit.findByIdAndDelete(id);

    if (!deletedVisit) {
      return res
        .status(404)
        .json({ success: false, message: "Site visit not found" });
    }

    res.status(200).json({
      success: true,
      message: "Site visit deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting site visit",
      error: error.message,
    });
  }
};
