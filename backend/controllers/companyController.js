import Company from "../models/Company.js";
import User from "../models/User.js";
import Geofence from "../models/Geofence.js";
import { isInsideGeofence } from "../lib/geo.js";

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

// COMPANY_OWNER — self-serve upgrade/downgrade between Trial, Basic and Pro.
// Enterprise is sales-assisted (see the landing page's "Contact sales"), so
// it isn't offered through this endpoint. Real payment processing isn't
// wired up yet — this just records the chosen plan and payment method.
const SELF_SERVE_PLANS = ["trial", "basic", "pro"];
const PAYMENT_METHODS = ["mpesa", "paystack"];

export async function updateMyPlan(req, res) {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ error: "This account is not linked to a company" });
    }

    const { subscriptionPlan, paymentMethod } = req.body;
    if (!SELF_SERVE_PLANS.includes(subscriptionPlan)) {
      return res.status(400).json({ error: `subscriptionPlan must be one of: ${SELF_SERVE_PLANS.join(", ")}` });
    }
    if (subscriptionPlan !== "trial" && !PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: `paymentMethod must be one of: ${PAYMENT_METHODS.join(", ")}` });
    }

    const company = await Company.findByIdAndUpdate(
      req.user.companyId,
      { subscriptionPlan, paymentMethod: subscriptionPlan === "trial" ? null : paymentMethod },
      { new: true }
    );
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(company);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update plan" });
  }
}





