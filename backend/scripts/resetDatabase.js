import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";

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




