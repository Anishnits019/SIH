import React, { useEffect, useState } from "react";

export default function PatientPage() {
  const [patient, setPatient] = useState(() => {
    try { return JSON.parse(localStorage.getItem("selectedPatient") || "null"); }
    catch { return null; }
  });

  const [showModal, setShowModal] = useState(!patient); // open if no patient yet
  const [abha, setAbha] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [problems, setProblems] = useState([{ code: "", description: "" }]);

  // helper
  const isValidAbha = (id) => /^\d{14}$/.test(id);

  const fetchPatient = async () => {
    setErr("");
    if (!isValidAbha(abha)) {
      setErr("Invalid ABHA ID (must be exactly 14 digits)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/patient/${abha}`);
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error || "Patient not found");
        setLoading(false);
        return;
      }
      setPatient(data.patient);
      localStorage.setItem("selectedPatient", JSON.stringify(data.patient));
      setShowModal(false);
      setLoading(false);
    } catch {
      setErr("Network error. Is API on :4000?");
      setLoading(false);
    }
  };

  const changePatient = () => {
    setAbha("");
    setErr("");
    setShowModal(true);
  };

  const changeProblem = (i, field, val) => {
    const copy = [...problems];
    copy[i][field] = val;
    setProblems(copy);
  };

  const addRow = () => setProblems((p) => [...p, { code: "", description: "" }]);

  const saveEncounter = () => {
    console.log("Saving (mock) encounter:", { patient, problems });
    alert("Encounter saved ✅ (mock)");
  };

  // if the user cleared storage elsewhere, reopen modal
  useEffect(() => {
    if (!patient) setShowModal(true);
  }, [patient]);

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Left card with patient info */}
      <div className="md:col-span-1 bg-white p-4 rounded-xl shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Patient Details</h3>
          <button onClick={changePatient} className="text-blue-600 text-sm">Change</button>
        </div>

        {patient ? (
          <div className="space-y-1 text-sm">
            <p><span className="font-medium">ABHA:</span> {patient.abha}</p>
            <p><span className="font-medium">Name:</span> {patient.name}</p>
            <p><span className="font-medium">Age:</span> {patient.age}</p>
            <p><span className="font-medium">Gender:</span> {patient.gender}</p>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No patient selected.</p>
        )}
      </div>

      {/* Right panel with problems form */}
      <div className="md:col-span-2 bg-white p-4 rounded-xl shadow">
        {patient ? (
          <>
            <h3 className="font-semibold mb-3">Record Problems</h3>
            {problems.map((p, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  className="w-40 p-2 border rounded"
                  placeholder="Code (e.g. EC-3)"
                  value={p.code}
                  onChange={(e) => changeProblem(i, "code", e.target.value)}
                />
                <input
                  className="flex-1 p-2 border rounded"
                  placeholder="Description"
                  value={p.description}
                  onChange={(e) => changeProblem(i, "description", e.target.value)}
                />
              </div>
            ))}
            <button onClick={addRow} className="text-blue-600 text-sm mb-4">
              + Add another problem
            </button>
            <br />
            <button onClick={saveEncounter} className="bg-green-600 text-white px-4 py-2 rounded">
              Save Encounter
            </button>
          </>
        ) : (
          <p className="text-gray-500">Enter a patient ABHA to begin.</p>
        )}
      </div>

      {/* Modal to enter ABHA */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-96 p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold mb-3">Enter ABHA ID</h3>
            <input
              type="text"
              value={abha}
              onChange={(e) => setAbha(e.target.value)}
              placeholder="14-digit ABHA"
              maxLength={14}
              className="w-full p-2 border rounded mb-2"
            />
            {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-3 py-2 rounded bg-gray-200">
                Cancel
              </button>
              <button onClick={fetchPatient} disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white">
                {loading ? "Checking…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
