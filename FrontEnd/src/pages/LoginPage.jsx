import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage({ onLoginSuccess }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    const res = await fetch("http://localhost:4000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password }),
    });

    // Check if response is OK before parsing JSON
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    if (!data.ok) {
      setError(data.error || "Login failed");
      setLoading(false);
      return;
    }

    // Store token and doctor data
    localStorage.setItem("token", data.token);
    localStorage.setItem("doctor", JSON.stringify(data.doctor));
    
    // Call onLoginSuccess with the data
    if (onLoginSuccess) {
      onLoginSuccess(data.token, data.doctor);
    }
    
    // Navigate to dashboard
    navigate("/dashboard", { replace: true });

  } catch (err) {
    console.error("Login error:", err);
    setError(err.message.includes("Failed to fetch") 
      ? "Network error: Please check if backend server is running on port 4000" 
      : "Login failed. Please try again."
    );
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Medical Background with Doctor-related Images */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 to-teal-800/90">
        {/* Primary Medical Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage: `url("https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80")`
          }}
        ></div>
        
        {/* Overlay Medical Pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 20 L60 40 L80 40 L65 55 L75 75 L50 65 L25 75 L35 55 L20 40 L40 40 Z' fill='%23ffffff' fill-opacity='0.3'/%3E%3C/svg%3E")`,
            backgroundSize: '150px 150px'
          }}
        ></div>
        
        {/* Secondary Medical Elements */}
        <div 
          className="absolute top-10 right-10 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl"
        ></div>
        <div 
          className="absolute bottom-10 left-10 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl"
        ></div>
      </div>

      {/* Floating Medical Icons */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Medical Cross */}
        <div className="absolute top-20 left-20 text-white/10 transform rotate-12">
          <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </div>
        
        {/* Heartbeat */}
        <div className="absolute top-40 right-32 text-white/10">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </div>
        
        {/* Stethoscope */}
        <div className="absolute bottom-32 left-1/4 text-white/10 transform -rotate-45">
          <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
        </div>
      </div>

      {/* Login Card */}
      <div className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-white/20 z-10 transform transition-all duration-300 hover:shadow-3xl">
        {/* Medical Header with Doctor Image */}
        <div className="bg-gradient-to-r from-blue-600 to-teal-600 rounded-t-2xl p-6 text-white relative overflow-hidden">
          {/* Header Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}></div>
          </div>
          
          <div className="flex items-center justify-center space-x-4 relative z-10">
            {/* Medical Icon Container */}
            <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm border border-white/30">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">MediCare Pro</h1>
              <p className="text-blue-100 text-sm font-medium">Doctor's Portal</p>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-800">Secure Medical Login</h2>
            <p className="text-gray-600 text-sm mt-2">Access patient records and medical dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Doctor ID Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide text-xs">
                Doctor ID
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Enter your Doctor ID"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  className="block w-full pl-10 pr-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 text-gray-700 placeholder-gray-400 font-medium"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide text-xs">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 text-gray-700 placeholder-gray-400 font-medium"
                  required
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-pulse">
                <div className="flex items-center text-red-700">
                  <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white py-4 px-4 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:transform-none disabled:hover:shadow-lg flex items-center justify-center group"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="font-semibold">Authenticating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-3 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-semibold">Access Medical Portal</span>
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-teal-50 rounded-xl border border-blue-200">
            <div className="flex items-center mb-2">
              <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-blue-800">Demo Credentials</span>
            </div>
            <div className="text-sm text-blue-700 space-y-1">
              <div className="flex justify-between">
                <span className="font-medium">Doctor ID:</span>
                <span className="font-mono">drayush</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Password:</span>
                <span className="font-mono">demo123</span>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500 flex items-center justify-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              HIPAA Compliant • Secure medical portal • Confidential access only
            </p>
          </div>
        </div>
      </div>

      {/* Loading Success Animation */}
      {loading && !error && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-xl p-4 shadow-lg z-50 animate-slide-in">
          <div className="flex items-center text-green-700">
            <svg className="animate-spin h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium">Authentication successful! Redirecting...</span>
          </div>
        </div>
      )}
    </div>
  );
}