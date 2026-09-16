const ModuleControl = require("../models/ModuleControl");
const ModuleControlAudit = require("../models/ModuleControlAudit");
const Tenant = require("../models/Tenant");

const createmodule = (key, name, group, order, mandatory = false) => ({
  key,
  name,
  description: `${name} module`,
  group,
  order,
  enabled: true,
  mandatory,
});
const normalizeBusinessType = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  const map = {
    agency: "Agency",
    builder: "Builder",
    rental_agent: "Rental Agent",
    "rental agent": "Rental Agent",
  };

  return map[raw] || "Agency";
};

const defaultModulesByBusinessType = {
  Agency: [
    createmodule("dashboard", "Dashboard", "CORE MODULES", 1, true),
    createmodule("users", "Users", "CORE MODULES", 2, true),
    createmodule("properties", "Properties", "PROPERTY", 1),
    createmodule("propertyOwners", "Property Owners", "PROPERTY", 2),
    createmodule("propertyMedia", "Property Media", "PROPERTY", 3),
    createmodule("leads", "Leads", "SALES", 1),
    createmodule("siteVisits", "Site Visits", "SALES", 2),
    createmodule("bookings", "Bookings", "SALES", 3),
    createmodule("brokerage", "Brokerage", "SALES", 4),
    createmodule("documents", "Documents", "CORE MODULES", 3),
    createmodule("notifications", "Notifications", "NOTIFICATIONS", 1),
    createmodule("reports", "Reports", "REPORTS", 1),
    createmodule("settings", "Settings", "CORE MODULES", 4, true),
  ],

  Builder: [
    createmodule("dashboard", "Dashboard", "CORE MODULES", 1, true),
    createmodule("users", "Users", "CORE MODULES", 2, true),
    createmodule("projects", "Projects", "PROPERTY", 1),
    createmodule("towers", "Towers", "PROPERTY", 2),
    createmodule("units", "Units", "PROPERTY", 3),
    createmodule("properties", "Properties", "PROPERTY", 4),
    createmodule(
      "constructionMilestones",
      "Construction Milestones",
      "PROPERTY",
      5,
    ),
    createmodule("leads", "Leads", "SALES", 1),
    createmodule("siteVisits", "Site Visits", "SALES", 2),
    createmodule("bookings", "Bookings", "SALES", 3),
    createmodule("paymentSchedule", "Payment Schedule", "FINANCE", 1),
    createmodule("payments", "Payments", "FINANCE", 2),
    createmodule("loans", "Loan / EMI", "FINANCE", 3),
    createmodule("gstInvoices", "GST Invoices", "FINANCE", 4),
    createmodule("documents", "Documents", "CORE MODULES", 3),
    createmodule("notifications", "Notifications", "NOTIFICATIONS", 1),
    createmodule("reports", "Reports", "REPORTS", 1),
    createmodule("settings", "Settings", "CORE MODULES", 4, true),
  ],

  "Rental Agent": [
    createmodule("dashboard", "Dashboard", "CORE MODULES", 1, true),
    createmodule("users", "Users", "CORE MODULES", 2, true),
    createmodule("rentalProperties", "Rental Properties", "PROPERTY", 1),
    createmodule("rentalTenants", "Rental Tenants", "PROPERTY", 2),
    createmodule("leaseAgreements", "Lease Agreements", "PROPERTY", 3),
    createmodule("securityDeposits", "Security Deposits", "FINANCE", 1),
    createmodule("monthlyRent", "Monthly Rent", "FINANCE", 2),
    createmodule("rentCollection", "Rent Collection", "FINANCE", 3),
    createmodule("maintenanceRequests", "Maintenance Requests", "PROPERTY", 4),
    createmodule("rentalbooking", "Rental Bookings", "FINANCE", 4),
    createmodule("documents", "Documents", "CORE MODULES", 3),
    createmodule("notifications", "Notifications", "NOTIFICATIONS", 1),
    createmodule("reports", "Reports", "REPORTS", 1),
    createmodule("settings", "Settings", "CORE MODULES", 4, true),
  ],
};

const ensureDefaultDoc = async (businessType) => {
  let doc = await ModuleControl.findOne({
    businessType,
  });

  const defaultModules = defaultModulesByBusinessType[businessType] || [];

  // Create document if it doesn't exist
  if (!doc) {
    doc = await ModuleControl.create({
      businessType,
      modules: defaultModules,
      tenantOverrides: [],
      updatedByName: "System",
      updateReason: "Initial seed",
    });

    return doc;
  }

  // Add newly introduced default modules
  const existingKeys = new Set(doc.modules.map((module) => module.key));

  const newModules = defaultModules.filter(
    (module) => !existingKeys.has(module.key),
  );

  if (newModules.length > 0) {
    doc.modules.push(...newModules);

    doc.updateReason = "Default modules synchronized";
    doc.updatedByName = "System";

    await doc.save();
  }

  return doc;
};

exports.getModuleControl = async (req, res) => {
  try {
    // const businessType = req.query.businessType || "Agency";
    const businessType = normalizeBusinessType(req.query.businessType);
    const doc = await ensureDefaultDoc(businessType);
    const businessTypeMap = {
      Agency: "agency",
      Builder: "builder",
      "Rental Agent": "rental_agent",
    };

    const tenants = await Tenant.find({
      business_type: businessTypeMap[businessType],
    })
      .select("_id business_name")
      .sort({ business_name: 1 });
    const totalModules = doc.modules.length;
    const enabledModules = doc.modules.filter((m) => m.enabled).length;
    const disabledModules = totalModules - enabledModules;

    const recentChanges = await ModuleControlAudit.find({ businessType })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        businessType: doc.businessType,
        modules: doc.modules,
        tenantOverrides: doc.tenantOverrides,
        tenants,
        businessDetails: {
          totalModules,
          enabledModules,
          disabledModules,
        },
        lastUpdated: {
          date: doc.updatedAt,
          updatedBy: doc.updatedByName || "System",
          reason: doc.updateReason || "No reason provided",
        },
        recentChanges: recentChanges.map((item) => ({
          date: item.createdAt,
          user: item.updatedByName || "System",
          module: item.moduleName || item.action,
          status: item.action,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch module control data",
      error: error.message,
    });
  }
};

exports.updateModuleControl = async (req, res) => {
  try {
    const { businessType, modules, tenantOverrides, updateReason } = req.body;
    const normalizedBusinessType = normalizeBusinessType(businessType);

    if (!normalizedBusinessType) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid businessType provided. Must be one of: Agency, Builder, Rental Agent.",
      });
    }

    const doc = await ensureDefaultDoc(normalizedBusinessType);
    const businessTypeMap = {
      Agency: "agency",
      Builder: "builder",
      "Rental Agent": "rental_agent",
    };

    const tenants = await Tenant.find({
      business_type: businessTypeMap[normalizedBusinessType],
    })
      .select("_id business_name")
      .sort({ business_name: 1 });

    const previousModules = JSON.parse(JSON.stringify(doc.modules));

    doc.modules = modules || doc.modules;
    doc.tenantOverrides = tenantOverrides || doc.tenantOverrides;
    doc.updateReason = updateReason || "Updated from Module Control page";

    if (req.user) {
      doc.updatedBy = req.user._id;
      doc.updatedByName = req.user.name || req.user.email || "Admin";
    }

    await doc.save();

    const changes = [];

    for (const mod of doc.modules) {
      const prev = previousModules.find((p) => p.key === mod.key);
      if (!prev) continue;

      if (prev.enabled !== mod.enabled) {
        changes.push({
          businessType,
          action: mod.enabled ? "ENABLE" : "DISABLE",
          moduleKey: mod.key,
          moduleName: mod.name,
          previousValue: prev.enabled,
          newValue: mod.enabled,
          updatedBy: req.user?._id || null,
          updatedByName: doc.updatedByName || "Admin",
          reason: doc.updateReason,
        });
      }
    }

    if (changes.length > 0) {
      await ModuleControlAudit.insertMany(changes);
    }

    const totalModules = doc.modules.length;
    const enabledModules = doc.modules.filter((m) => m.enabled).length;
    const disabledModules = totalModules - enabledModules;

    const recentChanges = await ModuleControlAudit.find({
      businessType: normalizedBusinessType,
    })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      message: "Module control updated successfully",
      data: {
        businessType: doc.businessType,
        modules: doc.modules,
        tenantOverrides: doc.tenantOverrides,
        tenants,
        businessDetails: {
          totalModules,
          enabledModules,
          disabledModules,
        },
        lastUpdated: {
          date: doc.updatedAt,
          updatedBy: doc.updatedByName || "System",
          reason: doc.updateReason || "No reason provided",
        },
        recentChanges: recentChanges.map((item) => ({
          date: item.createdAt,
          user: item.updatedByName || "System",
          module: item.moduleName || item.action,
          status: item.action,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update module control data",
      error: error.message,
    });
  }
};

exports.updateTenantOverride = async (req, res) => {
  try {
    const { businessType, tenantId, tenantName, overrides } = req.body;

    if (!businessType || !tenantId) {
      return res.status(400).json({
        success: false,
        message: "businessType and tenantId are required",
      });
    }

    const doc = await ensureDefaultDoc(businessType);
    const oldOverrides = JSON.parse(JSON.stringify(doc.tenantOverrides));

    const idx = doc.tenantOverrides.findIndex(
      (item) => String(item.tenantId) === String(tenantId),
    );

    const payload = {
      tenantId,
      tenantName,
      overrides,
    };

    if (idx > -1) {
      doc.tenantOverrides[idx] = payload;
    } else {
      doc.tenantOverrides.push(payload);
    }

    if (req.user) {
      doc.updatedBy = req.user._id;
      doc.updatedByName = req.user.name || req.user.email || "Admin";
    }

    doc.updateReason = `Tenant override updated for ${tenantName || tenantId}`;
    await doc.save();

    await ModuleControlAudit.create({
      businessType,
      tenantId,
      tenantName,
      action: "OVERRIDE",
      moduleName: "Tenant Override",
      previousValue: oldOverrides,
      newValue: doc.tenantOverrides,
      updatedBy: req.user?._id || null,
      updatedByName: doc.updatedByName || "Admin",
      reason: doc.updateReason,
    });

    res.status(200).json({
      success: true,
      message: "Tenant override updated successfully",
      data: doc,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update tenant override",
      error: error.message,
    });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const businessType = req.query.businessType || "Agency";
    const logs = await ModuleControlAudit.find({ businessType })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
      error: error.message,
    });
  }
};
