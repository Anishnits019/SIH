import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [showModal, setShowModal] = useState(false);
  const [abha, setAbha] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [patient, setPatient] = useState(() => {
    try { 
      return JSON.parse(localStorage.getItem("selectedPatient") || "null"); 
    } catch { 
      return null; 
    }
  });
  const navigate = useNavigate();

  // Get doctor info from token on component mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        // Decode JWT token to get doctor information
        const payload = JSON.parse(atob(token.split('.')[1]));
        setDoctorInfo({
          name: payload.name,
          speciality: payload.speciality,
          id: payload.sub
        });
      } catch (error) {
        console.error("Error decoding token:", error);
        // Fallback to default if token decoding fails
        setDoctorInfo({
          name: "Dr. Ayush Kumar",
          speciality: "Ayurveda",
          id: "drayush"
        });
      }
    }
  }, []);

  const isValidAbha = (id) => /^\d{14}$/.test(id);
  const goToComingSoon = () => navigate("/coming-soon");
  const goToEMRRecord = () => navigate("/emr-record");
  const goToPrescription = () => navigate("/prescription");
  const goToBundleGenerator = () => navigate("/bundlegenerator");
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

    const API = import.meta.env.VITE_API_URL;
    try {
      const res = await fetch(`${API}/api/patient/${abha}`);
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
      navigate("/dashboard");
    } catch {
      setErr("Network error. Is the API running on :4000?");
      setLoading(false);
    }
  };

  const clearPatient = () => {
    localStorage.removeItem("selectedPatient");
    setPatient(null);
  };

  // Doctor name mapping based on DEMO_DOCTORS from backend
  const getDoctorDisplayInfo = () => {
    if (!doctorInfo) {
      return { name: "Dr. Ayush Kumar", speciality: "Ayurveda" };
    }
    
    // Ensure consistency with backend DEMO_DOCTORS
    const doctorMap = {
      'drayush': { name: "Dr. Ayush Kumar", speciality: "Ayurveda" },
      'drsiddha': { name: "Dr. Siddha Priya", speciality: "Siddha" },
      'drunani': { name: "Dr. Unani Ali", speciality: "Unani" }
    };
    
    return doctorMap[doctorInfo.id] || doctorInfo;
  };

  const displayDoctor = getDoctorDisplayInfo();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Ayush Medical Dashboard</h1>
            <p className="text-gray-600">Electronic Health Record System</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-900 font-medium">{displayDoctor.name}</p>
            <p className="text-sm text-gray-600">{displayDoctor.speciality} Medicine</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Patient Info Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-lg">Patient Information</h3>
              <div className="flex gap-2">
                <button 
                  onClick={openAdd} 
                  className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add
                </button>
                {patient && (
                  <button 
                    onClick={clearPatient} 
                    className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {patient ? (
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <p className="text-sm text-blue-800 font-medium">ABHA Number</p>
                  <p className="text-lg font-mono font-bold text-blue-900">{patient.abha}</p>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Full Name</p>
                    <p className="text-gray-900 font-semibold">{patient.name}</p>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Age</p>
                      <p className="text-gray-900 font-semibold">{patient.age} years</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Gender</p>
                      <p className="text-gray-900 font-semibold">{patient.gender}</p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center text-green-600">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">Patient Verified</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">No patient selected</p>
                <p className="text-gray-400 text-xs mt-1">
                  ABHA IDs for testing:<br/>
                  98765432109876<br/>
                  12345678901234
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Actions Dashboard */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {patient ? (
              <>
                <div className="mb-8">
                  <h3 className="font-semibold text-gray-800 text-lg mb-6">Available Actions</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* View EMR Record */}
                    <div 
                      onClick={goToEMRRecord} 
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all duration-200 group"
                    >
                      <div className="flex items-center mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-blue-200 transition-colors">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-800 group-hover:text-blue-700">View EMR Record</h4>
                      </div>
                      <p className="text-sm text-gray-600 ml-13">Access complete electronic medical records and patient history</p>
                    </div>

                    {/* Suggest Tests */}
                    <div 
                      onClick={goToComingSoon}
                      className="border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:bg-green-50 cursor-pointer transition-all duration-200 group"
                    >
                      <div className="flex items-center mb-2">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-green-200 transition-colors">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-800 group-hover:text-green-700">Suggest Tests</h4>
                      </div>
                      <p className="text-sm text-gray-600 ml-13">Recommend diagnostic tests and laboratory investigations</p>
                    </div>

                    {/* Translate Results */}
                    <div 
                      onClick={goToComingSoon}
                      className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all duration-200 group"
                    >
                      <div className="flex items-center mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-purple-200 transition-colors">
                          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-800 group-hover:text-purple-700">Translate Results</h4>
                      </div>
                      <p className="text-sm text-gray-600 ml-13">Translate medical reports and results into different languages</p>
                    </div>

                    {/* Bundle Lab */}
                    <div 
                      onClick={goToBundleGenerator}
                      className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:bg-orange-50 cursor-pointer transition-all duration-200 group"
                    >
                      <div className="flex items-center mb-2">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-orange-200 transition-colors">
                          <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-800 group-hover:text-orange-700">Bundle Lab</h4>
                      </div>
                      <p className="text-sm text-gray-600 ml-13">Create and manage laboratory test bundles and packages</p>
                    </div>

                     <div 
    onClick={() => navigate("/audit")}
    className="border border-gray-200 rounded-lg p-4 hover:border-red-300 hover:bg-red-50 cursor-pointer transition-all duration-200 group"
  >
    <div className="flex items-center mb-2">
      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-red-200 transition-colors">
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h4 className="font-semibold text-gray-800 group-hover:text-red-700">Audit Trail</h4>
    </div>
    <p className="text-sm text-gray-600 ml-13">View compliance logs and ABDM transactions</p>
                     </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="font-medium text-gray-700 mb-4">Patient Quick Stats</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">0</p>
                      <p className="text-xs text-gray-600">Active Visits</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">0</p>
                      <p className="text-xs text-gray-600">Pending Tests</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">0</p>
                      <p className="text-xs text-gray-600">Medications</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to EHR Dashboard</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-4">
                  Please add a patient using their ABHA ID to access medical features and patient management tools.
                </p>
                <button 
                  onClick={openAdd}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center mx-auto"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Patient with ABHA
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ABHA Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800">Patient Verification</h3>
              <p className="text-gray-600 text-sm mt-1">Enter ABHA ID to access patient records</p>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ABHA Number (14 digits)
                </label>
                <input
                  type="text"
                  value={abha}
                  onChange={(e) => setAbha(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 14-digit ABHA"
                  maxLength={14}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-lg text-center transition-colors"
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Numeric only - no spaces or special characters
                </p>
              </div>
              
              {err && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {err}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={fetchPatient} 
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    "Continue"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}