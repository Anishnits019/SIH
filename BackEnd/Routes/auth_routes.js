// Routes/auth.routes.js
import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();

const DEMO_DOCTORS = [
  { id: "drayush",  password: "demo123", name: "Dr. Ayush Kumar",  speciality: "Ayurveda" },
  { id: "drsiddha", password: "demo123", name: "Dr. Siddha Priya", speciality: "Siddha" },
  { id: "drunani",  password: "demo123", name: "Dr. Unani Ali",    speciality: "Unani" }
];

const JWT_SECRET = process.env.JWT_SECRET || "sih-demo-secret";

// --- POST /api/login ---
router.post("/api/login", (req, res) => {
  const { id, password } = req.body;
  const doc = DEMO_DOCTORS.find(d => d.id === id);
  if (!doc || doc.password !== password) {
    return res.status(401).json({ ok: false, error: "Invalid credentials" });
  }
  const token = jwt.sign(
    { sub: doc.id, name: doc.name, speciality: doc.speciality, role: "doctor" },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
  return res.json({ ok: true, token, doctor: { id: doc.id, name: doc.name, speciality: doc.speciality } });
});

// --- GET /api/me ---
router.get("/api/me", (req, res) => {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ ok: false, error: "Missing token" });
  try {
    const user = jwt.verify(m[1], JWT_SECRET);
    return res.json({ ok: true, user });
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
});

export default router;
