import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";

// dotenv/config loads .env relative to wherever `node` was run from, not this
// file's location — so running this from inside scripts/ (instead of the
// backend/ root) silently loads nothing and MONGODB_URI ends up undefined.
// Resolving the path from this file's own location makes it work regardless
// of the current working directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  await connectDB();

  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
    console.log(`Cleared: ${collection.collectionName}`);
  }

  console.log("Database reset complete.");
  process.exit(0);
}

run();




