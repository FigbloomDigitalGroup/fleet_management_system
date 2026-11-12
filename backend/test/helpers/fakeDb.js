// Just enough of the Prisma client for lib/platform/decisions.js and
// lib/companyStatus.js: companies, users, platform links and decision
// deliveries in memory, and $transaction that rolls back on a throw.
export function fakeDb({ companies = [], users = [] } = {}) {
  let state = {
    companies: companies.map((c) => ({ ...c })),
    users: users.map((u) => ({ ...u })),
    links: [],
    deliveries: [],
  };
  const failNext = { companyUpdate: false };

  const db = {
    state: () => state,
    failNext,
    async $transaction(fn) {
      const snapshot = structuredClone(state);
      try {
        return await fn(db);
      } catch (err) {
        state = snapshot;
        throw err;
      }
    },
    company: {
      async findUnique({ where }) {
        const c = state.companies.find((x) => x.id === where.id);
        return c ? { ...c } : null;
      },
      async updateMany({ where, data }) {
        if (failNext.companyUpdate) {
          failNext.companyUpdate = false;
          throw new Error("database went away");
        }
        const c = state.companies.find((x) => x.id === where.id);
        if (!c) return { count: 0 };
        Object.assign(c, data);
        return { count: 1 };
      },
    },
    user: {
      async findMany({ where }) {
        return state.users.filter((u) => u.companyId === where.companyId && (!where.role || u.role === where.role));
      },
    },
    platformLink: {
      async findUnique({ where }) {
        const { kind, localId } = where.kind_localId;
        return state.links.find((l) => l.kind === kind && l.localId === localId) ?? null;
      },
      async upsert({ where, create, update }) {
        const found = await db.platformLink.findUnique({ where });
        if (found) Object.assign(state.links.find((l) => l.kind === found.kind && l.localId === found.localId), update);
        else state.links.push({ ...create });
      },
    },
    platformDecisionDelivery: {
      async create({ data }) {
        if (state.deliveries.some((d) => d.deliveryId === data.deliveryId)) {
          throw Object.assign(new Error("Unique constraint failed on the fields: (`deliveryId`)"), { code: "P2002" });
        }
        state.deliveries.push({ ...data });
      },
      async update({ where, data }) {
        Object.assign(state.deliveries.find((d) => d.deliveryId === where.deliveryId), data);
      },
    },
  };
  return db;
}
