import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

async function run() {
  await connectDB();

  const email = "autorun5@gmail.com"; // change this to your real email
  const password = "admin12345"; // change this to your real password
  const fullName = "ADMIN";

  const existing = await User.findOne({ email });
  if (existing) {
    console.log("A user with this email already exists.");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await User.create({
    email,
    passwordHash,
    fullName,
    role: "PLATFORM_ADMIN",
    companyId: null,
  });

  console.log("Platform Admin created:", admin.email);
  process.exit(0);
}

run();