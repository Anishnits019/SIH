import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ComingSoon from "./pages/ComingSoon.jsx";
import EMRRecord from "./pages/EMRRecord.jsx";
import PrescriptionPage from "./pages/Prescription.jsx";
import TerminologyPage from "./pages/Terminology.jsx";
import FhirBundleGenerator from "./pages/FhirBundleGenerator.jsx";
import AuditPage from "./pages/AuditPage.jsx";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on app start/refresh
  useEffect(() => {
    checkAuthStatus();
  }, []);
 const API = import.meta.env.VITE_API_URL;
  const checkAuthStatus = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API}api/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setLoggedIn(true); // Token is valid, stay logged in
      } else {
        // Token invalid, clear storage
        localStorage.removeItem('token');
        localStorage.removeItem('doctor');
      }
    } catch (error) {
      // Network error, clear storage to be safe
      localStorage.removeItem('token');
      localStorage.removeItem('doctor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (token, doctor) => {
    // Store token and doctor info (already done in LoginPage, but double ensure)
    localStorage.setItem('token', token);
    localStorage.setItem('doctor', JSON.stringify(doctor));
    setLoggedIn(true);
  };

  const handleLogout = () => {
    // Clear everything on logout
    localStorage.removeItem('token');
    localStorage.removeItem('doctor');
    setLoggedIn(false);
  };

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <>
      {!loggedIn ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="relative">
          
          
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/coming-soon" element={<ComingSoon />} />
            <Route path="/emr-record" element={<EMRRecord />} />
            <Route path="/emr" element={<EMRRecord />} />
            <Route path="/prescription" element={<PrescriptionPage />} />
            <Route path="/terminology" element={<TerminologyPage />} /> 
            <Route path="/bundlegenerator" element={<FhirBundleGenerator/>} /> 
            <Route path="/audit" element={<AuditPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      )}
    </>
  );
}