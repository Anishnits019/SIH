import express from "express";
const router = express.Router();

// mock dataset
const mockPatients = {
  "12345678901234": { abha: "12345678901234", name: "Ravi Kumar", age: 42, gender: "Male" },
  "98765432109876": { abha: "98765432109876", name: "Anita Sharma", age: 36, gender: "Female" },
};

// Make sure this route is defined
router.get("/:abha", (req, res) => {
  const { abha } = req.params;
  const patient = mockPatients[abha];
  if (!patient) {
    return res.json({ ok: false, error: "Patient not found" });
  }
  return res.json({ ok: true, patient });
});

export default router;