const MaintenanceRequest = require("../models/MaintenanceRequest");

exports.createMaintenanceRequest = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const created_by = req.user ? req.user._id : req.body.created_by;

    const {
      ticket_number,
      property_id,
      rental_tenant_id,
      booking_id,
      title,
      description,
      category,
      priority,
      status,
      scheduled_date,
      assigned_to,
      vendor_name,
      vendor_phone,
      estimated_cost,
      cost_borne_by,
      attachments,
    } = req.body;

    if (!tenant_id || !created_by || !property_id || !title) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID, Created By, Property ID, and Title are required.",
      });
    }

    const generatedTicketNumber =
      ticket_number || `TKT-${Date.now().toString().slice(-6)}`;

    const payload = {
      tenant_id,
      created_by,
      ticket_number: generatedTicketNumber,
      property_id,
      rental_tenant_id: req.user,
      booking_id: booking_id === "" ? null : booking_id,
      title,
      description,
      category,
      priority,
      status,
      scheduled_date: scheduled_date === "" ? null : scheduled_date,
      assigned_to: assigned_to === "" ? null : assigned_to,
      vendor_name,
      vendor_phone,
      estimated_cost,
      cost_borne_by,
      attachments,
    };

    const newRequest = new MaintenanceRequest(payload);
    const savedRequest = await newRequest.save();

    res.status(201).json({
      success: true,
      message: "Maintenance request created successfully",
      data: savedRequest,
    });
  } catch (error) {
    console.error("Error creating maintenance request:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMaintenanceRequests = async (req, res) => {
  try {
    const tenant_id = req.tenantId;

    if (!tenant_id) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Tenant ID missing" });
    }

    let query = { tenant_id };

    const { property_id, status, priority, category } = req.query;
    if (property_id) query.property_id = property_id;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    const requests = await MaintenanceRequest.find(query)
      .populate("property_id")
      .populate("assigned_to", "name email")
      .populate("rental_tenant_id")
      .populate("tenant_id")
      .sort({ reported_date: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("Error fetching maintenance requests:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMaintenanceRequestById = async (req, res) => {
  try {
    const tenant_id = req.user ? req.user.tenant_id : req.query.tenant_id;

    const request = await MaintenanceRequest.findOne({
      _id: req.params.id,
      tenant_id: tenant_id,
    })
      .populate("property_id", "title address")
      .populate("assigned_to", "name email")
      .populate("rental_tenant_id", "name phone");

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found or unauthorized" });
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error("Error fetching maintenance request:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateMaintenanceRequest = async (req, res) => {
  try {
    const tenant_id = req.tenantId;

    const {
      property_id,
      rental_tenant_id,
      booking_id,
      title,
      description,
      category,
      priority,
      status,
      scheduled_date,
      assigned_to,
      vendor_name,
      vendor_phone,
      estimated_cost,
      actual_cost,
      cost_borne_by,
      resolution_notes,
      tenant_rating,
      tenant_feedback,
    } = req.body;

    const updatePayload = {
      property_id,
      rental_tenant_id: rental_tenant_id === "" ? null : rental_tenant_id,
      booking_id: booking_id === "" ? null : booking_id,
      title,
      description,
      category,
      priority,
      status,
      scheduled_date: scheduled_date === "" ? null : scheduled_date,
      assigned_to: assigned_to === "" ? null : assigned_to,
      vendor_name,
      vendor_phone,
      estimated_cost,
      actual_cost,
      cost_borne_by,
      resolution_notes,
      tenant_rating,
      tenant_feedback,
    };

    if (status === "resolved" || status === "closed") {
      updatePayload.resolved_date = Date.now();
    } else if (status === "open" || status === "in_progress") {
      updatePayload.resolved_date = null;
    }

    const updatedRequest = await MaintenanceRequest.findOneAndUpdate(
      { _id: req.params.id, tenant_id: tenant_id },
      updatePayload,
      { new: true, runValidators: true },
    )
      .populate("property_id", "title address")
      .populate("assigned_to", "name");

    if (!updatedRequest) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found or unauthorized" });
    }

    res.status(200).json({
      success: true,
      message: "Maintenance request updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error updating maintenance request:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteMaintenanceRequest = async (req, res) => {
  try {
    const tenant_id = req.tenantId;

    const deletedRequest = await MaintenanceRequest.findOneAndDelete({
      _id: req.params.id,
      tenant_id: tenant_id,
    });

    if (!deletedRequest) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found or unauthorized" });
    }

    res.status(200).json({
      success: true,
      message: "Maintenance request deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting maintenance request:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
