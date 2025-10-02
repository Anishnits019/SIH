// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { usePatient } from "../store/PatientContext.jsx";

// export default function AddPatientButton() {
//   const [open, setOpen] = useState(false);
//   const [abha, setAbha] = useState("");
//   const [err, setErr] = useState("");
//   const [loading, setLoading] = useState(false);
//   const { selectPatient } = usePatient();
//   const navigate = useNavigate();

//   const isValidAbha = (id) => /^\d{14}$/.test(id);

//   const submit = async () => {
//     setErr("");
//     if (!isValidAbha(abha)) {
//       setErr("Invalid ABHA format — must be exactly 14 digits");
//       return;
//     }
//     setLoading(true);
//     try {
//       const res = await fetch(`http://localhost:4000/api/patient/${abha}`);
//       const data = await res.json();
//       if (!data.ok) {
//         setErr(data.error || "Patient not found");
//         setLoading(false);
//         return;
//       }
//       // success → store + go to /patient
//       selectPatient(data.patient);
//       setOpen(false);
//       setLoading(false);
//       navigate("/patient");
//     } catch (e) {
//       setErr("Network error. Is the API on :4000?");
//       setLoading(false);
//     }
//   };

//   return (
//     <>
//       <button
//         onClick={() => setOpen(true)}
//         className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
//       >
//         ➕ Add Patient (ABHA)
//       </button>

//       {open && (
//         <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
//           <div className="bg-white w-96 p-6 rounded-xl shadow">
//             <h3 className="text-lg font-semibold mb-3">Enter ABHA ID</h3>
//             <input
//               type="text"
//               value={abha}
//               onChange={(e) => setAbha(e.target.value)}
//               placeholder="14-digit ABHA"
//               className="w-full p-2 border rounded mb-2"
//               maxLength={14}
//             />
//             {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
//             <div className="flex justify-end gap-2">
//               <button onClick={() => setOpen(false)} className="px-3 py-2 rounded bg-gray-200">
//                 Cancel
//               </button>
//               <button
//                 onClick={submit}
//                 disabled={loading}
//                 className="px-4 py-2 rounded bg-blue-600 text-white"
//               >
//                 {loading ? "Checking…" : "Add"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }
