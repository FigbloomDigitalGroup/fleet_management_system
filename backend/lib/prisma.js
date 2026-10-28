import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One shared client for the whole process. DATABASE_URL points at Postgres
// (see prisma.config.js and docker-compose.yml).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

export default prisma;
