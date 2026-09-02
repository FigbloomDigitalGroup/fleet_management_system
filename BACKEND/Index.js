import "dotenv/config";
import express from "express";
import pg from "pg";

const { Pool } = pg;

const app = express();
app.use(express.json());

// Connection pool to PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create a simple table on startup (safe to re-run)
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS demo_pings (
      id SERIAL PRIMARY KEY,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("demo_pings table ready");
}

// Health check — confirms server AND database are both working
app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");
    res.json({
      status: "ok",
      server: "running",
      database: "connected",
      db_time: result.rows[0].current_time,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      database: "not connected",
      error: err.message,
    });
  }
});

// Write a test record
app.post("/ping", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    const result = await pool.query(
      "INSERT INTO demo_pings (message) VALUES ($1) RETURNING *",
      [message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to insert record" });
  }
});

// Read all test records
app.get("/pings", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM demo_pings ORDER BY created_at DESC LIMIT 20"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

const PORT = process.env.PORT || 4000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to database on startup:", err.message);
    process.exit(1);
  });