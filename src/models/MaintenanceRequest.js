const mongoose = require("mongoose");

const maintenanceRequestSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    ticket_number: { type: String, trim: true, default: "" },

    property_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    rental_tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RentalTenant",
      default: null,
    },
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RentalBooking",
      default: null,
    },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },

    category: {
      type: String,
      enum: [
        "plumbing",
        "electrical",
        "carpentry",
        "appliance",
        "painting",
        "pest_control",
        "cleaning",
        "structural",
        "other",
      ],
      default: "other",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "assigned", "in_progress", "on_hold", "resolved", "closed", "cancelled"],
      default: "open",
    },

    reported_date: { type: Date, default: Date.now },
    scheduled_date: { type: Date, default: null },
    resolved_date: { type: Date, default: null },

    assigned_to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    vendor_name: { type: String, trim: true, default: "" },
    vendor_phone: { type: String, trim: true, default: "" },

    estimated_cost: { type: Number, default: 0 },
    actual_cost: { type: Number, default: 0 },
    cost_borne_by: {
      type: String,
      enum: ["owner", "tenant", "agency", "shared"],
      default: "owner",
    },

    resolution_notes: { type: String, trim: true, default: "" },
    tenant_rating: { type: Number, min: 1, max: 5, default: null },
    tenant_feedback: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

maintenanceRequestSchema.index({ tenant_id: 1, status: 1 });
maintenanceRequestSchema.index({ tenant_id: 1, property_id: 1 });
maintenanceRequestSchema.index({ tenant_id: 1, priority: 1 });

module.exports =
  mongoose.models.MaintenanceRequest ||
  mongoose.model("MaintenanceRequest", maintenanceRequestSchema);
