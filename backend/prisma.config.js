import "dotenv/config";
import { defineConfig } from "prisma/config";

// DATABASE_URL is the Postgres connection string (local: the fleet-postgres
// container in docker-compose.yml; production: set on Render).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
