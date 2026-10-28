// Creates a PLATFORM_ADMIN account. The credentials are passed on the
// command line rather than written into this file:
//   npm run create-admin -- <email> <password> [full name]
// It writes to the database DATABASE_URL points at.
import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

async function run() {
  const [emailArg, password, ...nameParts] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const fullName = nameParts.join(" ") || "ADMIN";

  if (!email || !password) {
    console.log("Usage: npm run create-admin -- <email> <password> [full name]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.log("The password must be at least 8 characters.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("A user with this email already exists.");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: "PLATFORM_ADMIN",
      companyId: null,
    },
  });

  console.log("Platform Admin created:", admin.email);
  await prisma.$disconnect();
  process.exit(0);
}

run();
