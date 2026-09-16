const Project = require("../models/Project");
const ProjectUnit = require("../models/ProjectUnits");
const ConstructionMilestone = require("../models/ConstructionMilestone");
const Bookings = require("../models/BuilderBooking");
const Invoice = require("../models/BuilderInvoice");
const Tower = require("../models/TowerModel");
const Units = require("../models/UnitModel");
const mongoose = require("mongoose");

/* ===== PROJECT CRUD ===== */

exports.createProject = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const created_by = req.user._id;
    if (!tenant_id) {
      return res
        .status(400)
        .json({ success: false, message: "Tenant context required." });
    }

    const project = await Project.create({
      ...req.body,
      tenant_id,
      created_by,
    });
    res.status(201).json({ success: true, data: project });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    if (!tenant_id) {
      return res
        .status(400)
        .json({ success: false, message: "x-tenant-id header required." });
    }

    const { status, city, search, page = 1, limit = 20 } = req.query;
    const filter = { tenant_id };

    if (status) filter.project_status = status;
    if (city) filter.city = new RegExp(city, "i");
    if (search?.trim()) filter.project_name = new RegExp(search.trim(), "i");

    const skip = (Number(page) - 1) * Number(limit);

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Project.countDocuments(filter),
    ]);

    // attach a quick unit-count summary per project (available/sold/booked)
    const projectIds = projects.map((p) => p._id);
    const unitStats = await ProjectUnit.aggregate([
      {
        $match: {
          tenant_id: new mongoose.Types.ObjectId(tenant_id),
          project_id: { $in: projectIds },
        },
      },
      {
        $group: {
          _id: { project_id: "$project_id", status: "$status" },
          count: { $sum: 1 },
        },
      },
    ]);

    const statsMap = {};
    unitStats.forEach((s) => {
      const pid = s._id.project_id.toString();
      if (!statsMap[pid])
        statsMap[pid] = { available: 0, booked: 0, sold: 0, blocked: 0 };
      statsMap[pid][s._id.status] = s.count;
    });

    const data = projects.map((p) => ({
      ...p.toObject(),
      unit_stats: statsMap[p._id.toString()] || {
        available: 0,
        booked: 0,
        sold: 0,
        blocked: 0,
      },
    }));

    res.json({
      success: true,
      data,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid project id" });
    }

    const project = await Project.findOne({ _id: id, tenant_id }).populate(
      "created_by",
      "name email",
    );
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    delete req.body.tenant_id;
    delete req.body.created_by;

    const project = await Project.findOneAndUpdate(
      { _id: id, tenant_id },
      { $set: req.body },
      { new: true, runValidators: true },
    );

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    res.json({ success: true, data: project });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const projectId = req.params.id;

    const bookings = await Bookings.find({ projectId: projectId });
    const invoice = await Invoice.find({ project_id: projectId });

    if (bookings.length !== 0 || invoice.length !== 0) {
      return res.status(500).json({
        sucess: false,
        message: "Project is linked to bookings and invoice",
      });
    }

    // 1. Find project
    const project = await Project.findOne({
      _id: projectId,
      tenant_id: req.tenantId,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or already deleted",
      });
    }

    // 2. Find all towers belonging to this project
    const towers = await Tower.find({
      project_id: projectId,
    }).select("_id");

    const towerIds = towers.map((tower) => tower._id);

    // 3. Find all units belonging to this project
    const units = await Units.find({
      project_id: projectId,
    }).select("_id");

    const unitIds = units.map((unit) => unit._id);

    // 4. Delete all units related to this project
    await Units.deleteMany({
      project_id: projectId,
    });

    // 5. Delete all towers related to this project
    await Tower.deleteMany({
      project_id: projectId,
    });

    // 6. Delete the project
    await Project.deleteOne({
      _id: projectId,
      tenant_id: req.tenantId,
    });

    return res.status(200).json({
      success: true,
      message: "Project, towers and units deleted successfully",
      deletedProjectId: projectId,
      deletedTowerCount: towerIds.length,
      deletedUnitCount: unitIds.length,
    });
  } catch (error) {
    console.error("Error deleting project:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addProjectMedia = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;
    const { media_type, label } = req.body;

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const url = `/uploads/projects/${id}/${req.file.filename}`;

    const project = await Project.findOneAndUpdate(
      { _id: id, tenant_id },
      {
        $push: {
          media: { media_type, label: label || "", url, sort_order: 0 },
        },
      },
      { new: true },
    );

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    res.status(201).json({ success: true, data: project.media });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ===== PROJECT UNITS ===== */

exports.createUnit = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params; // project id

    const project = await Project.findOne({ _id: id, tenant_id });
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    const unit = await ProjectUnit.create({
      ...req.body,
      tenant_id,
      project_id: id,
    });

    // keep total_units count in sync
    const count = await ProjectUnit.countDocuments({
      project_id: id,
      tenant_id,
    });
    project.total_units = count;
    await project.save();

    res.status(201).json({ success: true, data: unit });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This unit number already exists in this project.",
      });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getUnitsByProject = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;
    const { status, tower } = req.query;

    const filter = { tenant_id, project_id: id };
    if (status) filter.status = status;
    if (tower) filter.tower_name = tower;

    const units = await ProjectUnit.find(filter).sort({
      tower_name: 1,
      floor_no: 1,
      unit_no: 1,
    });
    res.json({ success: true, data: units });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUnit = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { unitId } = req.params;

    delete req.body.tenant_id;
    delete req.body.project_id;

    const unit = await ProjectUnit.findOneAndUpdate(
      { _id: unitId, tenant_id },
      { $set: req.body },
      { new: true, runValidators: true },
    );

    if (!unit) {
      return res
        .status(404)
        .json({ success: false, message: "Unit not found" });
    }

    res.json({ success: true, data: unit });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteUnit = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { unitId } = req.params;

    const unit = await ProjectUnit.findOneAndDelete({ _id: unitId, tenant_id });
    if (!unit) {
      return res
        .status(404)
        .json({ success: false, message: "Unit not found" });
    }

    const count = await ProjectUnit.countDocuments({
      project_id: unit.project_id,
      tenant_id,
    });
    await Project.findByIdAndUpdate(unit.project_id, { total_units: count });

    res.json({ success: true, message: "Unit deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// duplicate an existing unit as a quick starting point for the next one (v1.5 convenience)
exports.duplicateUnit = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { unitId } = req.params;

    const original = await ProjectUnit.findOne({ _id: unitId, tenant_id });
    if (!original) {
      return res
        .status(404)
        .json({ success: false, message: "Unit not found" });
    }

    const copy = original.toObject();
    delete copy._id;
    copy.unit_no = `${copy.unit_no}-COPY`;
    copy.status = "available";
    copy.linked_property_id = null;

    const newUnit = await ProjectUnit.create(copy);

    const count = await ProjectUnit.countDocuments({
      project_id: original.project_id,
      tenant_id,
    });
    await Project.findByIdAndUpdate(original.project_id, {
      total_units: count,
    });

    res.status(201).json({ success: true, data: newUnit });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ===== CONSTRUCTION MILESTONES ===== */

exports.createMilestone = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    const project = await Project.findOne({ _id: id, tenant_id });
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    const count = await ConstructionMilestone.countDocuments({
      project_id: id,
      tenant_id,
    });
    const milestone = await ConstructionMilestone.create({
      ...req.body,
      tenant_id,
      project_id: id,
      sort_order: count,
    });

    res.status(201).json({ success: true, data: milestone });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getMilestonesByProject = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    const milestones = await ConstructionMilestone.find({
      tenant_id,
      project_id: id,
    }).sort({ sort_order: 1 });
    res.json({ success: true, data: milestones });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateMilestone = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { milestoneId } = req.params;

    delete req.body.tenant_id;
    delete req.body.project_id;

    const milestone = await ConstructionMilestone.findOneAndUpdate(
      { _id: milestoneId, tenant_id },
      { $set: req.body },
      { new: true, runValidators: true },
    );

    if (!milestone) {
      return res
        .status(404)
        .json({ success: false, message: "Milestone not found" });
    }

    res.json({ success: true, data: milestone });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteMilestone = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { milestoneId } = req.params;

    const milestone = await ConstructionMilestone.findOneAndDelete({
      _id: milestoneId,
      tenant_id,
    });
    if (!milestone) {
      return res
        .status(404)
        .json({ success: false, message: "Milestone not found" });
    }

    res.json({ success: true, message: "Milestone deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
