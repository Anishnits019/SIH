// BackEnd/Middleware/auth.mock.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "sih-demo-secret";
export const TOKEN_TTL = process.env.TOKEN_TTL || "8h";

// Hard-coded demo doctors (HPR-like IDs)
export const DEMO_DOCTORS = [
  { id: "drayush",  password: "demo123", name: "Dr. Ayush Kumar",  speciality: "Ayurveda" },
  { id: "drsiddha", password: "demo123", name: "Dr. Siddha Priya", speciality: "Siddha"   },
  { id: "drunani",  password: "demo123", name: "Dr. Unani Ali",    speciality: "Unani"    },
];

export function issueToken(doctor) {
  return jwt.sign(
    { sub: doctor.id, name: doctor.name, speciality: doctor.speciality, role: "doctor" },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ ok: false, error: "Missing token" });
  try {
    req.user = jwt.verify(m[1], JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}
