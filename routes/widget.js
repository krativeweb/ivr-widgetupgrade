import express from "express";
import { conn } from "../db.js";

const router = express.Router();

// 🔓 decode double base64
function decodeId(encoded) {
  try {
    return Buffer.from(
      Buffer.from(encoded, "base64").toString(),
      "base64",
    ).toString();
  } catch {
    return null;
  }
}

router.get("/widget-user", async (req, res) => {
  try {
    const encodedId = req.query.id;

    if (!encodedId) {
      return res.status(400).json({ error: "Missing ID" });
    }

    const userId = decodeId(encodedId);

    if (!userId) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    // ✅ USING YOUR DB CONNECTION
const [rows] = await conn.query(
  `SELECT *
   FROM national_detailer_ai_bot 
   WHERE user_id = ?`,
  [userId],
);

    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      user: rows[0],
    });
  } catch (err) {
    console.error("API ERROR:", err);
    res.status(500).json({ error: err.message }); // 🔥 important
  }
});

export default router;
