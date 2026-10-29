import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Supabase only accepts TLS connections signed by its own CA (Supabase
// dashboard → Database → SSL Configuration → Download certificate).
// DATABASE_CA_CERT is that certificate: the PEM text itself, or a path to
// the file. Without it (e.g. the local Docker database) the connection
// string's own settings apply.
function sslConfig() {
  const cert = process.env.DATABASE_CA_CERT;
  if (!cert) return undefined;
  const ca = cert.includes("BEGIN CERTIFICATE") ? cert.replace(/\\n/g, "\n") : fs.readFileSync(cert, "utf8");
  return { ca, rejectUnauthorized: true };
}

// One shared client for the whole process. DATABASE_URL points at Postgres
// (see prisma.config.js and docker-compose.yml).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: sslConfig() }),
});

export default prisma;
