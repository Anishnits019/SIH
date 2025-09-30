// Routes/suggest.js
import express from "express";
import mongoose from "mongoose";

const router = express.Router();
const col = () => mongoose.connection.collection("namaste"); // your collection with CodeSystems

const escapeRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/suggest?q=Va         (optional) &system=ayurveda|siddha|unani
router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  const system = (req.query.system || "").trim();
  if (!q) return res.json([]);

  const rx = new RegExp("^" + escapeRx(q), "i"); // starts-with, case-insensitive

  // match concepts whose display starts with q; optional system filter
  const match = { "concept.display": rx };
  if (system) match.id = "namaste-" + system;    // because your CodeSystem ids are like "namaste-ayurveda"

  try {
    const rows = await col().aggregate([
      { $unwind: "$concept" },
      { $match: match },
      // return RAW concept JSON + system id (very simple)
      { $project: { _id: 0, system: "$id", concept: "$concept" } },
      { $limit: 15 }
    ]).toArray();

    res.json(rows); // raw JSON
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
