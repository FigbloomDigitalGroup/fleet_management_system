import dns from "dns";
import mongoose from "mongoose";

// mongodb+srv:// URIs require an SRV DNS lookup before connecting. On this
// network the local resolver (a "dev.opt" proxy) refuses that specific query
// type with ECONNREFUSED even though it — and everything else — resolves
// plain A/AAAA records just fine. Pointing Node's own DNS lookups at a public
// resolver that handles SRV correctly sidesteps that, without needing to
// change the connection string itself (Atlas's proxy layer expects the
// mongodb+srv:// flow specifically).
dns.setServers(["8.8.8.8", "1.1.1.1"]);

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }
}