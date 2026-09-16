require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const propertyRoutes = require("./routes/propertyRoutes");
const { Server } = require("socket.io");
const http = require("http");
const moduleControlRoutes = require("./routes/moduleControlRoutes");
const projectRoutes = require("./routes/ProjectRoutes");
const towerRoutes = require("./routes/towerRoutes");
const billingRoutes = require("./routes/billingRoutes");
const reportRoutes = require("./routes/reportRoutes");
const passport = require("./config/passport");
const bookingRoutes = require("./routes/bookingRoutes");

const paymentRoute = require("./routes/paymentRoutes");

const app = express();

connectDB();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "https://manaivaasal.vyoobam.com"
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Serve uploaded media (uploads/properties/..., uploads/owners/...)
app.use(
  "/uploads",
  express.static(require("path").join(__dirname, "..", "uploads")),
);

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/tenants", require("./routes/tenantRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/properties", propertyRoutes);
app.use("/api/rental-tenants", require("./routes/rentalTenantRoutes"));
app.use("/api/rental-bookings", require("./routes/rentabookingRoutes"));
app.use("/api/subscription-plans", require("./routes/subscriptionPlanRoutes"));
app.use("/api/module-control", moduleControlRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Real Estate CRM API is running 🚀",
    timestamp: new Date(),
  });
});
app.use("/api/bookings", bookingRoutes);
app.use("/api/payment", paymentRoute);
app.use("/api/projects", require("./routes/ProjectRoutes"));
app.use("/api/towers", require("./routes/towerRoutes"));
app.use("/api/units", require("./routes/unitRoutes"));
app.use("/api/milestones", require("./routes/milestoneRoutes"));
app.use("/api/maintenance", require("./routes/MaintenanceRequestRoutes"));
app.use(
  "/api/rental-owner-document",
  require("./routes/RentalOwnerDocumentRoutes"),
);
app.use("/api/leads", require("./routes/leadRoutes"));
app.use("/api/sitevisits", require("./routes/siteVisitRoutes"));
app.use("/api/brokerage", require("./routes/brokerageRoutes"));
app.use("/api/builder_booking", require("./routes/BuilderBookingRoutes"));
app.use("/api/builder_invoice", require("./routes/BuilderInvoiceRoutes"));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route Not Found",
  });
});
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/health`);
});
