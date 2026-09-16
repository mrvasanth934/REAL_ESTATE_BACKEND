const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");


const deviceSessionSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true },
    token: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      default: "",
    },
    deviceInformation: {
      deviceName: { type: String, default: "Unknown Device" },
      browser: { type: String, default: "Unknown" },
      operatingSystem: { type: String, default: "Unknown" },
      deviceType: { type: String, default: "desktop" },
      platform: { type: String, default: "" },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const loginHistorySchema = new mongoose.Schema(
  {
    time: { type: Date, default: Date.now },
    ipAddress: { type: String, default: "" },
    deviceInformation: {
      deviceName: { type: String, default: "Unknown Device" },
      browser: { type: String, default: "Unknown" },
      operatingSystem: { type: String, default: "Unknown" },
      deviceType: { type: String, default: "desktop" },
      platform: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["Success", "Failed"],
      default: "Success",
    },
  },
  { _id: false }
);

const superAdminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    name: {
      type: String,
      trim: true,
      default: "Super Admin",
    },
    role: {
      type: String,
      default: "super_admin",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    deviceSession: [
      deviceSessionSchema
    ],
    loginHistory: [loginHistorySchema],
    otp: {
      type: String
    },
    otpExpiresAt: {
      type: Date
    },
  },
  { timestamps: true }
);

superAdminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

superAdminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

superAdminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("SuperAdmin", superAdminSchema);
