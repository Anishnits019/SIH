import express from "express";
const router = express.Router();

// Mock patients
const patients = {
  "selvi@abdm": { abha: "selvi@abdm", name: "Selvi", age: 32, gender: "Female" },
  "arun@abdm": { abha: "arun@abdm", name: "Arun", age: 45, gender: "Male" }
};

router.get("/api/patient/:abhaId", (req, res) => {
  const { abhaId } = req.params;
  if (patients[abhaId]) {
    res.json({ ok: true, patient: patients[abhaId] });
  } else {
    res.json({ ok: false, error: "Patient not found" });
  }
});

export default router;
