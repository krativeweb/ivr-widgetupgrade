import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let conn;

try {
  conn = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // 🔥 Test actual connection
  const connection = await conn.getConnection();
  console.log("✅ Database connected successfully for ai-bot");
  connection.release();
} catch (err) {
  console.error("❌ Database connection failed:", err.message);
}

export { conn };
