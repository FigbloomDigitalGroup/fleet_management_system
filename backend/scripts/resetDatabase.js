import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// dotenv/config loads .env relative to wherever `node` was run from, not this
// file's location — so running this from inside scripts/ (instead of the
// backend/ root) silently loads nothing and DATABASE_URL ends up undefined.
// Resolving the path from this file's own location makes it work regardless
// of the current working directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// Deletes EVERY row in every table of the database DATABASE_URL points at.
//   node scripts/resetDatabase.js --yes
async function run() {
  const { default: prisma } = await import("../lib/prisma.js");
  const target = new URL(process.env.DATABASE_URL).hostname;
  if (!process.argv.includes("--yes")) {
    console.log(`This deletes ALL data in the database on ${target}. Run again with --yes to confirm.`);
    process.exit(1);
  }

  const tables = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  );
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  for (const t of tables) console.log(`Cleared: ${t.tablename}`);

  console.log("Database reset complete.");
  await prisma.$disconnect();
  process.exit(0);
}

run();
