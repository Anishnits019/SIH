import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import SuggestPage from "./pages/SuggestPage.jsx";
import ComingSoon from  "./pages/ComingSoon.jsx";
export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  const handleLoginSuccess = () => {
    setLoggedIn(true);
  };

  return (
    <>
      {!loggedIn ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/suggest" element={<SuggestPage system="" />} />
            <Route path="/coming-soon" element={<ComingSoon />} />

        </Routes>
      )}
    </>
  );
}