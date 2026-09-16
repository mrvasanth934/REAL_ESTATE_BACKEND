const Project = require("../models/Project");
const TowerModel = require("../models/TowerModel");
const Unit = require("../models/UnitModel");
const Bookings = require("../models/BuilderBooking");
const Invoice = require("../models/BuilderInvoice");

exports.createUnit = async (req, res) => {
  try {
    const {
      project_id,
      tower_id,
      floor_no,
      unit_no,
      unit_type,
      area_sqft,
      base_price,
      status,
      owner_name,
      linked_property_id,
    } = req.body;

    if (!project_id || !unit_no) {
      return res.status(400).json({
        success: false,
        message: "Project ID and Unit Number are required",
      });
    }

    const newUnit = new Unit({
      tenant_id:req.tenantId,
      project_id,
      tower_id,
      floor_no,
      unit_no,
      unit_type,
      area_sqft,
      base_price,
      status,
      owner_name,
      linked_property_id,
    });

    const savedUnit = await newUnit.save();

    if(!savedUnit){
      return res.status(400).json({
        success: false,
        message: "unit can`t saved",
      });
    }

    const project = await Project.findOne({_id:project_id})

    project && project.units.push(savedUnit._id) 
    
    project.save()

    const tower = await TowerModel.findOne({_id:tower_id})

    tower.units.push(savedUnit._id)

    tower.save()

    res.status(201).json({
      success: true,
      message: "Unit created successfully",
      data: savedUnit,
    });
  } catch (error) {
    console.error("Error creating unit:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUnits = async (req, res) => {
  try {
    const { project_id, status, tower_name } = req.query;
    let query = {};

    // Filters for API
    query.tenant_id = req.tenantId
    if (project_id) query.project_id = project_id;
    if (status) query.status = status;
    if (tower_name) query.tower_name = tower_name;

    const units = await Unit.find(query)
      .populate("project_id", "project_name location builder_name")
      .populate("tower_id")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: units.length,
      data: units,
    });
  } catch (error) {
    console.error("Error fetching units:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUnitById = async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id).populate(
      "project_id",
      "project_name",
    );

    if (!unit) {
      return res
        .status(404)
        .json({ success: false, message: "Unit not found" });
    }

    return res.status(200).json({ success: true, data: unit });
  } catch (error) {
    console.error("Error fetching unit:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUnit = async (req, res) => {
  try {
    // Logic: If status is changed back to available/blocked, clear the owner name
    if (req.body.status === "available" || req.body.status === "blocked") {
      req.body.owner_name = "";
    }

    const updatedUnit = await Unit.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("project_id", "project_name");

    if (!updatedUnit) {
      return res
        .status(404)
        .json({ success: false, message: "Unit not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Unit updated successfully",
      data: updatedUnit,
    });
  } catch (error) {
    console.error("Error updating unit:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteUnit = async (req, res) => {
  try {

    const { id } = req.params;

    const bookings = Bookings.find({ unitId: id });
    const invoices = Invoice.find({ unit_id: id });

    if (bookings.length !== 0 || invoices.length !== 0) {
      return res.status(500).json({
        success: false,
        message: "Unit is linked to bookings or invoices",
      });
    }
    await TowerModel.updateOne({_id:req.params.tower_id},{$pull:{units:req.params.id}})

    const tower = await TowerModel.findOne({_id:req.params.tower_id})

    await Project.updateOne({_id:tower.project_id},{$pull:{units:req.params.id}})

    const deletedUnit = await Unit.findByIdAndDelete(req.params.id);

    if (!deletedUnit) {
      return res
        .status(404)
        .json({ success: false, message: "Unit not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Unit deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting unit:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
