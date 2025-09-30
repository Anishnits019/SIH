import React, { createContext, useContext, useState } from "react";

const PatientCtx = createContext(null);

export function PatientProvider({ children }) {
  const [patient, setPatient] = useState(() => {
    try { return JSON.parse(localStorage.getItem("selectedPatient") || "null"); }
    catch { return null; }
  });

  const selectPatient = (p) => {
    setPatient(p);
    localStorage.setItem("selectedPatient", JSON.stringify(p));
  };

  const clearPatient = () => {
    setPatient(null);
    localStorage.removeItem("selectedPatient");
  };

  return (
    <PatientCtx.Provider value={{ patient, selectPatient, clearPatient }}>
      {children}
    </PatientCtx.Provider>
  );
}

export function usePatient() {
  const ctx = useContext(PatientCtx);
  if (!ctx) throw new Error("usePatient must be used inside PatientProvider");
  return ctx;
}
