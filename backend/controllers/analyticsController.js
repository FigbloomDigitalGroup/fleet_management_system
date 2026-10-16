import Company from "../models/Company.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";

// PLATFORM_ADMIN only — cross-company usage stats
export async function getPlatformAnalytics(req, res) {
  try {
    const totalCompanies = await Company.countDocuments();
    const activeCompanies = await Company.countDocuments({ status: "active" });
    const pendingCompanies = await Company.countDocuments({ status: "pending" });
    const suspendedCompanies = await Company.countDocuments({ status: "suspended" });

    const totalVehicles = await Vehicle.countDocuments();
    const activeVehicles = await Vehicle.countDocuments({ status: "active" });

    const totalUsers = await User.countDocuments();

    // Vehicles per company — useful for a bar chart
    const vehiclesPerCompany = await Vehicle.aggregate([
      { $group: { _id: "$companyId", count: { $sum: 1 } } },
      { $lookup: { from: "companies", localField: "_id", foreignField: "_id", as: "company" } },
      { $unwind: "$company" },
      { $project: { name: "$company.name", count: 1, _id: 0 } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Companies registered per month, last 6 months — useful for a growth chart
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const growthRaw = await Company.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const growth = growthRaw.map((g) => ({
      name: monthNames[g._id.month - 1],
      companies: g.count,
    }));

    return res.json({
      totals: { totalCompanies, activeCompanies, pendingCompanies, suspendedCompanies, totalVehicles, activeVehicles, totalUsers },
      vehiclesPerCompany,
      growth,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch analytics" });
  }
}