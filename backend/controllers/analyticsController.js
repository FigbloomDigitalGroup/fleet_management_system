import prisma from "../lib/prisma.js";

// PLATFORM_ADMIN only — cross-company usage stats
export async function getPlatformAnalytics(req, res) {
  try {
    const [totalCompanies, activeCompanies, pendingCompanies, suspendedCompanies, totalVehicles, activeVehicles, totalUsers] =
      await Promise.all([
        prisma.company.count(),
        prisma.company.count({ where: { status: "active" } }),
        prisma.company.count({ where: { status: "pending" } }),
        prisma.company.count({ where: { status: "suspended" } }),
        prisma.vehicle.count(),
        prisma.vehicle.count({ where: { status: "active" } }),
        prisma.user.count(),
      ]);

    // Vehicles per company, top 10 — useful for a bar chart
    const perCompany = await prisma.vehicle.groupBy({
      by: ["companyId"],
      _count: { _all: true },
      orderBy: { _count: { companyId: "desc" } },
      take: 10,
    });
    const names = await prisma.company.findMany({
      where: { id: { in: perCompany.map((c) => c.companyId) } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(names.map((c) => [c.id, c.name]));
    const vehiclesPerCompany = perCompany.map((c) => ({ count: c._count._all, name: nameOf.get(c.companyId) }));

    // Companies registered per month (UTC), last 6 months — useful for a growth chart
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recent = await prisma.company.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const byMonth = new Map();
    for (const { createdAt } of recent) {
      const key = `${createdAt.getUTCFullYear()}-${createdAt.getUTCMonth()}`;
      byMonth.set(key, { month: createdAt.getUTCMonth(), count: (byMonth.get(key)?.count ?? 0) + 1 });
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const growth = [...byMonth.values()].map((g) => ({
      name: monthNames[g.month],
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