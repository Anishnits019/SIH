// BackEnd/Routes/auth.routes.js
import { Router } from "express";
import { DEMO_DOCTORS, issueToken, requireAuth } from "../Middleware/auth.mock.js";

const router = Router();

router.post("/api/login", (req, res) => {
  const { id, password } = req.body || {};
  const doc = DEMO_DOCTORS.find(d => d.id === String(id || "").trim());
  if (!doc || doc.password !== String(password || "")) {
    return res.status(401).json({ ok: false, error: "Invalid credentials" });
  }
  const token = issueToken(doc);
  return res.json({ ok: true, token, doctor: { id: doc.id, name: doc.name, speciality: doc.speciality } });
});

// GET /api/me  (token check)
router.get("/api/me", requireAuth, (req, res) => {
  return res.json({ ok: true, user: req.user });
});

export default router;
