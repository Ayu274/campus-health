const { Pool } = require("pg");
const fs = require("fs");

const pool = new Pool({
  connectionString: "postgresql://campus_health_db_user:OtGrH1lhpxYKTvrDQrxJsUdeZCMoeNse@dpg-d7ih32navr4c73fmsfh0-a.oregon-postgres.render.com:5432/campus_health_db",
  ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync("C:\\Users\\BHARAT\\Downloads\\Database_Schema_1.sql", "utf8");

pool.query(sql)
  .then(() => {
    console.log("✅ All tables created!");
    pool.end();
  })
  .catch(err => {
    console.error("❌ Error:", err.message);
    pool.end();
  });