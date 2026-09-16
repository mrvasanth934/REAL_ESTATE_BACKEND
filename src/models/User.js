const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const documentSchema = require("./RentalOwnerDocument");

const deviceSessionSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true },
    token: {
      type: String,
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
  { _id: true }, // Each session gets a unique ID so you can target a specific device to log out
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
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
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
    role: {
      type: String,
      enum: [
        "super_admin",
        "admin",
        "tenant_owner",
        "manager",
        "accountant",
        "agent",
      ],
      default: "tenant_owner",
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
    deviceSession: [deviceSessionSchema],
    loginHistory: [loginHistorySchema],
    avatar: {
      type: String,
      default: "Person",
    },
    documents: {
      type: [documentSchema],
      default: [],
    },
    otp: {
      type: String,
    },
    otpExpiresAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
