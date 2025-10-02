import React, { useState, useEffect } from "react";
import { usePatient } from "../store/PatientContext.jsx";
import { useNavigate } from "react-router-dom";

export default function PatientPage() {
  const { patient } = usePatient();
  const [problems, setProblems] = useState([{ code: "", description: "" }]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!patient) navigate("/"); // if no patient selected, send back (or choose /suggest)
  }, [patient, navigate]);

  const change = (i, field, val) => {
    const arr = [...problems];
    arr[i][field] = val;
    setProblems(arr);
  };

  const addRow = () => setProblems((p) => [...p, { code: "", description: "" }]);

  const save = () => {
    console.log("Saving encounter (mock):", { patient, problems });
    alert("Encounter saved ✅ (mock)");
  };

  if (!patient) return null;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Left sidebar-like card */}
      <div className="md:col-span-1 bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Patient Details</h3>
        <div className="space-y-1 text-sm">
          <p><span className="font-medium">ABHA:</span> {patient.abha}</p>
          <p><span className="font-medium">Name:</span> {patient.name}</p>
          <p><span className="font-medium">Age:</span> {patient.age}</p>
          <p><span className="font-medium">Gender:</span> {patient.gender}</p>
        </div>
      </div>

      {/* Right main panel */}
      <div className="md:col-span-2 bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Record Problems</h3>
        {problems.map((p, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              className="w-40 p-2 border rounded"
              placeholder="Code (e.g. EC-3)"
              value={p.code}
              onChange={(e) => change(i, "code", e.target.value)}
            />
            <input
              className="flex-1 p-2 border rounded"
              placeholder="Description"
              value={p.description}
              onChange={(e) => change(i, "description", e.target.value)}
            />
          </div>
        ))}
        <button onClick={addRow} className="text-blue-600 text-sm mb-4">
          + Add another problem
        </button>
        <br />
        <button onClick={save} className="bg-green-600 text-white px-4 py-2 rounded">
          Save Encounter
        </button>
      </div>
    </div>
  );
}
