import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [showModal, setShowModal] = useState(false);
  const [abha, setAbha] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState(() => {
    try { return JSON.parse(localStorage.getItem("selectedPatient") || "null"); }
    catch { return null; }
  });
  const navigate = useNavigate();

  const isValidAbha = (id) => /^\d{14}$/.test(id);

  const openAdd = () => {
    setAbha("");
    setErr("");
    setShowModal(true);
  };

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
      localStorage.setItem("selectedPatient", JSON.stringify(data.patient));
      setPatient(data.patient);
      setShowModal(false);
      setLoading(false);
      navigate("/suggest"); // 👉 go to common pages after a correct ABHA
    } catch {
      setErr("Network error. Is the API running on :4000?");
      setLoading(false);
    }
  };

  const clearPatient = () => {
    localStorage.removeItem("selectedPatient");
    setPatient(null);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Dashboard</h2>
        <div className="flex gap-2">
          <button onClick={openAdd} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">
            ➕ Add Patient (ABHA)
          </button>
          {patient && (
            <button onClick={clearPatient} className="px-3 py-2 rounded bg-gray-200">
              Clear
            </button>
          )}
        </div>
      </div>

      {!patient ? (
        <p className="text-gray-500">No patient selected. Click “Add Patient (ABHA)” to continue.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Patient</h3>
            <p><span className="font-medium">ABHA:</span> {patient.abha}</p>
            <p><span className="font-medium">Name:</span> {patient.name}</p>
            <p><span className="font-medium">Age:</span> {patient.age}</p>
            <p><span className="font-medium">Gender:</span> {patient.gender}</p>
          </div>
          <div className="p-4 text-sm text-gray-600">
            You can now open <span className="font-medium">Suggest</span>, <span className="font-medium">Translate</span> or <span className="font-medium">Bundle Lab</span> from the top.
          </div>
        </div>
      )}

      {/* ABHA modal */}
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
