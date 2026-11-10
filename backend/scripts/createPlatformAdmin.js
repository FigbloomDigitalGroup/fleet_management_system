// Creates a PLATFORM_ADMIN account. The credentials are passed on the
// command line rather than written into this file:
//   npm run create-admin -- <email> <password> [full name]
// Or, so no password is ever typed into a terminal, chat or server log, give
// "-" as the password:
//   npm run create-admin -- <email> - [full name]
// The account then gets a random password that is never shown, and its owner
// sets their own with "Forgot password" on the sign-in page (an emailed
// reset link, so SMTP_* must be set).
// It writes to the database DATABASE_URL points at.
import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

async function run() {
  const [emailArg, passwordArg, ...nameParts] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const fullName = nameParts.join(" ") || "ADMIN";
  const randomPassword = passwordArg === "-";
  const password = randomPassword ? crypto.randomBytes(32).toString("base64url") : passwordArg;

  if (!email || !password) {
    console.log("Usage: npm run create-admin -- <email> <password | -> [full name]");
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
  if (randomPassword) {
    console.log('It has a random password nobody knows: set one with "Forgot password" on the sign-in page.');
  }
  await prisma.$disconnect();
  process.exit(0);
}

run();
