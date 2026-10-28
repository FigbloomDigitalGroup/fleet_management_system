import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
import { isInsideGeofence } from "../lib/geo.js";
import { PLAN_PRICING_KES } from "../config/pricing.js";
import { setImageField } from "./uploadController.js";
import { sendCompanyApprovedEmail } from "../lib/mailer.js";

// Updates one company; null when it doesn't exist (Mongo's findByIdAndUpdate).
async function updateCompany(id, data) {
  const { count } = await prisma.company.updateMany({ where: { id: String(id) }, data });
  return count ? prisma.company.findUnique({ where: { id: String(id) } }) : null;
}

// PLATFORM_ADMIN only — list every company on the platform
export async function listCompanies(req, res) {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } } },
    });

    // attach a quick user count per company (useful for the dashboard table)
    return res.json(companies.map(({ _count, ...company }) => ({ ...toApi(company), userCount: _count.users })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch companies" });
  }
}

// PLATFORM_ADMIN only — get one company's full detail
export async function getCompany(req, res) {
  try {
    const company = await prisma.company.findUnique({ where: { id: req.params.id }, include: { users: true } });
    if (!company) return res.status(404).json({ error: "Company not found" });

    const { users, ...rest } = company;
    return res.json({ company: toApi(rest), users: toApi(users) });
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

    const before = await prisma.company.findUnique({ where: { id: req.params.id }, select: { status: true } });
    const company = await updateCompany(req.params.id, { status });
    if (!company) return res.status(404).json({ error: "Company not found" });

    // Tell the owner(s) when a waiting company is approved — in the
    // background, so an email problem never blocks the approval.
    if (before?.status === "pending" && status === "active") {
      prisma.user
        .findMany({ where: { companyId: company.id, role: "COMPANY_OWNER" }, select: { email: true } })
        .then((owners) => owners.length && sendCompanyApprovedEmail(owners.map((o) => o.email).join(", "), { companyName: company.name }))
        .catch((err) => console.error(`[approval email] failed for ${company.name}:`, err.message));
    }

    return res.json(toApi(company));
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

    const company = await prisma.company.findUnique({ where: { id: req.user.companyId } });
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(toApi(company));
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

    const company = await updateCompany(req.user.companyId, { name: name.trim() });
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(toApi(company));
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

    const geofences = await prisma.geofence.findMany({ where: { companyId: req.user.companyId } });
    const matchedGeofence = geofences.find((g) => isInsideGeofence(lat, lng, g));
    if (!matchedGeofence) {
      return res.status(400).json({
        error: "The starting point must be inside one of your geofence zones — pick a spot inside a shaded zone, or create one there first.",
      });
    }

    const company = await updateCompany(req.user.companyId, {
      dailyStartPoint: { lat, lng, geofenceId: matchedGeofence.id, updatedAt: new Date().toISOString() },
    });
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(toApi(company));
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

    const company = await updateCompany(req.user.companyId, { subscriptionPlan: "trial", paymentMethod: null });
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(toApi(company));
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
  const pings = await prisma.locationPing.findMany({
    where: {
      vehicleId: { in: vehicleIds },
      fuelLevelLiters: { not: null },
      ...(since ? { recordedAt: { gte: since } } : {}),
    },
    select: { vehicleId: true, fuelLevelLiters: true, recordedAt: true },
    orderBy: [{ vehicleId: "asc" }, { recordedAt: "asc" }],
  });

  const drops = [];
  let prevVehicleId = null;
  let prevLevel = null;
  for (const ping of pings) {
    const vehicleId = ping.vehicleId;
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

// Shared by getMyCompanyStats (COMPANY_OWNER/ADMIN, "me") and getCompanyStats
// (PLATFORM_ADMIN, any company by id) — distance is summed straight from
// recorded trips; expenses are an estimate (plan price × vehicle count ×
// months since joining) since there is no real billing-history ledger yet;
// revenue is whatever the company last entered themselves (see
// updateMyRevenue). Also returns a breakdown of vehicle types, since that's
// otherwise invisible outside the company's own Vehicles page. Read-only —
// doesn't touch or recalculate any existing trip/vehicle/alert data.
async function computeCompanyStats(companyId) {
  const company = await prisma.company.findUnique({ where: { id: String(companyId) } });
  if (!company) return null;

  const vehicles = await prisma.vehicle.findMany({ where: { companyId: company.id }, select: { id: true, vehicleType: true } });
  const vehicleCount = vehicles.length;
  const vehicleTypeBreakdown = vehicles.reduce((acc, v) => {
    const type = v.vehicleType || "car";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const distance = await prisma.trip.aggregate({
    where: { vehicleId: { in: vehicles.map((v) => v.id) } },
    _sum: { distanceKm: true },
  });
  const totalDistanceKm = Math.round((distance._sum.distanceKm || 0) * 10) / 10;

  const monthsSinceJoining = Math.max(1, Math.ceil((Date.now() - company.createdAt.getTime()) / MS_PER_MONTH));
  const pricePerVehicle = PLAN_PRICE_PER_VEHICLE[company.subscriptionPlan];
  const estimatedExpenses =
    pricePerVehicle === null || pricePerVehicle === undefined
      ? null
      : Math.round(pricePerVehicle * vehicleCount * monthsSinceJoining);

  return {
    totalDistanceKm,
    estimatedExpenses,
    totalRevenue: company.totalRevenue,
    vehicleCount,
    vehicleTypeBreakdown,
    monthsSinceJoining,
  };
}

const DAILY_STATS_DAYS = 7;

// Day-by-day distance vs. fuel consumed for the dashboard's comparison
// chart. Distance comes straight from trips; fuel from computeFuelDrops,
// bucketed by day. Note: a fuel drop spanning the `since` boundary
// (first ping before it, second after) is missed — an acceptable rounding
// edge for a 7-day dashboard chart, not a billing figure.
async function computeDailyStats(companyId, days) {
  const vehicles = await prisma.vehicle.findMany({ where: { companyId: String(companyId) }, select: { id: true } });
  const vehicleIds = vehicles.map((v) => v.id);

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const dayKeys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  // Bucketed by UTC day, as Mongo's $dateToString did.
  const trips = await prisma.trip.findMany({
    where: { vehicleId: { in: vehicleIds }, startTime: { gte: since } },
    select: { startTime: true, distanceKm: true },
  });
  const distanceByDay = {};
  for (const t of trips) {
    const key = t.startTime.toISOString().slice(0, 10);
    distanceByDay[key] = (distanceByDay[key] || 0) + (t.distanceKm || 0);
  }

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

    const company = await updateCompany(req.user.companyId, { totalRevenue });
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(toApi(company));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update revenue" });
  }
}

// COMPANY_OWNER — set or clear the company logo. Body: { uploadId } from
// POST /api/uploads (kind "logo"), or { uploadId: null }.
export async function updateMyLogo(req, res) {
  try {
    if (req.body.uploadId === undefined) return res.status(400).json({ error: "uploadId is required (or null to remove)" });
    const company = await prisma.company.findUnique({ where: { id: req.user.companyId ?? "" }, select: { id: true } });
    if (!company) return res.status(404).json({ error: "Company not found" });
    const { error, url } = await setImageField("company", company.id, "logoUploadId", req.body.uploadId, {
      companyId: company.id,
      kind: "logo",
    });
    if (error) return res.status(400).json({ error });
    return res.json({ logoUrl: url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update company logo" });
  }
}
