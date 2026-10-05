import Company from "../models/Company.js";
import User from "../models/User.js";
import Geofence from "../models/Geofence.js";
import Vehicle from "../models/Vehicle.js";
import Trip from "../models/Trip.js";
import LocationPing from "../models/LocationPing.js";
import { isInsideGeofence } from "../lib/geo.js";
import { PLAN_PRICING_KES } from "../config/pricing.js";

// PLATFORM_ADMIN only — list every company on the platform
export async function listCompanies(req, res) {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });

    // attach a quick vehicle/user count per company (useful for the dashboard table)
    const companiesWithCounts = await Promise.all(
      companies.map(async (company) => {
        const userCount = await User.countDocuments({ companyId: company._id });
        return { ...company.toObject(), userCount };
      })
    );

    return res.json(companiesWithCounts);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch companies" });
  }
}

// PLATFORM_ADMIN only — get one company's full detail
export async function getCompany(req, res) {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const users = await User.find({ companyId: company._id }).select("-passwordHash");

    return res.json({ company, users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch company" });
  }
}

// PLATFORM_ADMIN only — approve/suspend a company
export async function updateCompanyStatus(req, res) {
  try {
    const { status } = req.body;
    const allowed = ["active", "suspended", "pending"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
    }

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(company);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update company status" });
  }
}

// COMPANY_OWNER (or PLATFORM_ADMIN) — get the requester's own company profile
export async function getMyCompany(req, res) {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ error: "This account is not linked to a company" });
    }

    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(company);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch company" });
  }
}

// COMPANY_OWNER — update their own company's profile
export async function updateMyCompany(req, res) {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ error: "This account is not linked to a company" });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    const company = await Company.findByIdAndUpdate(
      req.user.companyId,
      { name: name.trim() },
      { new: true }
    );
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(company);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update company" });
  }
}

// ADMIN / COMPANY_OWNER — set where drivers should start their day. Must
// land inside an existing geofence zone, so it's tied to a place the fleet
// already monitors rather than an arbitrary point on the map.
export async function updateStartPoint(req, res) {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ error: "This account is not linked to a company" });
    }

    const { lat, lng } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const geofences = await Geofence.find({ companyId: req.user.companyId });
    const matchedGeofence = geofences.find((g) => isInsideGeofence(lat, lng, g));
    if (!matchedGeofence) {
      return res.status(400).json({
        error: "The starting point must be inside one of your geofence zones — pick a spot inside a shaded zone, or create one there first.",
      });
    }

    const company = await Company.findByIdAndUpdate(
      req.user.companyId,
      { dailyStartPoint: { lat, lng, geofenceId: matchedGeofence._id, updatedAt: new Date() } },
      { new: true }
    );
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(company);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update starting point" });
  }
}

// COMPANY_OWNER — downgrade/cancel back to Trial. This is the only
// subscriptionPlan transition this endpoint allows — moving to a paid plan
// (Basic/Pro) requires an actual successful payment, handled entirely by
// billingController's checkout/verify/webhook flow instead, so there's no
// way to grant yourself a paid plan without a real Paystack charge behind it.
export async function updateMyPlan(req, res) {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ error: "This account is not linked to a company" });
    }

    const { subscriptionPlan } = req.body;
    if (subscriptionPlan !== "trial") {
      return res.status(400).json({
        error: "Only downgrading to 'trial' is allowed here — upgrade to Basic/Pro via /api/billing/checkout",
      });
    }

    const company = await Company.findByIdAndUpdate(
      req.user.companyId,
      { subscriptionPlan: "trial", paymentMethod: null },
      { new: true }
    );
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(company);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update plan" });
  }
}

// Per-vehicle monthly price for each self-serve plan — mirrors the real
// pricing charged in billingController.js. Enterprise has no fixed price
// (it's sales-negotiated), so expenses can't be estimated for it.
const PLAN_PRICE_PER_VEHICLE = { trial: 0, ...PLAN_PRICING_KES, enterprise: null };
const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;

// Fuel consumed is estimated from recorded fuel-level pings — a drop between
// two consecutive readings for the same vehicle counts as consumption; an
// increase is treated as a refuel and ignored. Vehicles with no fuel sensor
// data (fuelLevelLiters is null on every ping) simply contribute 0. Returns
// one entry per detected drop (with the day it happened), so callers can
// either sum everything (all-time total) or bucket by day (daily chart).
async function computeFuelDrops(vehicleIds, since) {
  const query = { vehicleId: { $in: vehicleIds }, fuelLevelLiters: { $ne: null } };
  if (since) query.recordedAt = { $gte: since };

  const pings = await LocationPing.find(query)
    .select("vehicleId fuelLevelLiters recordedAt")
    .sort({ vehicleId: 1, recordedAt: 1 })
    .lean();

  const drops = [];
  let prevVehicleId = null;
  let prevLevel = null;
  for (const ping of pings) {
    const vehicleId = ping.vehicleId.toString();
    if (vehicleId !== prevVehicleId) {
      prevVehicleId = vehicleId;
      prevLevel = ping.fuelLevelLiters;
      continue;
    }
    const drop = prevLevel - ping.fuelLevelLiters;
    if (drop > 0) drops.push({ dayKey: ping.recordedAt.toISOString().slice(0, 10), liters: drop });
    prevLevel = ping.fuelLevelLiters;
  }
  return drops;
}

async function computeFuelConsumedLiters(vehicleIds) {
  const drops = await computeFuelDrops(vehicleIds);
  const total = drops.reduce((sum, d) => sum + d.liters, 0);
  return Math.round(total * 10) / 10;
}

// Shared by getMyCompanyStats (COMPANY_OWNER/ADMIN, "me") and getCompanyStats
// (PLATFORM_ADMIN, any company by id) — distance is summed straight from
// recorded trips; expenses are an estimate (plan price × vehicle count ×
// months since joining) since there is no real billing-history ledger yet;
// revenue is whatever the company last entered themselves (see
// updateMyRevenue). Also returns a breakdown of vehicle types, since that's
// otherwise invisible outside the company's own Vehicles page. Read-only —
// doesn't touch or recalculate any existing trip/vehicle/alert data.
async function computeCompanyStats(companyId) {
  const company = await Company.findById(companyId);
  if (!company) return null;

  const vehicles = await Vehicle.find({ companyId: company._id }).select("vehicleType");
  const vehicleCount = vehicles.length;
  const vehicleTypeBreakdown = vehicles.reduce((acc, v) => {
    const type = v.vehicleType || "car";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const vehicleIds = vehicles.map((v) => v._id);
  const [distanceResult] = await Trip.aggregate([
    { $match: { vehicleId: { $in: vehicleIds } } },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$distanceKm", 0] } } } },
  ]);
  const totalDistanceKm = Math.round((distanceResult?.total || 0) * 10) / 10;

  const totalFuelConsumedLiters = await computeFuelConsumedLiters(vehicleIds);

  const monthsSinceJoining = Math.max(1, Math.ceil((Date.now() - company.createdAt.getTime()) / MS_PER_MONTH));
  const pricePerVehicle = PLAN_PRICE_PER_VEHICLE[company.subscriptionPlan];
  const estimatedExpenses =
    pricePerVehicle === null || pricePerVehicle === undefined
      ? null
      : Math.round(pricePerVehicle * vehicleCount * monthsSinceJoining);

  return {
    totalDistanceKm,
    totalFuelConsumedLiters,
    estimatedExpenses,
    totalRevenue: company.totalRevenue,
    vehicleCount,
    vehicleTypeBreakdown,
    monthsSinceJoining,
  };
}

const DAILY_STATS_DAYS = 7;

// Day-by-day distance vs. fuel consumed for the dashboard's comparison
// chart. Distance comes straight from trips; fuel from the same drop
// detection used by computeFuelConsumedLiters, just bucketed by day instead
// of summed into one total. Note: a fuel drop spanning the `since` boundary
// (first ping before it, second after) is missed — an acceptable rounding
// edge for a 7-day dashboard chart, not a billing figure.
async function computeDailyStats(companyId, days) {
  const vehicles = await Vehicle.find({ companyId }).select("_id");
  const vehicleIds = vehicles.map((v) => v._id);

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const dayKeys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  const distanceAgg = await Trip.aggregate([
    { $match: { vehicleId: { $in: vehicleIds }, startTime: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } },
        total: { $sum: { $ifNull: ["$distanceKm", 0] } },
      },
    },
  ]);
  const distanceByDay = Object.fromEntries(distanceAgg.map((d) => [d._id, d.total]));

  const fuelDrops = await computeFuelDrops(vehicleIds, since);
  const fuelByDay = {};
  for (const drop of fuelDrops) {
    fuelByDay[drop.dayKey] = (fuelByDay[drop.dayKey] || 0) + drop.liters;
  }

  return dayKeys.map((key) => ({
    date: key,
    distanceKm: Math.round((distanceByDay[key] || 0) * 10) / 10,
    fuelConsumedLiters: Math.round((fuelByDay[key] || 0) * 10) / 10,
  }));
}

// COMPANY_OWNER / ADMIN — last 7 days of distance covered vs. fuel consumed,
// for the dashboard's comparison chart.
export async function getMyDailyStats(req, res) {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ error: "This account is not linked to a company" });
    }

    const data = await computeDailyStats(req.user.companyId, DAILY_STATS_DAYS);
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch daily stats" });
  }
}

// COMPANY_OWNER / ADMIN — read-only overview numbers for the dashboard and
// billing page.
export async function getMyCompanyStats(req, res) {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ error: "This account is not linked to a company" });
    }

    const stats = await computeCompanyStats(req.user.companyId);
    if (!stats) return res.status(404).json({ error: "Company not found" });

    return res.json(stats);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch company stats" });
  }
}

// PLATFORM_ADMIN — same numbers as above, but for any company by id.
export async function getCompanyStats(req, res) {
  try {
    const stats = await computeCompanyStats(req.params.id);
    if (!stats) return res.status(404).json({ error: "Company not found" });

    return res.json(stats);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch company stats" });
  }
}

// COMPANY_OWNER — set the company's self-reported all-time revenue figure.
export async function updateMyRevenue(req, res) {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ error: "This account is not linked to a company" });
    }

    const { totalRevenue } = req.body;
    if (typeof totalRevenue !== "number" || Number.isNaN(totalRevenue) || totalRevenue < 0) {
      return res.status(400).json({ error: "totalRevenue must be a number >= 0" });
    }

    const company = await Company.findByIdAndUpdate(
      req.user.companyId,
      { totalRevenue },
      { new: true }
    );
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(company);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update revenue" });
  }
}





