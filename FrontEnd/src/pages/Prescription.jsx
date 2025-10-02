import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function PrescriptionPage() {
  const [patient, setPatient] = useState(null);
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [prescription, setPrescription] = useState([{ medicine: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  const [labTests, setLabTests] = useState([{ testName: "", reason: "", urgency: "Routine" }]);
  const [selectedDiseases, setSelectedDiseases] = useState([]);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  
  const navigate = useNavigate();

  useEffect(() => {
    // Load patient
    const storedPatient = localStorage.getItem("selectedPatient");
    if (storedPatient) {
      setPatient(JSON.parse(storedPatient));
    }

    // Load doctor info from login credentials
    const storedDoctor = localStorage.getItem("doctorInfo");
    if (storedDoctor) {
      setDoctorInfo(JSON.parse(storedDoctor));
    } else {
      // Fallback to default if no doctor info found
      setDoctorInfo({
        name: "Dr. Sharma",
        qualification: "BAMS",
        registration: "AY123456",
        signature: "Dr. Sharma"
      });
    }

    // Load diseases from terminology
    const storedDiseases = localStorage.getItem('prescriptionDiseases');
    if (storedDiseases) {
      setSelectedDiseases(JSON.parse(storedDiseases));
    }
  }, []);

  // Medicine functions
  const addMedicine = () => {
    setPrescription([...prescription, { medicine: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  };

  const updateMedicine = (index, field, value) => {
    const updated = [...prescription];
    updated[index][field] = value;
    setPrescription(updated);
  };

  const removeMedicine = (index) => {
    const updated = prescription.filter((_, i) => i !== index);
    setPrescription(updated);
  };

  // Lab test functions
  const addLabTest = () => {
    setLabTests([...labTests, { testName: "", reason: "", urgency: "Routine" }]);
  };

  const updateLabTest = (index, field, value) => {
    const updated = [...labTests];
    updated[index][field] = value;
    setLabTests(updated);
  };

  const removeLabTest = (index) => {
    const updated = labTests.filter((_, i) => i !== index);
    setLabTests(updated);
  };

  // Remove disease from prescription
  const removeDisease = (diseaseId) => {
    const updatedDiseases = selectedDiseases.filter(d => d.id !== diseaseId);
    setSelectedDiseases(updatedDiseases);
    localStorage.setItem('prescriptionDiseases', JSON.stringify(updatedDiseases));
  };

  // Save complete prescription and navigate to EMR
  const savePrescription = () => {
    if (selectedDiseases.length === 0) {
      alert("Please add at least one disease from terminology mapping.");
      return;
    }

    if (!doctorInfo) {
      alert("Doctor information not found. Please login again.");
      return;
    }

    const prescriptionData = {
      id: Date.now(),
      patient: patient,
      diseases: selectedDiseases,
      medicines: prescription.filter(med => med.medicine.trim() !== ""),
      labTests: labTests.filter(test => test.testName.trim() !== ""),
      doctor: doctorInfo,
      doctorNotes: doctorNotes,
      followUpDate: followUpDate,
      date: new Date().toISOString(),
      status: "active",
      type: "prescription"
    };

    // Save to prescription history
    const existingPrescriptions = JSON.parse(localStorage.getItem(`prescriptionHistory_${patient.abha}`) || '[]');
    const updatedHistory = [prescriptionData, ...existingPrescriptions];
    localStorage.setItem(`prescriptionHistory_${patient.abha}`, JSON.stringify(updatedHistory));

    // Update diagnosed problems list - ONLY store current active problems
    const currentProblems = selectedDiseases.map(disease => ({
      id: disease.id,
      code: disease.ayushCode,
      display: disease.display,
      system: "AYUSH",
      ayushCode: disease.ayushCode,
      ayushDisplay: disease.display,
      icdCode: disease.icdCode,
      icdDisplay: disease.icdDisplay,
      date: new Date().toISOString(),
      status: "active"
    }));
    
    localStorage.setItem(`diagnosedProblems_${patient.abha}`, JSON.stringify(currentProblems));

    // Clear diseases from localStorage after saving
    localStorage.removeItem('prescriptionDiseases');

    alert("Prescription saved successfully! Redirecting to EMR Record...");
    
    // Navigate to EMR Record
    navigate("/emr-record");
  };

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-4">No Patient Selected</h2>
          <button 
            onClick={() => navigate("/dashboard")}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!doctorInfo) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Doctor Information Not Found</h2>
          <p className="text-gray-600 mb-6">Please login again to access prescription features.</p>
          <button 
            onClick={() => navigate("/login")}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Prescription</h1>
            <p className="text-gray-600">AYUSH Integrated Medicine</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Patient: {patient.name}</p>
            <p className="text-sm text-gray-500">ABHA: {patient.abha}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Patient Info */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Patient Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-semibold">{patient.name}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-sm text-gray-500">Age</p>
                  <p className="font-semibold">{patient.age}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Gender</p>
                  <p className="font-semibold">{patient.gender}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">ABHA</p>
                <p className="font-mono text-sm">{patient.abha}</p>
              </div>
            </div>

            {/* Doctor Info */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-2">Prescribing Doctor</h4>
              <div className="text-sm text-gray-600">
                <p className="font-semibold">{doctorInfo.name}</p>
                <p>{doctorInfo.qualification}</p>
                <p className="text-xs text-gray-500">Reg: {doctorInfo.registration}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Prescription Form */}
        <div className="lg:col-span-3 space-y-6">
          {/* Diseases from Terminology */}
          {selectedDiseases.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 text-lg flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Diagnosed Diseases ({selectedDiseases.length})
                </h3>
                <button
                  onClick={() => navigate("/terminology")}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add More
                </button>
              </div>
              
              <div className="grid gap-3">
                {selectedDiseases.map((disease) => (
                  <div key={disease.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-gray-800">{disease.display}</span>
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            AYUSH: {disease.ayushCode}
                          </span>
                          {disease.icdCode && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                              ICD: {disease.icdCode}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeDisease(disease.id)}
                        className="text-red-500 hover:text-red-700 p-2 rounded-lg transition-colors ml-4"
                        title="Remove disease"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
              <svg className="w-12 h-12 text-yellow-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="font-semibold text-yellow-800 mb-2">No Diseases Selected</h3>
              <p className="text-yellow-600 mb-4">Please add diseases from terminology mapping first</p>
              <button
                onClick={() => navigate("/terminology")}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-medium"
              >
                Go to Terminology Mapping
              </button>
            </div>
          )}

          {/* Medication Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-lg">Medication</h3>
              <button
                onClick={addMedicine}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Medicine
              </button>
            </div>
            
            <div className="space-y-4">
              {prescription.map((med, index) => (
                <div key={index} className="grid md:grid-cols-5 gap-4 p-4 border border-gray-200 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Medicine</label>
                    <input
                      type="text"
                      value={med.medicine}
                      onChange={(e) => updateMedicine(index, 'medicine', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Medicine name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dosage</label>
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 500mg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                    <input
                      type="text"
                      value={med.frequency}
                      onChange={(e) => updateMedicine(index, 'frequency', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., BD, TDS"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                    <input
                      type="text"
                      value={med.duration}
                      onChange={(e) => updateMedicine(index, 'duration', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 5 days"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => removeMedicine(index)}
                      className="text-red-500 hover:text-red-700 p-2 transition-colors"
                      title="Remove medicine"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lab Tests Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-lg">Lab Tests & Procedures</h3>
              <button
                onClick={addLabTest}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Test
              </button>
            </div>
            
            <div className="space-y-4">
              {labTests.map((test, index) => (
                <div key={index} className="grid md:grid-cols-4 gap-4 p-4 border border-gray-200 rounded-lg">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Test/Procedure Name</label>
                    <input
                      type="text"
                      value={test.testName}
                      onChange={(e) => updateLabTest(index, 'testName', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Complete Blood Count, X-Ray Chest"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                    <input
                      type="text"
                      value={test.reason}
                      onChange={(e) => updateLabTest(index, 'reason', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Reason for test"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => removeLabTest(index)}
                      className="text-red-500 hover:text-red-700 p-2 transition-colors"
                      title="Remove test"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 text-lg mb-4">Additional Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Doctor's Notes</label>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-20"
                  placeholder="Additional instructions, precautions, or notes..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-800">Complete Prescription</h3>
                <p className="text-sm text-gray-600">
                  {selectedDiseases.length} diseases • {prescription.filter(m => m.medicine).length} medicines • {labTests.filter(t => t.testName).length} tests
                </p>
              </div>
              <button
                onClick={savePrescription}
                disabled={selectedDiseases.length === 0}
                className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                  selectedDiseases.length === 0 
                    ? "bg-gray-400 text-gray-200 cursor-not-allowed" 
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                Save Prescription to EMR
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}