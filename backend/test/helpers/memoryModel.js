// A small in-memory stand-in for one Prisma model, enough for the queries
// the memberships code makes: where (equality, in/notIn/not, gt/gte/lt/lte,
// startsWith/endsWith, AND/OR/NOT, compound unique keys such as
// userId_companyId, relation filters, `some`), include/select of relations,
// orderBy (incl. { sort, nulls }), take, create/update/updateMany/upsert/
// delete/deleteMany/count/groupBy. Rows live in arrays the test owns
// (getRows() returns the current one), so a test's reset() can swap them.
//
// relations: { name: { rows: () => [], from: "fk", to: "id", many?: false } }

let seq = 1;

const isPlainObject = (v) => v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v);
const cmp = (a, b) => (a instanceof Date || b instanceof Date ? new Date(a).getTime() - new Date(b).getTime() : a < b ? -1 : a > b ? 1 : 0);

function fieldMatches(value, cond) {
  if (!isPlainObject(cond)) return cond instanceof Date ? value instanceof Date && value.getTime() === cond.getTime() : value === cond;
  return Object.entries(cond).every(([op, arg]) => {
    switch (op) {
      case "equals":
        return value === arg;
      case "in":
        return arg.includes(value);
      case "notIn":
        return !arg.includes(value);
      case "not":
        return isPlainObject(arg) ? !fieldMatches(value, arg) : value !== arg;
      case "gt":
        return value != null && cmp(value, arg) > 0;
      case "gte":
        return value != null && cmp(value, arg) >= 0;
      case "lt":
        return value != null && cmp(value, arg) < 0;
      case "lte":
        return value != null && cmp(value, arg) <= 0;
      case "startsWith":
        return typeof value === "string" && value.startsWith(arg);
      case "endsWith":
        return typeof value === "string" && value.endsWith(arg);
      case "contains":
        return typeof value === "string" && value.includes(arg);
      case "mode":
        return true;
      default:
        throw new Error(`memoryModel: unsupported operator ${op}`);
    }
  });
}

export function memoryModel(getRows, { relations = {}, defaults = () => ({}), prefix = "row" } = {}) {
  function related(row, name) {
    const rel = relations[name];
    const all = rel.rows();
    return rel.many ? all.filter((r) => r[rel.to ?? "id"] === row[rel.from ?? "id"]) : all.find((r) => r[rel.to ?? "id"] === row[rel.from]) ?? null;
  }

  function matches(row, where = {}) {
    return Object.entries(where).every(([key, cond]) => {
      if (cond === undefined) return true;
      if (key === "AND") return [].concat(cond).every((w) => matches(row, w));
      if (key === "OR") return cond.some((w) => matches(row, w));
      if (key === "NOT") return ![].concat(cond).some((w) => matches(row, w));
      if (relations[key]) {
        const rel = relations[key];
        if (rel.many) {
          const items = related(row, key);
          if (cond.some) return items.some((r) => relMatch(rel, r, cond.some));
          if (cond.every) return items.every((r) => relMatch(rel, r, cond.every));
          if (cond.none) return !items.some((r) => relMatch(rel, r, cond.none));
          return true;
        }
        const target = related(row, key);
        return target ? relMatch(rel, target, cond) : cond === null;
      }
      // compound unique key: { userId_companyId: { userId, companyId } }
      if (isPlainObject(cond) && key.includes("_") && !(key in row) && Object.keys(cond).every((k) => key.split("_").includes(k))) {
        return Object.entries(cond).every(([k, v]) => row[k] === v);
      }
      return fieldMatches(row[key], cond);
    });
  }
  const relMatch = (rel, row, where) => (rel.model ? rel.model().matches(row, where) : Object.entries(where).every(([k, v]) => fieldMatches(row[k], v)));

  function order(rows, orderBy) {
    if (!orderBy) return rows;
    const keys = [].concat(orderBy);
    return [...rows].sort((a, b) => {
      for (const o of keys) {
        const [field, spec] = Object.entries(o)[0];
        const dir = typeof spec === "string" ? spec : spec.sort;
        const nulls = typeof spec === "object" ? spec.nulls : undefined;
        const av = a[field];
        const bv = b[field];
        if (av == null || bv == null) {
          if (av == null && bv == null) continue;
          const nullFirst = nulls ? nulls === "first" : dir === "asc";
          return (av == null) === nullFirst ? -1 : 1;
        }
        const c = cmp(av, bv);
        if (c) return dir === "desc" ? -c : c;
      }
      return 0;
    });
  }

  function shape(row, { include, select } = {}) {
    if (!row) return row;
    const out = {};
    if (select) {
      for (const [k, v] of Object.entries(select)) {
        if (!v) continue;
        if (relations[k]) out[k] = relationValue(row, k, v === true ? {} : v);
        else if (k === "_count") out._count = countValue(row, v.select);
        else out[k] = row[k];
      }
      return out;
    }
    Object.assign(out, row);
    for (const [k, v] of Object.entries(include ?? {})) {
      if (!v) continue;
      if (k === "_count") out._count = countValue(row, v.select);
      else out[k] = relationValue(row, k, v === true ? {} : v);
    }
    return out;
  }
  function relationValue(row, name, args) {
    const rel = relations[name];
    const sub = rel.model?.();
    if (rel.many) {
      let items = related(row, name).filter((r) => (args.where ? (sub ? sub.matches(r, args.where) : true) : true));
      items = sub ? sub.order(items, args.orderBy) : items;
      if (args.take) items = items.slice(0, args.take);
      return items.map((r) => (sub ? sub.shape(r, args) : { ...r }));
    }
    const target = related(row, name);
    return target ? (sub ? sub.shape(target, args) : args.select ? Object.fromEntries(Object.keys(args.select).map((k) => [k, target[k]])) : { ...target }) : null;
  }
  function countValue(row, select) {
    return Object.fromEntries(Object.keys(select).map((k) => [k, related(row, k).length]));
  }

  const findAll = (where) => getRows().filter((r) => matches(r, where));
  const first = (where) => getRows().find((r) => matches(r, where)) ?? null;

  function uniqueViolation(target) {
    return Object.assign(new Error(`Unique constraint failed on the fields: (${target})`), { code: "P2002", meta: { target } });
  }

  const model = {
    matches,
    order,
    shape,
    uniques: [],
    async findUnique(args) {
      return shape(first(args.where), args);
    },
    async findUniqueOrThrow(args) {
      const r = first(args.where);
      if (!r) throw Object.assign(new Error("not found"), { code: "P2025" });
      return shape(r, args);
    },
    async findFirst(args = {}) {
      const rows = order(findAll(args.where), args.orderBy);
      return shape(rows[0] ?? null, args);
    },
    async findMany(args = {}) {
      let rows = order(findAll(args.where), args.orderBy);
      if (args.skip) rows = rows.slice(args.skip);
      if (args.take) rows = rows.slice(0, args.take);
      return rows.map((r) => shape(r, args));
    },
    async count(args = {}) {
      return findAll(args.where).length;
    },
    async create(args) {
      const now = new Date();
      const row = { id: `${prefix}-${seq++}`, createdAt: now, updatedAt: now, ...defaults(), ...args.data };
      for (const fields of model.uniques) {
        if (getRows().some((r) => fields.every((f) => r[f] === row[f]))) throw uniqueViolation(fields.join(","));
      }
      getRows().push(row);
      return shape(row, args);
    },
    async update(args) {
      const row = first(args.where);
      if (!row) throw Object.assign(new Error("Record to update not found."), { code: "P2025" });
      Object.assign(row, args.data, { updatedAt: new Date() });
      return shape(row, args);
    },
    async updateMany(args) {
      const rows = findAll(args.where);
      rows.forEach((r) => Object.assign(r, args.data, { updatedAt: new Date() }));
      return { count: rows.length };
    },
    async upsert(args) {
      const row = first(args.where);
      if (row) return model.update({ where: args.where, data: args.update, include: args.include, select: args.select });
      return model.create({ data: args.create, include: args.include, select: args.select });
    },
    async delete(args) {
      const row = first(args.where);
      if (!row) throw Object.assign(new Error("Record to delete does not exist."), { code: "P2025" });
      const rows = getRows();
      rows.splice(rows.indexOf(row), 1);
      return row;
    },
    async deleteMany(args = {}) {
      const doomed = new Set(findAll(args.where));
      const rows = getRows();
      for (let i = rows.length - 1; i >= 0; i--) if (doomed.has(rows[i])) rows.splice(i, 1);
      return { count: doomed.size };
    },
    async groupBy({ by, where, _count }) {
      const groups = new Map();
      for (const r of findAll(where)) {
        const key = JSON.stringify(by.map((k) => r[k]));
        if (!groups.has(key)) groups.set(key, { ...Object.fromEntries(by.map((k) => [k, r[k]])), _count: { _all: 0 } });
        groups.get(key)._count._all++;
      }
      return [...groups.values()].map((g) => (_count ? g : { ...g, _count: undefined }));
    },
  };
  return model;
}

// A unique index, as the database would enforce it on create.
export function unique(model, ...fields) {
  model.uniques.push(fields);
  return model;
}

/**
 * The membership models over a test's own arrays:
 *   state() -> { users, companies, memberships, invitations?, teamAudit? }
 * Returns { membership, invitation, teamAuditLog, user? } to assign onto prisma.
 */
export function membershipModels(state) {
  const models = {};
  models.user = memoryModel(() => state().users, {
    prefix: "user",
    defaults: () => ({ status: "active", isPlatformAdmin: false }),
    relations: { memberships: { rows: () => state().memberships, from: "id", to: "userId", many: true, model: () => models.membership } },
  });
  models.company = memoryModel(() => state().companies, {
    prefix: "company",
    relations: {
      memberships: { rows: () => state().memberships, from: "id", to: "companyId", many: true, model: () => models.membership },
    },
  });
  models.membership = unique(
    memoryModel(() => state().memberships, {
      prefix: "mbr",
      defaults: () => ({ status: "active", adminAccess: null, lastUsedAt: null, invitedById: null }),
      relations: {
        user: { rows: () => state().users, from: "userId", to: "id", model: () => models.user },
        company: { rows: () => state().companies, from: "companyId", to: "id", model: () => models.company },
      },
    }),
    "userId",
    "companyId"
  );
  models.invitation = unique(
    memoryModel(() => (state().invitations ??= []), {
      prefix: "inv",
      defaults: () => ({ acceptedAt: null, revokedAt: null, acceptedById: null, adminAccess: null }),
      relations: { company: { rows: () => state().companies, from: "companyId", to: "id", model: () => models.company } },
    }),
    "tokenHash"
  );
  models.teamAuditLog = memoryModel(() => (state().teamAudit ??= []), { prefix: "audit" });
  return models;
}

/**
 * What the migration (20261113150000_fleet_memberships_invites) does to
 * people, on legacy-shaped fixtures ({ id, role, companyId, adminAccess,
 * status, createdAt }): PLATFORM_ADMIN -> isPlatformAdmin; one membership
 * per company user (ADMIN keeps its access level, a deactivated account's
 * membership is disabled). -> { users, memberships }
 */
export function migrateLegacyUsers(legacyUsers, companies = null) {
  const companyIds = companies ? new Set(companies.map((c) => c.id)) : null;
  const users = legacyUsers.map((u) => ({ status: "active", createdAt: new Date(0), ...u, isPlatformAdmin: u.role === "PLATFORM_ADMIN" || !!u.isPlatformAdmin }));
  const memberships = users
    .filter((u) => u.role && u.role !== "PLATFORM_ADMIN" && u.companyId && (!companyIds || companyIds.has(u.companyId)))
    .map((u) => ({
      id: `mbr_${u.id}`,
      userId: u.id,
      companyId: u.companyId,
      role: u.role,
      adminAccess: u.role === "ADMIN" ? u.adminAccess || "full" : null,
      status: (u.status ?? "active") === "active" ? "active" : "disabled",
      invitedById: null,
      lastUsedAt: null,
      createdAt: u.createdAt,
      updatedAt: new Date(),
    }));
  return { users, memberships };
}

// For the HTTP tests that swap Prisma's models for in-memory ones: adds the
// membership models over getDb() (its users, companies, memberships...), and
// a $transaction that runs on the same client. The originals go into `saved`.
export function installMembershipModels(prisma, saved, getDb) {
  for (const key of ["membership", "invitation", "teamAuditLog", "$transaction"]) if (!(key in saved)) saved[key] = prisma[key];
  const m = membershipModels(getDb);
  prisma.membership = m.membership;
  prisma.invitation = m.invitation;
  prisma.teamAuditLog = m.teamAuditLog;
  prisma.$transaction = async (fn) => (typeof fn === "function" ? fn(prisma) : Promise.all(fn));
  return m;
}
