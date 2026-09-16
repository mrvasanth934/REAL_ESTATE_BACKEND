const jwt = require("jsonwebtoken");
const User = require("../models/User");
const SuperAdmin = require("../models/SuperAdmin");
const Tenant = require("../models/Tenant");
const bcrypt = require("bcryptjs");
const nodemailer = require('nodemailer');
const { createNotification } = require("./notificationController");

const generateToken = (id, userType = "tenant_user") => {
  return jwt.sign({ id, userType }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const checkSetup = async (req, res) => {
  try {
    const superAdmin = await SuperAdmin.findOne({});
    return res.status(200).json({
      success: true,
      setupRequired: !superAdmin,
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const setupSuperAdmin = async (req, res) => {
  try {
    const existing = await SuperAdmin.findOne({});
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Super Admin already exists. Please login.",
      });
    }

    const { username, email, password, name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const superAdmin = await SuperAdmin.create({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password,
      name: name?.trim() || "Super Admin",
      role: "super_admin",
      isActive: true,
    });

    const token = generateToken(superAdmin._id, "super_admin");

    return res.status(201).json({
      success: true,
      message: "Super Admin created successfully. Welcome!",
      token,
      user: {
        id: superAdmin._id,
        username: superAdmin.username,
        email: superAdmin.email,
        role: superAdmin.role,
        lastLoginAt: superAdmin.lastLoginAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Username or email already taken.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const login = async (req, res,) => {
  try {
    const { username, password, deviceInformation, deviceId } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    let account = await SuperAdmin.findOne({
      username: username.toLowerCase().trim(),
    }).select("+password");
    let accountType = "super_admin";

    if (!account) {
      account = await User.findOne({
        username: username.toLowerCase().trim(),
      }).select("+password");
      accountType = "tenant_user";
    }

    if (!account) {
      return res.status(401).json({
        success: false,
        message: "Username not found.",
      });
    }

    const recordLoginHistory = async (status) => {
      try {
        account.loginHistory = account.loginHistory || [];
        account.loginHistory.unshift({
          time: new Date(),
          ipAddress: clientIp,
          deviceInformation: deviceInformation || {},
          status,
        });
        account.loginHistory = account.loginHistory.slice(0, 5);
        await account.save({ validateBeforeSave: false });
      } catch (e) {
        // Never block login flow because of history logging failure
      }
    };

    if (!account.isActive) {
      await recordLoginHistory("Failed");
      return res
        .status(401)
        .json({ success: false, message: "Account is deactivated." });
    }

    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) {
      await recordLoginHistory("Failed");
      return res.status(401).json({
        success: false,
        message: "Incorrect password.",
      });
    }

    if (account.twoFactorEnabled === true) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expireTime = new Date(Date.now() + 5 * 60 * 1000);

      const transport = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL,
          pass: process.env.EMAIL_PASS,
        },
      });

      account.otp = otp;
      account.otpExpiresAt = expireTime;

      await account.save({ validateBeforeSave: false });

      await transport.sendMail({
        from: process.env.EMAIL,
        to: account.email,
        subject: "Your One-Time Password",
        html: `
      <div style="font-family: Arial; padding: 30px;">
        <h2>Verify Your Account</h2>

        <p>Your login verification code is:</p>

        <h1 style="letter-spacing: 8px;">
          ${otp}
        </h1>

        <p>
          This OTP is valid for <b>5 minutes</b>.
        </p>

        <p>
          Please do not share this OTP with anyone.
        </p>
      </div>
    `,
      });

      return res.status(200).json({
        success: true,
        requiresTwoFactor: true,
        message: "OTP sent to your registered email address.",
        user: {
          id: account._id,
          username: account.username,
          email: account.email,
          role: account.role,
          tenant_id: account.tenant_id || null,
          twoFactorEnabled: true,
        },
      });
    }
    else {
      const currentTime = new Date();
      account.lastLoginAt = currentTime;

      const token = generateToken(account._id, accountType);

      if (deviceId && account.deviceSession) {
        const existingSessionIndex = account.deviceSession.findIndex(
          (session) => session.deviceId === deviceId
        );

        if (existingSessionIndex > -1) {
          account.deviceSession[existingSessionIndex].lastLoginAt = currentTime;
          account.deviceSession[existingSessionIndex].token = token;
          account.deviceSession[existingSessionIndex].ipAddress = clientIp;
          account.deviceSession[existingSessionIndex].isActive = true;
          if (deviceInformation) {
            account.deviceSession[existingSessionIndex].deviceInformation = deviceInformation;
          }
        } else {
          account.deviceSession.push({
            deviceId,
            token,
            ipAddress: clientIp,
            deviceInformation: deviceInformation || {},
            isActive: true,
            lastLoginAt: currentTime,
          });
        }
      }

      account.loginHistory = account.loginHistory || [];
      account.loginHistory.unshift({
        time: currentTime,
        ipAddress: clientIp,
        deviceInformation: deviceInformation || {},
        status: "Success",
      });
      account.loginHistory = account.loginHistory.slice(0, 20);

      await account.save({ validateBeforeSave: false });
      let business_type = null;
      if (accountType === "tenant_user" && account.tenant_id) {
        const tenant = await Tenant.findById(account.tenant_id).select(
          "business_type"
        );
        business_type = tenant?.business_type || null;
      }

      const deviceName = deviceInformation?.deviceName || deviceInformation?.browser || "Unknown Device";
      const osName = deviceInformation?.operatingSystem ? ` (${deviceInformation.operatingSystem})` : "";

      const formattedTime = currentTime.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });

      const notificationTitle = "New Login Detected";
      const notificationMessage = `Your account was logged in from ${deviceName}${osName} on ${formattedTime}.`;

      await createNotification(
        account.role == "super_admin" ? "" : account._id,
        account.role,
        notificationTitle,
        notificationMessage
      );

      return res.status(200).json({
        success: true,
        message: "Login successful.",
        token,
        user: {
          id: account._id,
          username: account.username,
          email: account.email,
          role:
            account.role ||
            (accountType === "super_admin" ? "super_admin" : "tenant_user"),
          tenant_id: account.tenant_id || null,
          business_type,
          lastLoginAt: account.lastLoginAt,
          twoFactorEnabled: !!account.twoFactorEnabled,
        },
      });
    }
  } catch (error) {
    console.log(error);

    return res
      .status(500)
      .json({ success: false, message: "Server error. Try again." });
  }
};

const verifyEmailAddress = async (req, res) => {
  try {
    const { userId, otp, deviceInformation, deviceId } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        success: false,
        message: "User ID and OTP are required.",
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be 6 digits.",
      });
    }

    // Find account
    let account = await User.findById(userId);
    let accountType = "tenant_user";

    if (!account) {
      account = await SuperAdmin.findById(userId);
      accountType = "super_admin";
    }

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    // OTP exists?
    if (!account.otp || !account.otpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP not found. Please request a new OTP.",
      });
    }

    // OTP expired?
    if (new Date() > new Date(account.otpExpiresAt)) {
      account.otp = undefined;
      account.otpExpiresAt = undefined;

      await account.save({ validateBeforeSave: false });

      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    // OTP incorrect?
    if (account.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    // OTP correct
    const currentTime = new Date();

    // IMPORTANT: OTP can be used only once
    account.otp = undefined;
    account.otpExpiresAt = undefined;

    account.lastLoginAt = currentTime;

    // Generate actual login token ONLY after OTP verification
    const token = generateToken(account._id, accountType);

    // Device session
    if (deviceId && account.deviceSession) {
      const existingSessionIndex = account.deviceSession.findIndex(
        (session) => session.deviceId === deviceId
      );

      if (existingSessionIndex > -1) {
        account.deviceSession[existingSessionIndex].lastLoginAt = currentTime;
        account.deviceSession[existingSessionIndex].token = token;
        account.deviceSession[existingSessionIndex].isActive = true;
        account.deviceSession[existingSessionIndex].ipAddress =
          req.headers["x-forwarded-for"] || req.socket.remoteAddress;

        if (deviceInformation) {
          account.deviceSession[
            existingSessionIndex
          ].deviceInformation = deviceInformation;
        }
      } else {
        account.deviceSession.push({
          deviceId,
          token,
          ipAddress:
            req.headers["x-forwarded-for"] || req.socket.remoteAddress,
          deviceInformation: deviceInformation || {},
          isActive: true,
          lastLoginAt: currentTime,
        });
      }
    }

    // Login history
    account.loginHistory = account.loginHistory || [];

    account.loginHistory.unshift({
      time: currentTime,
      ipAddress:
        req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      deviceInformation: deviceInformation || {},
      status: "Success",
    });

    account.loginHistory = account.loginHistory.slice(0, 20);

    await account.save({ validateBeforeSave: false });

    // Business type
    let business_type = null;

    if (accountType === "tenant_user" && account.tenant_id) {
      const tenant = await Tenant.findById(account.tenant_id).select(
        "business_type"
      );

      business_type = tenant?.business_type || null;
    }

    // Login notification
    const deviceName =
      deviceInformation?.deviceName ||
      deviceInformation?.browser ||
      "Unknown Device";

    const osName = deviceInformation?.operatingSystem
      ? ` (${deviceInformation.operatingSystem})`
      : "";

    const formattedTime = currentTime.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    await createNotification(
      account.role === "super_admin" ? "" : account._id,
      account.role,
      "New Login Detected",
      `Your account was logged in from ${deviceName}${osName} on ${formattedTime}.`
    );

    return res.status(200).json({
      success: true,
      message: "Account verified successfully. Login successful.",
      token,
      user: {
        id: account._id,
        username: account.username,
        email: account.email,
        role:
          account.role ||
          (accountType === "super_admin" ? "super_admin" : "tenant_user"),
        tenant_id: account.tenant_id || null,
        business_type,
        lastLoginAt: account.lastLoginAt,
        twoFactorEnabled: !!account.twoFactorEnabled,
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during OTP verification.",
    });
  }
};
const getMe = async (req, res) => {
  try {
    let business_type = null;
    if (req.user.tenant_id) {
      const tenant = await Tenant.findById(req.user.tenant_id).select(
        "business_type",
      );
      business_type = tenant?.business_type || null;
    }

    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        phone: req.user.phone,
        isActive: req.user.isActive,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        tenant_id: req.user.tenant_id || null,
        business_type,
        lastLoginAt: req.user.lastLoginAt,
        createAt: req.user.createdAt,
        tenantInfo: req.user.tenant_id && req.user.tenant_id,
        avatar: req.user.avatar
      }
    });
  } catch (error) {
    console.log("err", error);

    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const logout = async (req, res) => {
  return res
    .status(200)
    .json({ success: true, message: "Logged out successfully." });
};

const getMySecurity = async (req, res) => {
  try {
    const activeSessions = (req.user.deviceSession || [])
      .filter((s) => s.isActive)
      .sort((a, b) => new Date(b.lastLoginAt) - new Date(a.lastLoginAt));

    const loginHistory = [...(req.user.loginHistory || [])].sort(
      (a, b) => new Date(b.time) - new Date(a.time)
    );

    return res.status(200).json({
      success: true,
      twoFactorEnabled: !!req.user.twoFactorEnabled,
      activeSessions,
      loginHistory,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const toggleMyTwoFactor = async (req, res) => {
  try {
    const { enabled } = req.body;
    req.user.twoFactorEnabled = !!enabled;
    await req.user.save({ validateBeforeSave: false });
    return res.status(200).json({
      success: true,
      message: `Two-factor authentication ${enabled ? "enabled" : "disabled"}.`,
      twoFactorEnabled: req.user.twoFactorEnabled,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const logoutMySession = async (req, res) => {
  try {
    const session = req.user.deviceSession?.id(req.params.sessionId);
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found." });
    }
    session.isActive = false;
    await req.user.save({ validateBeforeSave: false });
    return res
      .status(200)
      .json({ success: true, message: "Session logged out." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const logoutAllMySessions = async (req, res) => {
  try {
    const { keepDeviceId } = req.body || {};
    (req.user.deviceSession || []).forEach((session) => {
      if (!keepDeviceId || session.deviceId !== keepDeviceId) {
        session.isActive = false;
      }
    });
    await req.user.save({ validateBeforeSave: false });
    return res
      .status(200)
      .json({ success: true, message: "Logged out from all devices." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, userId } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Old password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    // 2. Fetch User (Assuming password field has select: false by default in schema)
    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 3. Verify Old Password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect old password" });
    }

    // NOTE: Do NOT hash here. The User model's pre("save") hook already
    // hashes the password whenever it is modified. Hashing here too caused
    // a double-hash (hash-of-a-hash), which is why login/compare was
    // failing after a password change.
    user.password = newPassword;

    await user.save();
    await createNotification(user._id, "", "Password Changed", "Your account password has been changed successfully.")
    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();


    let account = await User.findOne({ email: cleanEmail });

    if (!account) {
      account = await SuperAdmin.findOne({ email: cleanEmail });
    }

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "This email is not registered.",
      });
    }
    const resetToken = jwt.sign(
      { id: account._id, email: account.email || account.email },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetLink = `${frontendUrl}/changepassword/${account._id}/${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL,
      to: account.email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Hello ${account.username || "User"},</p>
          <p>We received a request to reset your password. Click the link below to set a new password:</p>
          <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Reset Password</a>
          <p style="margin-top: 20px; color: #555;">This link is only valid for 15 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email.",
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error while sending email.",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { id, token } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link.",
      });
    }

    if (decoded.id !== id) {
      return res.status(400).json({
        success: false,
        message: "Invalid token details.",
      });
    }

    let account = await User.findById(id).select("+password");
    if (!account) {
      account = await SuperAdmin.findById(id).select("+password");
    }

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }
    account.password = password;
    await account.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful. You can now login with your new password.",
    });

    await createNotification(account._id, "",)

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error during password reset.",
    });
  }
};

// Update your module.exports at the bottom:
module.exports = {
  checkSetup,
  setupSuperAdmin,
  login,
  getMe,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  getMySecurity,
  toggleMyTwoFactor,
  logoutMySession,
  logoutAllMySessions,
  verifyEmailAddress
};

