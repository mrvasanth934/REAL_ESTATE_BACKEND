const mongoose = require("mongoose");

const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Project = require("../models/Project");
const Property = require("../models/Property");
const paymentModel = require("../models/paymentModel");
const SubscriptionPlan= require("../models/SubscriptionPlan")
const Lead = require("../models/Lead");
const SiteVisit = require("../models/SiteVist");
const RentalBooking = require("../models/rentalBooking");
const MaintenanceRequest = require("../models/MaintenanceRequest");

const toObjectId = (value) => {
  if (!value) return null;

  return mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;
};

const getDateRange = (from, to) => {
  const endDate = to ? new Date(to) : new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = from
    ? new Date(from)
    : new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);

  startDate.setHours(0, 0, 0, 0);

  return { startDate, endDate };
};

const getMonthLabel = (date) => {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(date);
};

const getReportsOverview = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { startDate, endDate } = getDateRange(from, to);

    const tenantFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const userFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const projectFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const propertyFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const subscriptionFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const [
      tenantOverview,
      tenantGrowth,
      businessTypeAnalytics,
      userAnalytics,
      userGrowth,
      projectAnalytics,
      propertyAnalytics,
      subscriptionAnalytics,
      subscriptionGrowth,
      paymentAnalytics,
      moduleUsage,
    ] = await Promise.all([
      Tenant.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],

            active: [
              { $match: { status: { $in: ["active", "Active"] } } },
              { $count: "count" },
            ],

            inactive: [
              { $match: { status: { $in: ["inactive", "Inactive"] } } },
              { $count: "count" },
            ],

            trial: [
              { $match: { subscriptionStatus: { $in: ["trial", "Trial"] } } },
              { $count: "count" },
            ],

            expired: [
              { $match: { subscriptionStatus: { $in: ["expired", "Expired"] } } },
              { $count: "count" },
            ],
          },
        },
      ]),

      Tenant.aggregate([
        { $match: tenantFilter },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
          },
        },
      ]),

      Tenant.aggregate([
        {
          $group: {
            _id: {
              $ifNull: [
                "$businessType",
                {
                  $ifNull: ["$type", "Unknown"],
                },
              ],
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            name: "$_id",
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),

      User.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],

            active: [
              { $match: { status: { $in: ["active", "Active"] } } },
              { $count: "count" },
            ],

            inactive: [
              { $match: { status: { $in: ["inactive", "Inactive"] } } },
              { $count: "count" },
            ],

            byRole: [
              {
                $group: {
                  _id: {
                    $ifNull: ["$role", "Unknown"],
                  },
                  count: { $sum: 1 },
                },
              },
              {
                $project: {
                  _id: 0,
                  role: "$_id",
                  count: 1,
                },
              },
              { $sort: { count: -1 } },
            ],
          },
        },
      ]),

      User.aggregate([
        { $match: userFilter },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
          },
        },
      ]),

      Project.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],

            byStatus: [
              {
                $group: {
                  _id: {
                    $ifNull: ["$status", "Unknown"],
                  },
                  count: { $sum: 1 },
                },
              },
              {
                $project: {
                  _id: 0,
                  status: "$_id",
                  count: 1,
                },
              },
              { $sort: { count: -1 } },
            ],
          },
        },
      ]),

      Property.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],

            byStatus: [
              {
                $group: {
                  _id: {
                    $ifNull: ["$status", "Unknown"],
                  },
                  count: { $sum: 1 },
                },
              },
              {
                $project: {
                  _id: 0,
                  status: "$_id",
                  count: 1,
                },
              },
              { $sort: { count: -1 } },
            ],
          },
        },
      ]),

      SubscriptionPlan.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],

            byStatus: [
              {
                $group: {
                  _id: {
                    $ifNull: ["$status", "Unknown"],
                  },
                  count: { $sum: 1 },
                },
              },
              {
                $project: {
                  _id: 0,
                  status: "$_id",
                  count: 1,
                },
              },
              { $sort: { count: -1 } },
            ],

            byPlan: [
              {
                $group: {
                  _id: {
                    $ifNull: [
                      "$planName",
                      {
                        $ifNull: ["$name", "Unknown"],
                      },
                    ],
                  },
                  count: { $sum: 1 },
                },
              },
              {
                $project: {
                  _id: 0,
                  plan: "$_id",
                  count: 1,
                },
              },
              { $sort: { count: -1 } },
            ],
          },
        },
      ]),

      SubscriptionPlan.aggregate([
        { $match: subscriptionFilter },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
          },
        },
      ]),

      paymentModel.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],

            byStatus: [
              {
                $group: {
                  _id: {
                    $ifNull: ["$status", "Unknown"],
                  },
                  count: { $sum: 1 },
                  amount: {
                    $sum: {
                      $convert: {
                        input: "$amount",
                        to: "double",
                        onError: 0,
                        onNull: 0,
                      },
                    },
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  status: "$_id",
                  count: 1,
                  amount: 1,
                },
              },
              { $sort: { count: -1 } },
            ],

            revenue: [
              {
                $match: {
                  status: {
                    $in: ["success", "Success", "paid", "Paid", "captured"],
                  },
                  createdAt: {
                    $gte: startDate,
                    $lte: endDate,
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  total: {
                    $sum: {
                      $convert: {
                        input: "$amount",
                        to: "double",
                        onError: 0,
                        onNull: 0,
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      ]),
    ]);

    const getCount = (result, key) => {
      return result?.[0]?.[key]?.[0]?.count || 0;
    };

    const totalTenants = tenantOverview?.[0]?.total?.[0]?.count || 0;
    const activeTenants = getCount(tenantOverview[0], "active");
    const inactiveTenants = getCount(tenantOverview[0], "inactive");

    const totalUsers = userAnalytics?.[0]?.total?.[0]?.count || 0;
    const activeUsers = getCount(userAnalytics[0], "active");
    const inactiveUsers = getCount(userAnalytics[0], "inactive");

    const totalProjects = projectAnalytics?.[0]?.total?.[0]?.count || 0;
    const totalProperties = propertyAnalytics?.[0]?.total?.[0]?.count || 0;

    const totalSubscriptions =
      subscriptionAnalytics?.[0]?.total?.[0]?.count || 0;

    const totalRevenue =
      paymentAnalytics?.[0]?.revenue?.[0]?.total || 0;

    const formattedTenantGrowth = tenantGrowth.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      count: item.count,
    }));

    const formattedUserGrowth = userGrowth.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      count: item.count,
    }));

    const formattedSubscriptionGrowth = subscriptionGrowth.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      count: item.count,
    }));

    return res.status(200).json({
      success: true,
      filters: {
        from: startDate,
        to: endDate,
      },

      overview: {
        totalTenants,
        activeTenants,
        inactiveTenants,
        activeUsers,
        totalUsers,
        totalProperties,
        totalProjects,
        totalSubscriptions,
        totalRevenue,
        tenantActivationRate:
          totalTenants > 0
            ? Number(((activeTenants / totalTenants) * 100).toFixed(2))
            : 0,
      },

      tenantAnalytics: {
        growth: formattedTenantGrowth,
        status: {
          active: activeTenants,
          inactive: inactiveTenants,
          trial: getCount(tenantOverview[0], "trial"),
          expired: getCount(tenantOverview[0], "expired"),
        },
        businessTypes: businessTypeAnalytics,
      },

      userAnalytics: {
        growth: formattedUserGrowth,
        active: activeUsers,
        inactive: inactiveUsers,
        byRole: userAnalytics?.[0]?.byRole || [],
      },

      subscriptionAnalytics: {
        growth: formattedSubscriptionGrowth,
        byStatus: subscriptionAnalytics?.[0]?.byStatus || [],
        byPlan: subscriptionAnalytics?.[0]?.byPlan || [],
      },

      realEstateAnalytics: {
        projects: {
          total: totalProjects,
          byStatus: projectAnalytics?.[0]?.byStatus || [],
        },
        properties: {
          total: totalProperties,
          byStatus: propertyAnalytics?.[0]?.byStatus || [],
        },
      },

      paymentAnalytics: {
        totalTransactions: paymentAnalytics?.[0]?.total?.[0]?.count || 0,
        totalRevenue,
        byStatus: paymentAnalytics?.[0]?.byStatus || [],
      },

      moduleUsage: moduleUsage || [],
    });
  } catch (error) {
    console.error("Reports overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load reports overview",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getAgencyReportsOverview = async (req, res) => {
  try {
    const tenantId = toObjectId(req.tenantId);
    if (!tenantId) return res.status(400).json({ success: false, message: "Tenant context is required" });

    const { from, to } = req.query;
    const { startDate, endDate } = getDateRange(from, to);
    const dateMatch = { createdAt: { $gte: startDate, $lte: endDate } };
    const tenantMatch = { tenant_id: tenantId };
    const scopedDateMatch = { ...tenantMatch, ...dateMatch };
    const paidCollectionStatuses = ["Paid", "paid"];

    // Real rent collection lives inside RentalBooking.rental_collection[] sub-documents,
    // not in the generic Payment model (which only tracks CRM subscription/booking payments).
    const rentCollectionPipeline = [
      { $match: tenantMatch },
      { $unwind: "$rental_collection" },
      {
        $match: {
          "rental_collection.status": { $in: paidCollectionStatuses },
          "rental_collection.paymentDate": dateMatch.createdAt,
        },
      },
    ];

    const openMaintenanceStatuses = ["open", "assigned", "in_progress", "on_hold"];

    const [
      users,
      properties,
      leads,
      visits,
      bookings,
      revenue,
      monthly,
      bookingStatus,
      propertyTypes,
      maintenanceRequests,
      openMaintenanceRequests,
    ] = await Promise.all([
      User.countDocuments(scopedDateMatch), Property.countDocuments(scopedDateMatch), Lead.countDocuments(scopedDateMatch),
      SiteVisit.countDocuments(scopedDateMatch), RentalBooking.countDocuments(scopedDateMatch),
      RentalBooking.aggregate([
        ...rentCollectionPipeline,
        {
          $group: {
            _id: null,
            total: { $sum: { $convert: { input: "$rental_collection.rent", to: "double", onError: 0, onNull: 0 } } },
          },
        },
      ]),
      Promise.all([
        Lead.aggregate([{ $match: scopedDateMatch }, { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } }]),
        RentalBooking.aggregate([{ $match: scopedDateMatch }, { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } }]),
        RentalBooking.aggregate([
          ...rentCollectionPipeline,
          {
            $group: {
              _id: { year: { $year: "$rental_collection.paymentDate" }, month: { $month: "$rental_collection.paymentDate" } },
              total: { $sum: { $convert: { input: "$rental_collection.rent", to: "double", onError: 0, onNull: 0 } } },
            },
          },
        ]),
      ]),
      RentalBooking.aggregate([{ $match: tenantMatch }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Property.aggregate([{ $match: tenantMatch }, { $group: { _id: "$sub_type", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      MaintenanceRequest.countDocuments({ tenant_id: tenantId, ...dateMatch }),
      MaintenanceRequest.countDocuments({ tenant_id: tenantId, status: { $in: openMaintenanceStatuses } }),
    ]);

    const toMonthly = (items) => items.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`, count: item.count, total: item.total || 0,
    })).sort((a, b) => a.month.localeCompare(b.month));

    const rentCollectionTotal = revenue[0]?.total || 0;

    return res.status(200).json({
      success: true, filters: { from: startDate, to: endDate },
      overview: {
        users,
        properties,
        leads,
        visits,
        bookings,
        revenue: rentCollectionTotal,
        rentCollection: rentCollectionTotal,
        maintenanceRequests,
        openMaintenanceRequests,
      },
      monthly: { leads: toMonthly(monthly[0]), bookings: toMonthly(monthly[1]), rentCollection: toMonthly(monthly[2]), revenue: toMonthly(monthly[2]) },
      bookingStatus: bookingStatus.map((item) => ({ status: item._id || "Unknown", count: item.count })),
      propertyTypes: propertyTypes.map((item) => ({ type: item._id || "Unknown", count: item.count })),
    });
  } catch (error) {
    console.error("Agency reports overview error:", error);
    return res.status(500).json({ success: false, message: "Failed to load agency reports overview" });
  }
};

module.exports = {
  getReportsOverview,
  getAgencyReportsOverview,
};