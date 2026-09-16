const mongoose = require("mongoose");
const linkSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const notificationSchema = new mongoose.Schema(
  {
    sentRole: {
      type: String,
      enum: [
        "super_admin",
        "admin",
        "tenant_owner",
        "manager",
        "accountant",
        "agent",
      ],
      default: "agent",
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    title: { type: String, trim: true, required: true },
    message: { type: String, trim: true, required: true },
    links: { type: String, trim: true, default: "" },

    trigger_type: {
      type: String,
      trim: true,
      default: "general",
    },

    channel: {
      type: String,
      enum: ["in_app", "email", "sms", "whatsapp", "push"],
      default: "in_app",
    },

    status: {
      type: String,
      enum: ["pending", "scheduled", "sent", "failed"],
      default: "pending",
    },
    isRead: {
      type: Boolean,
      default: false,
    },

    sent_at: { type: Date, default: Date.now() },
  },
  { timestamps: true },
);

notificationSchema.index({ tenant_id: 1, status: 1 });
notificationSchema.index({ tenant_id: 1, channel: 1 });
notificationSchema.index({ tenant_id: 1, createdAt: -1 });
notificationSchema.index({ "to.user_id": 1, "to.is_read": 1 });

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
