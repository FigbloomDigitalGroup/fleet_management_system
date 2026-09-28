import Company from "../models/Company.js";

// PLATFORM_ADMIN only — overview of all companies' subscription plans
export async function getBillingOverview(req, res) {
  try {
    const companies = await Company.find()
      .select("name status subscriptionPlan paymentMethod createdAt")
      .sort({ createdAt: -1 });

    const planCounts = companies.reduce((acc, c) => {
      acc[c.subscriptionPlan] = (acc[c.subscriptionPlan] || 0) + 1;
      return acc;
    }, {});

    return res.json({ companies, planCounts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch billing overview" });
  }
}

// PLATFORM_ADMIN only — change a company's plan
export async function updateCompanyPlan(req, res) {
  try {
    const { subscriptionPlan } = req.body;
    const allowed = ["trial", "basic", "pro", "enterprise"];
    if (!allowed.includes(subscriptionPlan)) {
      return res.status(400).json({ error: `subscriptionPlan must be one of: ${allowed.join(", ")}` });
    }

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { subscriptionPlan },
      { new: true }
    );
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json(company);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update plan" });
  }
}