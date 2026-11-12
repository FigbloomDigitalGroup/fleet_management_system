// Company summaries for the Figbloom console (GET /api/platform/companies):
// per company its id, name, status, created date, owner name and email, plan,
// counts (vehicles, drivers, admins, trips in the last 30 days) and when a
// location ping last arrived. No location data, and nothing about drivers
// beyond the count.

const DAY_MS = 24 * 60 * 60 * 1000;

export async function companySummaries(db, { id, now = new Date() } = {}) {
  const companyWhere = id ? { id: String(id) } : {};
  const scoped = id ? { companyId: String(id) } : {};

  const companies = await db.company.findMany({
    where: companyWhere,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      industry: true,
      subscriptionPlan: true,
      trialEndsAt: true,
      createdAt: true,
      users: { where: { role: "COMPANY_OWNER" }, orderBy: { createdAt: "asc" }, take: 1, select: { fullName: true, email: true } },
    },
  });
  if (!companies.length) return [];

  const [userCounts, vehicles, recentTrips, links] = await Promise.all([
    db.user.groupBy({ by: ["companyId", "role"], where: { ...scoped, role: { in: ["DRIVER", "ADMIN"] } }, _count: { _all: true } }),
    // one row per vehicle with its newest ping (the vehicleId+recordedAt index)
    db.vehicle.findMany({
      where: scoped,
      select: { id: true, companyId: true, pings: { orderBy: { recordedAt: "desc" }, take: 1, select: { recordedAt: true } } },
    }),
    db.trip.groupBy({
      by: ["vehicleId"],
      where: { startTime: { gte: new Date(now.getTime() - 30 * DAY_MS) }, ...(id ? { vehicle: { companyId: String(id) } } : {}) },
      _count: { _all: true },
    }),
    db.platformLink.findMany({ where: id ? { localId: String(id) } : {}, select: { kind: true, localId: true, platformId: true, registeredAt: true } }),
  ]);

  const per = new Map(
    companies.map((c) => [c.id, { vehicles: 0, drivers: 0, admins: 0, tripsLast30Days: 0, lastPing: null, organization: null, tenant: null }])
  );
  for (const u of userCounts) {
    const p = per.get(u.companyId);
    if (p) p[u.role === "DRIVER" ? "drivers" : "admins"] += u._count._all;
  }
  const companyOfVehicle = new Map();
  for (const v of vehicles) {
    companyOfVehicle.set(v.id, v.companyId);
    const p = per.get(v.companyId);
    if (!p) continue;
    p.vehicles++;
    const at = v.pings[0]?.recordedAt;
    if (at && (!p.lastPing || at > p.lastPing)) p.lastPing = at;
  }
  for (const t of recentTrips) {
    const p = per.get(companyOfVehicle.get(t.vehicleId));
    if (p) p.tripsLast30Days += t._count._all;
  }
  for (const l of links) {
    const p = per.get(l.localId);
    if (p && (l.kind === "organization" || l.kind === "tenant")) p[l.kind] = l;
  }

  return companies.map((c) => {
    const p = per.get(c.id);
    const owner = c.users[0];
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      industry: c.industry,
      createdAt: c.createdAt,
      owner: owner ? { name: owner.fullName, email: owner.email } : null,
      plan: { name: c.subscriptionPlan, trialEndsAt: c.trialEndsAt },
      counts: { vehicles: p.vehicles, drivers: p.drivers, admins: p.admins, tripsLast30Days: p.tripsLast30Days },
      lastLocationPingAt: p.lastPing,
      platform: {
        organizationId: p.organization?.platformId ?? null,
        tenantId: p.tenant?.platformId ?? null,
        registeredAt: p.organization?.registeredAt ?? null,
      },
    };
  });
}
