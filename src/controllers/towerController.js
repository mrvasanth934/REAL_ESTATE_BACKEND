const Tower = require("../models/TowerModel");

const Project = require('../models/Project')

const Units = require('../models/UnitModel');

const createTower = async (req, res) => {
  try {
    const {
      project_id,
      tower_name, 
      tower_code,
      tower_type,
      tower_status,
      total_floors,
      total_units,
      units_per_floor,
      configuration,
      start_date,
      expected_completion_date,
      description,
      amenities,
      image_url,
    } = req.body;

    if (!project_id || !tower_name) {
      return res.status(400).json({
        success: false,
        message: "Project ID and Tower Name are required.",
      });
    }

    const isExistProject = await Project.findOne({ _id: project_id })

    if (!isExistProject) {
      return res.status(400).json({
        success: false,
        message: "can`t find this Project",
      });
    }

    const newTower = await Tower.create({
      tenant_id: req.tenantId,
      created_by: req.user._id,
      project_id,
      tower_name,
      tower_code,
      tower_type,
      tower_status: tower_status || "Active",
      total_floors,
      total_units,
      units_per_floor,
      configuration,
      start_date,
      expected_completion_date,
      description,
      amenities,
      image_url,
    });

    if (!newTower) {
      return res.status(400).json({
        success: false,
        message: "Can`t create New Tower",
      });
    }

    isExistProject.towers.push(newTower._id)

    await isExistProject.save()

    res.status(201).json({
      success: true,
      message: "Tower created successfully",
      data: newTower,
    });
  } catch (error) {
    console.error("Error creating tower:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTowers = async (req, res) => {
  try {
    const { project_id } = req.query;

    // 1. Base query ensures tenant isolation
    const query = { tenant_id: req.tenantId };

    if (project_id) {
      query.project_id = project_id;
    }

    // 3. Fetch towers & populate project details if needed
    const towers = await Tower.find(query)
      .populate("project_id", "project_name location") // Brings basic project info
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: towers.length,
      data: towers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTowerById = async (req, res) => {
  try {
    const tower = await Tower.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId, // Ensure they only fetch their own tenant's tower
    }).populate("project_id", "project_name builder_name location");

    if (!tower) {
      return res
        .status(404)
        .json({ success: false, message: "Tower not found" });
    }

    res.status(200).json({ success: true, data: tower });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateTower = async (req, res) => {
  try {
    // 1. Check if tower exists AND belongs to the tenant
    let tower = await Tower.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });

    if (!tower) {
      return res
        .status(404)
        .json({ success: false, message: "Tower not found or unauthorized" });
    }

    // 2. Prevent modifying tenant_id or created_by during update
    delete req.body.tenant_id;
    delete req.body.created_by;

    // 3. Update the document
    tower = await Tower.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      message: "Tower updated successfully",
      data: tower,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteTower = async (req, res) => {
  try {
    const towerId = req.params.id;

    // 1. Find the tower using tower ID + tenant ID
    const tower = await Tower.findOne({
      _id: towerId,
      tenant_id: req.tenantId,
    });

    if (!tower) {
      return res.status(404).json({
        success: false,
        message: "Tower not found or already deleted",
      });
    }

    // Get project ID directly from the tower
    // This is safer than trusting req.params.project_id
    const projectId = tower.project_id;

    // 2. Find all units belonging to this tower
    const unitsByTower = await Units.find({
      tower_id: towerId,
    }).select("_id");

    // Store only the Unit IDs
    const unitIds = unitsByTower.map((unit) => unit._id);

    // 3. Remove tower ID from Project.towers
    // Also remove all related Unit IDs from Project.units
    await Project.updateOne(
      {
        _id: projectId,
        tenant_id: req.tenantId,
      },
      {
        $pull: {
          towers: towerId,
          units: {
            $in: unitIds,
          },
        },
      }
    );

    // 4. Delete all units belonging to this tower
    await Units.deleteMany({
      tower_id: towerId,
    });

    // 5. Delete the tower
    await Tower.deleteOne({
      _id: towerId,
      tenant_id: req.tenantId,
    });

    return res.status(200).json({
      success: true,
      message: "Tower and all related units deleted successfully",
      deletedTowerId: towerId,
      deletedUnitCount: unitIds.length,
    });

  } catch (error) {
    console.error("Error deleting tower:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const bulkCreateTowers = async (req, res) => {
  try {
    const towers = req.body;

    // 1. Body should be an array
    if (!Array.isArray(towers) || towers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Tower data must be a non-empty array.",
      });
    }

    // 2. Validate required fields
    const invalidIndex = towers.findIndex(
      (tower) => !tower.project_id || !tower.tower_name
    );

    if (invalidIndex !== -1) {
      return res.status(400).json({
        success: false,
        message: `Project ID and Tower Name are required at row ${invalidIndex + 1
          }.`,
      });
    }

    // 3. Add tenant and user details
    const towerData = towers.map((tower) => ({
      tenant_id: req.tenantId,
      created_by: req.user._id,
      project_id: tower.project_id,
      tower_name: tower.tower_name,
      tower_code: tower.tower_code,
      tower_type: tower.tower_type,
      tower_status: tower.tower_status || "Active",
      total_floors: tower.total_floors,
      total_units: tower.total_units,
      units_per_floor: tower.units_per_floor,
      configuration: tower.configuration,
      start_date: tower.start_date,
      expected_completion_date: tower.expected_completion_date,
      description: tower.description,
      amenities: tower.amenities,
      image_url: tower.image_url,
    }));

    // 4. Insert all towers
    const newTowers = await Tower.insertMany(towerData);

    res.status(201).json({
      success: true,
      message: `${newTowers.length} towers created successfully`,
      count: newTowers.length,
      data: newTowers,
    });
  } catch (error) {
    console.error("Error importing towers:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createTower,
  getTowers,
  getTowerById,
  updateTower,
  deleteTower,
  bulkCreateTowers,
};
