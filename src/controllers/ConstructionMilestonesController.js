const ConstructionMilestone = require("../models/ConstructionMilestone");

exports.createMilestone = async (req, res) => {
  try {
    const tenant_id = req.tenantId;

    const {
      project_id,
      tower_id,
      milestone_name,
      planned_date,
      actual_date,
      status,
      payment_trigger_pct,
      sort_order,
    } = req.body;

    console.log(tenant_id, project_id, milestone_name);

    if (!tenant_id || !project_id || !milestone_name) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID, Project ID, and Milestone Name are required",
      });
    }

    const payload = {
      tenant_id,
      tower_id,
      project_id,
      milestone_name,
      planned_date,
      actual_date,
      status,
      payment_trigger_pct,
      sort_order,
    };

    const newMilestone = new ConstructionMilestone(payload);
    const savedMilestone = await newMilestone.save();

    res.status(201).json({
      success: true,
      message: "Milestone created successfully",
      data: savedMilestone,
    });
  } catch (error) {
    console.error("Error creating milestone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMilestones = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { project_id, status } = req.query;

    if (!tenant_id) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Tenant ID missing" });
    }

    let query = { tenant_id };

    if (project_id) query.project_id = project_id;
    if (status) query.status = status;

    const milestones = await ConstructionMilestone.find(query)
      .populate("project_id", "project_name location builder_name")
      .populate("tower_id")
      .sort({ sort_order: 1, planned_date: 1 });

    res.status(200).json({
      success: true,
      count: milestones.length,
      data: milestones,
    });
  } catch (error) {
    console.error("Error fetching milestones:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMilestoneById = async (req, res) => {
  try {
    const tenant_id = req.user ? req.user.tenant_id : req.query.tenant_id;

    const milestone = await ConstructionMilestone.findOne({
      _id: req.params.id,
      tenant_id: tenant_id,
    }).populate("project_id", "project_name");

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: "Milestone not found or unauthorized",
      });
    }

    res.status(200).json({ success: true, data: milestone });
  } catch (error) {
    console.error("Error fetching milestone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateMilestone = async (req, res) => {
  try {
    const tenant_id = req.tenantId;

    const {
      project_id,
      milestone_name,
      planned_date,
      actual_date,
      status,
      payment_trigger_pct,
      sort_order,
    } = req.body;

    const updatePayload = {
      project_id,
      milestone_name,
      planned_date,
      actual_date,
      status,
      payment_trigger_pct,
      sort_order,
    };

    const updatedMilestone = await ConstructionMilestone.findOneAndUpdate(
      { _id: req.params.id, tenant_id: tenant_id },
      updatePayload,
      { new: true, runValidators: true },
    ).populate("project_id", "project_name");

    if (!updatedMilestone) {
      return res.status(404).json({
        success: false,
        message: "Milestone not found or unauthorized",
      });
    }

    res.status(200).json({
      success: true,
      message: "Milestone updated successfully",
      data: updatedMilestone,
    });
  } catch (error) {
    console.error("Error updating milestone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteMilestone = async (req, res) => {
  try {
    const tenant_id = req.tenantId;

    const deletedMilestone = await ConstructionMilestone.findOneAndDelete({
      _id: req.params.id,
      tenant_id: tenant_id,
    });

    if (!deletedMilestone) {
      return res.status(404).json({
        success: false,
        message: "Milestone not found or unauthorized",
      });
    }

    res.status(200).json({
      success: true,
      message: "Milestone deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting milestone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
