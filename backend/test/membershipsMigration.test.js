import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// The memberships migration on a real Postgres: data-preserving and safe to
// run twice. Opt-in, because it WIPES the database it is given: set
// MIGRATION_TEST_DATABASE_URL to a throwaway database, e.g.
//   MIGRATION_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55433/scratch npm test
const url = process.env.MIGRATION_TEST_DATABASE_URL;
const NEW = "20261113150000_fleet_memberships_invites";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "prisma", "migrations");

test("the memberships migration copies people into memberships, and running it again changes nothing", { skip: !url && "MIGRATION_TEST_DATABASE_URL not set" }, async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    const before = fs.readdirSync(dir).filter((d) => /^\d{14}_/.test(d) && d < NEW).sort();
    for (const d of before) await client.query(fs.readFileSync(path.join(dir, d, "migration.sql"), "utf8"));

    await client.query(`
      INSERT INTO "Company" (id, name, slug, status, "updatedAt") VALUES ('co1','Alpha','alpha','active',now()), ('co2','Beta','beta','pending',now());
      INSERT INTO "User" (id, email, "passwordHash", "fullName", role, "companyId", "adminAccess", status, "updatedAt") VALUES
        ('u_owner','o@a.test','h','Owner','COMPANY_OWNER','co1','full','active',now()),
        ('u_admin','ad@a.test','h','Admin','ADMIN','co1','dispatcher','active',now()),
        ('u_drv','d@a.test','h','Driver','DRIVER','co1','full','inactive',now()),
        ('u_acct','acc@a.test','h','Acc','ACCOUNTANT','co2','full','active',now()),
        ('u_staff','s@figbloom.test','h','Staff','PLATFORM_ADMIN',NULL,'full','active',now());
      INSERT INTO "PlatformSyncQueue" (kind, "localId", "companyId") VALUES ('staff','u_drv','co1'), ('company','co1',NULL);
      INSERT INTO "PlatformLink" (kind, "localId") VALUES ('staff','u_owner'), ('organization','co1');
    `);

    const sql = fs.readFileSync(path.join(dir, NEW, "migration.sql"), "utf8");
    const snapshot = async () => ({
      memberships: (await client.query(`SELECT "userId", "companyId", role::text, "adminAccess"::text, status::text FROM "Membership" ORDER BY "userId"`)).rows,
      staff: (await client.query(`SELECT id FROM "User" WHERE "isPlatformAdmin" ORDER BY id`)).rows.map((r) => r.id),
      queue: (await client.query(`SELECT kind, "localId" FROM "PlatformSyncQueue" ORDER BY kind`)).rows,
      links: (await client.query(`SELECT kind, "localId" FROM "PlatformLink" ORDER BY kind`)).rows,
      users: (await client.query(`SELECT count(*)::int AS n FROM "User"`)).rows[0].n,
    });
    await client.query(`BEGIN; ${sql}; COMMIT;`);
    const first = await snapshot();
    assert.deepEqual(first.memberships, [
      { userId: "u_acct", companyId: "co2", role: "ACCOUNTANT", adminAccess: null, status: "active" },
      { userId: "u_admin", companyId: "co1", role: "ADMIN", adminAccess: "dispatcher", status: "active" },
      { userId: "u_drv", companyId: "co1", role: "DRIVER", adminAccess: null, status: "disabled" },
      { userId: "u_owner", companyId: "co1", role: "COMPANY_OWNER", adminAccess: null, status: "active" },
    ]);
    assert.deepEqual(first.staff, ["u_staff"]);
    assert.deepEqual(first.queue, [{ kind: "company", localId: "co1" }, { kind: "staff", localId: "u_drv:co1" }]);
    assert.deepEqual(first.links, [{ kind: "organization", localId: "co1" }, { kind: "staff", localId: "u_owner:co1" }]);
    assert.equal(first.users, 5, "nobody is lost");

    await client.query(`BEGIN; ${sql}; COMMIT;`);
    assert.deepEqual(await snapshot(), first, "a second run changes nothing");

    // the old columns are optional now: a person with no legacy role is fine
    await client.query(`INSERT INTO "User" (id, email, "passwordHash", "fullName", "updatedAt") VALUES ('u_new','n@a.test','h','New',now())`);
  } finally {
    await client.end();
  }
});
