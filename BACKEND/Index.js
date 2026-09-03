import "dotenv/config";
import express from "express";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import cors from "cors";

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);


app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", server: "running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/users", userRoutes);


app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
  });
});