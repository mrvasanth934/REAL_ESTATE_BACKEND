const Invoice = require("../models/Invoice");
const { computeRenewals } = require("../utils/Renewalservice");

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

exports.getSummary = async (req, res) => {
  try {
    const [
      totalRevenueAgg,
      todayRevenueAgg,
      transactionsCount,
      invoicesCount,
      pendingCount,
      failedCount,
      renewals,
    ] = await Promise.all([
      Invoice.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, total: { $sum: "$total_amount" } } }]),
      Invoice.aggregate([
        { $match: { status: "paid", paid_at: { $gte: startOfToday() } } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]),
      Invoice.countDocuments({}),
      Invoice.countDocuments({}),
      Invoice.countDocuments({ status: "pending" }),
      Invoice.countDocuments({ status: "failed" }),
      computeRenewals({ windowDays: 30 }),
    ]);

    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenueAgg[0]?.total || 0,
        todayRevenue: todayRevenueAgg[0]?.total || 0,
        transactions: transactionsCount,
        invoices: invoicesCount,
        pendingPayments: pendingCount,
        failedPayments: failedCount,
        renewalsNext30: renewals.filter((r) => r.daysLeft >= 0).length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Last N months of paid revenue, grouped by calendar month.
exports.getMonthlyRevenue = async (req, res) => {
  try {
    const months = Number(req.query.months) || 8;
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await Invoice.aggregate([
      { $match: { status: "paid", billing_date: { $gte: since } } },
      {
        $group: {
          _id: { year: { $year: "$billing_date" }, month: { $month: "$billing_date" } },
          revenue: { $sum: "$total_amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRevenueByPlan = async (req, res) => {
  try {
    const rows = await Invoice.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: "$plan_name", revenue: { $sum: "$total_amount" } } },
      { $sort: { revenue: -1 } },
    ]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};