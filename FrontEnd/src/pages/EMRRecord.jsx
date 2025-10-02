import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function EMRRecord() {
  const [patient, setPatient] = useState(null);
  const [activeTab, setActiveTab] = useState("problems");
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [diagnosedProblems, setDiagnosedProblems] = useState([]);
  const [prescriptionHistory, setPrescriptionHistory] = useState([]);
  
  // Prescription State for EMR prescription generation
  const [prescription, setPrescription] = useState([{ medicine: "", dosage: "", frequency: "", duration: "" }]);
  const [labTests, setLabTests] = useState([{ testName: "", reason: "", urgency: "Routine" }]);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  
  const [doctorInfo] = useState({
    name: "Dr. Rajesh Sharma",
    qualification: "BAMS, MD (Ayurveda)",
    registration: "AY123456",
    signature: "Dr. Rajesh Sharma"
  });

  const navigate = useNavigate();

  useEffect(() => {
    // Load patient
    const storedPatient = localStorage.getItem("selectedPatient");
    if (storedPatient) {
      const patientData = JSON.parse(storedPatient);
      setPatient(patientData);
      loadMedicalHistory(patientData.abha);
      loadDiagnosedProblems(patientData.abha);
    }

    // Load terminology codes
    const storedCodes = localStorage.getItem("selectedTerminologyCodes");
    if (storedCodes) {
      setSelectedCodes(JSON.parse(storedCodes));
    }
  }, []);

  const loadMedicalHistory = (abha) => {
    const history = localStorage.getItem(`prescriptionHistory_${abha}`);
    if (history) {
      setPrescriptionHistory(JSON.parse(history));
    }
  };

  const loadDiagnosedProblems = (abha) => {
    const problems = localStorage.getItem(`diagnosedProblems_${abha}`);
    if (problems) {
      setDiagnosedProblems(JSON.parse(problems));
    }
  };

  const goToDashboard = () => navigate("/dashboard");
  const goToTerminology = () => navigate("/terminology");
  const goToPrescription = () => navigate("/prescription");

  // Add problem with selected codes (both AYUSH and ICD)
  const addProblemWithCodes = () => {
    if (selectedCodes.length === 0) {
      alert("Please select codes from the terminology mapping first.");
      return;
    }

    const newProblems = selectedCodes.map(code => ({
      id: Date.now() + Math.random(),
      code: code.code,
      display: code.display,
      system: code.system,
      // Store both AYUSH and ICD information
      ayushCode: code.ayushCode || code.code,
      ayushDisplay: code.ayushDisplay || code.display,
      icdCode: code.icdCode,
      icdDisplay: code.icdDisplay,
      date: new Date().toISOString(),
      status: "active"
    }));

    const updatedProblems = [...diagnosedProblems, ...newProblems];
    setDiagnosedProblems(updatedProblems);
    localStorage.setItem(`diagnosedProblems_${patient.abha}`, JSON.stringify(updatedProblems));
    
    alert(`Added ${newProblems.length} problems to diagnosis`);
    
    // Clear selected codes
    setSelectedCodes([]);
    localStorage.removeItem("selectedTerminologyCodes");
  };

  const clearSelectedCodes = () => {
    setSelectedCodes([]);
    localStorage.removeItem("selectedTerminologyCodes");
  };

  // Remove diagnosed problem
  const removeProblem = (problemId) => {
    const updatedProblems = diagnosedProblems.filter(p => p.id !== problemId);
    setDiagnosedProblems(updatedProblems);
    localStorage.setItem(`diagnosedProblems_${patient.abha}`, JSON.stringify(updatedProblems));
  };

  // Prescription functions for EMR
  const addMedicine = () => {
    setPrescription([...prescription, { medicine: "", dosage: "", frequency: "", duration: "" }]);
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

  // Generate PDF Prescription from EMR
  const generatePDF = (prescriptionData) => {
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription - ${patient.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .clinic-name { font-size: 24px; font-weight: bold; color: #1e40af; margin-bottom: 5px; }
          .clinic-tagline { font-size: 14px; color: #6b7280; }
          .patient-info { margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 18px; font-weight: bold; color: #1e40af; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
          .medicine-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          .medicine-table th { background: #1e40af; color: white; padding: 10px; text-align: left; }
          .medicine-table td { border: 1px solid #ddd; padding: 10px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #333; text-align: right; }
          .signature-box { display: inline-block; text-align: center; margin-top: 50px; }
          .signature-line { border-top: 1px solid #000; width: 200px; margin: 5px 0; }
          @media print { 
            body { margin: 0; font-size: 12px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="clinic-name">AYUSH CLINIC</div>
          <div class="clinic-tagline">Integrated Health Platform</div>
        </div>
        
        <div class="patient-info">
          <table width="100%">
            <tr>
              <td width="50%">
                <strong>Patient Information</strong><br>
                <strong>Name:</strong> ${patient.name}<br>
                <strong>ABHA:</strong> ${patient.abha}<br>
                <strong>Age:</strong> ${patient.age} years | <strong>Gender:</strong> ${patient.gender}
              </td>
              <td width="50%" style="text-align: right;">
                <strong>Prescription Details</strong><br>
                <strong>Date:</strong> ${new Date(prescriptionData.date).toLocaleDateString()}<br>
                <strong>Time:</strong> ${new Date(prescriptionData.date).toLocaleTimeString()}<br>
                <strong>Prescription ID:</strong> PR${prescriptionData.id}
              </td>
            </tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Diagnosis</div>
          <ul>
            ${prescriptionData.problems.map(problem => `
              <li>
                <strong>${problem.display}</strong><br>
                <small style="color: #666;">
                  AYUSH: ${problem.ayushCode || problem.code}
                  ${problem.icdCode ? ` | ICD-11: ${problem.icdCode}` : ''}
                </small>
              </li>
            `).join('')}
          </ul>
        </div>

        <div class="section">
          <div class="section-title">Medicines Prescribed</div>
          <table class="medicine-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Dosage</th>
                <th>Frequency</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              ${prescriptionData.medicines.map(med => `
                <tr>
                  <td>${med.medicine}</td>
                  <td>${med.dosage}</td>
                  <td>${med.frequency}</td>
                  <td>${med.duration}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${prescriptionData.labTests.length > 0 ? `
        <div class="section">
          <div class="section-title">Recommended Lab Tests</div>
          <table class="medicine-table">
            <thead>
              <tr>
                <th>Test Name</th>
                <th>Reason</th>
                <th>Urgency</th>
              </tr>
            </thead>
            <tbody>
              ${prescriptionData.labTests.map(test => `
                <tr>
                  <td>${test.testName}</td>
                  <td>${test.reason}</td>
                  <td>${test.urgency}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${prescriptionData.notes ? `
        <div class="section">
          <div class="section-title">Doctor's Notes</div>
          <p>${prescriptionData.notes}</p>
        </div>
        ` : ''}

        ${prescriptionData.followUp ? `
        <div class="section">
          <div class="section-title">Follow-up</div>
          <p>Next appointment: ${new Date(prescriptionData.followUp).toLocaleDateString()}</p>
        </div>
        ` : ''}

        <div class="footer">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div><strong>${doctorInfo.name}</strong></div>
            <div>${doctorInfo.qualification}</div>
            <div>Registration: ${doctorInfo.registration}</div>
          </div>
        </div>

        <div class="no-print" style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #1e40af; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Print Prescription
          </button>
          <button onclick="window.close()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
            Close
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Generate and save prescription from EMR
  const generatePrescriptionFromEMR = () => {
    if (diagnosedProblems.length === 0) {
      alert("Please add diagnosed problems first.");
      return;
    }

    const prescriptionData = {
      id: Date.now(),
      date: new Date().toISOString(),
      problems: diagnosedProblems,
      medicines: prescription.filter(m => m.medicine.trim() !== ""),
      labTests: labTests.filter(t => t.testName.trim() !== ""),
      notes: doctorNotes,
      followUp: followUpDate,
      doctor: doctorInfo,
      status: "active",
      source: "emr"
    };

    // Save to prescription history
    const updatedHistory = [prescriptionData, ...prescriptionHistory];
    setPrescriptionHistory(updatedHistory);
    localStorage.setItem(`prescriptionHistory_${patient.abha}`, JSON.stringify(updatedHistory));

    // Generate PDF
    generatePDF(prescriptionData);

    // Reset form
    setPrescription([{ medicine: "", dosage: "", frequency: "", duration: "" }]);
    setLabTests([{ testName: "", reason: "", urgency: "Routine" }]);
    setDoctorNotes("");
    setFollowUpDate("");

    alert("Prescription generated and saved to medical history!");
  };

  // View prescription details
  const viewPrescriptionDetails = (prescription) => {
    const detailsWindow = window.open('', '_blank');
    const detailsContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription Details - ${patient.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 18px; font-weight: bold; color: #1e40af; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
          .medicine-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          .medicine-table th { background: #1e40af; color: white; padding: 10px; text-align: left; }
          .medicine-table td { border: 1px solid #ddd; padding: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Prescription Details</h1>
          <p>Date: ${new Date(prescription.date).toLocaleDateString()}</p>
        </div>

        <div class="section">
          <div class="section-title">Diagnosis</div>
          <ul>
            ${prescription.problems ? prescription.problems.map(problem => `
              <li>
                <strong>${problem.display}</strong><br>
                <small style="color: #666;">
                  AYUSH: ${problem.ayushCode || problem.code}
                  ${problem.icdCode ? ` | ICD-11: ${problem.icdCode}` : ''}
                </small>
              </li>
            `).join('') : ''}
            ${prescription.diseases ? prescription.diseases.map(disease => `
              <li>
                <strong>${disease.display}</strong><br>
                <small style="color: #666;">
                  AYUSH: ${disease.ayushCode}
                  ${disease.icdCode ? ` | ICD-11: ${disease.icdCode}` : ''}
                </small>
              </li>
            `).join('') : ''}
          </ul>
        </div>

        <div class="section">
          <div class="section-title">Medicines</div>
          <table class="medicine-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Dosage</th>
                <th>Frequency</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              ${prescription.medicines.map(med => `
                <tr>
                  <td>${med.medicine}</td>
                  <td>${med.dosage}</td>
                  <td>${med.frequency}</td>
                  <td>${med.duration}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${prescription.labTests && prescription.labTests.length > 0 ? `
        <div class="section">
          <div class="section-title">Lab Tests</div>
          <table class="medicine-table">
            <thead>
              <tr>
                <th>Test Name</th>
                <th>Reason</th>
                <th>Urgency</th>
              </tr>
            </thead>
            <tbody>
              ${prescription.labTests.map(test => `
                <tr>
                  <td>${test.testName}</td>
                  <td>${test.reason}</td>
                  <td>${test.urgency}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #1e40af; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">
            Print
          </button>
          <button onclick="window.close()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Close
          </button>
        </div>
      </body>
      </html>
    `;

    detailsWindow.document.write(detailsContent);
    detailsWindow.document.close();
  };

  // Generate PDF for existing prescription
  const generatePDFForPrescription = (prescription) => {
    generatePDF(prescription);
  };

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-4">No Patient Selected</h2>
          <p className="text-gray-600 mb-6">Please select a patient from the dashboard first.</p>
          <button 
            onClick={goToDashboard}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Go to Dashboard
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
    {/* Title Section */}
    <div>
      <h1 className="text-2xl font-bold text-gray-800">Electronic Medical Record</h1>
      <p className="text-gray-600">AYUSH Integrated Health Platform</p>
    </div>
    
    {/* Right Section - Doctor Info and Dashboard Button */}
    <div className="flex items-center space-x-6">
      {/* Doctor Info */}
      <div className="text-right">
        <p className="text-sm text-gray-500">Dr. Sharma</p>
        <p className="text-sm text-gray-500">Ayurveda Physician</p>
      </div>
      
      {/* Vertical Separator */}
      <div className="h-8 w-px bg-gray-300"></div>
      
      {/* Dashboard Button */}
      <button
  onClick={() => navigate('/dashboard')}
  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
  title="Back to Dashboard"
>
        <svg 
          className="w-5 h-5 text-gray-600" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
          />
        </svg>
        <span className="text-gray-700 font-medium">Dashboard</span>
      </button>
    </div>
  </div>
</div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Patient Info Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-lg">Patient Information</h3>
              <button 
                onClick={goToDashboard}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Change
              </button>
            </div>

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

              {/* Quick Stats */}
              <div className="pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-gray-800">{diagnosedProblems.length}</div>
                    <div className="text-gray-600">Problems</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-gray-800">{prescriptionHistory.length}</div>
                    <div className="text-gray-600">Prescriptions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main EMR Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                {["problems", "prescription", "history"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === tab
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab === "problems" && "Problems & Diagnosis"}
                    {/* {tab === "prescription" && "Prescription"} */}
                    {tab === "history" && "Medical History"}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Problems Tab */}
              {activeTab === "problems" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800 text-lg">Problem List</h3>
                    <div className="flex gap-2">
                      {selectedCodes.length > 0 && (
                        <>
                          <button 
                            onClick={addProblemWithCodes}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700"
                          >
                            Add Selected Codes ({selectedCodes.length})
                          </button>
                          <button 
                            onClick={clearSelectedCodes}
                            className="bg-gray-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-600"
                          >
                            Clear
                          </button>
                        </>
                      )}
                      
                    </div>
                  </div>

                  {/* Selected Codes Preview */}
                  {selectedCodes.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-800 mb-3">Selected Terminology Codes:</h4>
                      <div className="grid gap-3">
                        {selectedCodes.map((code, index) => (
                          <div key={index} className="bg-white rounded-lg border border-green-100 p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-semibold text-gray-800 mb-2">{code.display}</div>
                                <div className="grid md:grid-cols-2 gap-3 text-sm">
                                  <div className="bg-blue-50 rounded px-3 py-2">
                                    <span className="font-medium text-blue-700">AYUSH: </span>
                                    <span className="text-blue-900">{code.ayushCode || code.code}</span>
                                  </div>
                                  <div className="bg-green-50 rounded px-3 py-2">
                                    <span className="font-medium text-green-700">ICD-11: </span>
                                    <span className="text-green-900">{code.icdCode || 'Not mapped'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Diagnosed Problems List */}
                  {diagnosedProblems.length > 0 ? (
                    <div className="space-y-4">
                      {diagnosedProblems.map((problem) => (
                        <div key={problem.id} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="font-semibold text-gray-800 text-lg">{problem.display}</div>
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                  {problem.system}
                                </span>
                              </div>
                              
                              {/* AYUSH and ICD Codes Display */}
                              <div className="grid md:grid-cols-2 gap-4 text-sm">
                                {/* AYUSH Code */}
                                <div className="bg-blue-50 rounded-lg p-3">
                                  <div className="font-medium text-blue-800 mb-1">AYUSH Code</div>
                                  <div className="text-blue-900">
                                    <strong>{problem.ayushCode || problem.code}</strong>
                                    {problem.ayushDisplay && (
                                      <div className="text-blue-700 mt-1">{problem.ayushDisplay}</div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* ICD Code */}
                                <div className="bg-green-50 rounded-lg p-3">
                                  <div className="font-medium text-green-800 mb-1">ICD-11 Code</div>
                                  <div className="text-green-900">
                                    {problem.icdCode ? (
                                      <>
                                        <strong>{problem.icdCode}</strong>
                                        {problem.icdDisplay && (
                                          <div className="text-green-700 mt-1">{problem.icdDisplay}</div>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-gray-500">Not mapped</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="text-xs text-gray-500 mt-3">
                                Added: {new Date(problem.date).toLocaleDateString()} at {new Date(problem.date).toLocaleTimeString()}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => removeProblem(problem.id)}
                              className="text-red-500 hover:text-red-700 p-2 transition-colors ml-4"
                              title="Remove problem"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-8 text-center">
                      <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="font-semibold text-gray-800 mb-2">No Problems Recorded</h3>
                      <p className="text-gray-600">Add problems from terminology mapping to get started</p>
                    </div>
                  )}
                  
                  <button 
                    onClick={goToTerminology}
                    className="bg-gradient-to-r from-blue-600 to-teal-600 text-white px-6 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-teal-700 transition-all duration-200 shadow-lg flex items-center justify-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span>Open Terminology Mapping</span>
                  </button>
                </div>
              )}

              {/* Prescription Tab - UPDATED WITH PDF GENERATION */}
              {activeTab === "prescription" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800 text-lg">Prescription Management</h3>
                    <div className="text-sm text-gray-600">
                      {diagnosedProblems.length} diagnosed problems • {prescriptionHistory.length} saved prescriptions
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <button
                      onClick={goToPrescription}
                      className="bg-green-600 hover:bg-green-700 text-white p-6 rounded-xl text-center transition-colors"
                    >
                      <div className="flex items-center justify-center space-x-3">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <div className="text-left">
                          <div className="font-bold text-lg">Create New Prescription</div>
                          <div className="text-green-100 text-sm">Use dedicated prescription form</div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab("problems")}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-xl text-center transition-colors"
                    >
                      <div className="flex items-center justify-center space-x-3">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-left">
                          <div className="font-bold text-lg">Manage Problems</div>
                          <div className="text-blue-100 text-sm">Add/remove diagnosed problems</div>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Quick Prescription from EMR with PDF Generation */}
                  {diagnosedProblems.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h4 className="font-semibold text-gray-800 mb-4">Quick Prescription (EMR) with PDF Generation</h4>
                      <p className="text-gray-600 mb-4">Create a prescription directly from diagnosed problems and generate PDF:</p>
                      
                      {/* Diagnosed Problems Preview */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <h5 className="font-semibold text-green-800 mb-2">Diagnosed Problems:</h5>
                        <div className="grid gap-2">
                          {diagnosedProblems.map((problem) => (
                            <div key={problem.id} className="bg-white p-2 rounded border text-sm">
                              <span className="font-semibold">{problem.display}</span>
                              <span className="text-gray-600 ml-2">({problem.ayushCode || problem.code})</span>
                              {problem.icdCode && (
                                <span className="text-green-600 ml-2">→ ICD: {problem.icdCode}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Medicine Input */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-semibold text-gray-700">Medicines</h5>
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
                        <div className="space-y-3">
                          {prescription.map((med, index) => (
                            <div key={index} className="grid md:grid-cols-4 gap-2 p-3 border border-gray-200 rounded-lg">
                              <input
                                type="text"
                                value={med.medicine}
                                onChange={(e) => updateMedicine(index, 'medicine', e.target.value)}
                                className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                placeholder="Medicine name"
                              />
                              <input
                                type="text"
                                value={med.dosage}
                                onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                                className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                placeholder="Dosage"
                              />
                              <input
                                type="text"
                                value={med.frequency}
                                onChange={(e) => updateMedicine(index, 'frequency', e.target.value)}
                                className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                placeholder="Frequency"
                              />
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={med.duration}
                                  onChange={(e) => updateMedicine(index, 'duration', e.target.value)}
                                  className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                  placeholder="Duration"
                                />
                                <button
                                  onClick={() => removeMedicine(index)}
                                  className="text-red-500 hover:text-red-700 p-2"
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

                      {/* Additional Information */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Doctor's Notes</label>
                          <textarea
                            value={doctorNotes}
                            onChange={(e) => setDoctorNotes(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-20"
                            placeholder="Additional instructions, precautions, or notes..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
                          <input
                            type="date"
                            value={followUpDate}
                            onChange={(e) => setFollowUpDate(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <button
                        onClick={generatePrescriptionFromEMR}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-medium transition-colors mt-4"
                      >
                        Generate PDF Prescription from Current Problems
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === "history" && (
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg mb-4">Medical History</h3>
                  
                  {prescriptionHistory.length > 0 ? (
                    <div className="space-y-4">
                      {prescriptionHistory.map((prescription) => (
                        <div key={prescription.id} className="bg-white border border-gray-200 rounded-lg p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="font-semibold text-gray-800">
                                Prescription #{prescription.id}
                                {prescription.source === "emr" && (
                                  <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">EMR</span>
                                )}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {new Date(prescription.date).toLocaleDateString()} • {prescription.medicines.length} medicines
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => viewPrescriptionDetails(prescription)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                View Details
                              </button>
                              <button
                                onClick={() => generatePDFForPrescription(prescription)}
                                className="text-green-600 hover:text-green-800 text-sm font-medium"
                              >
                                Generate PDF
                              </button>
                            </div>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <strong>Diagnosis:</strong>
                              <ul className="mt-1 space-y-1">
                                {prescription.problems && prescription.problems.map((problem, idx) => (
                                  <li key={idx} className="text-gray-600">
                                    • {problem.display} 
                                    <br/>
                                    <small className="text-blue-600">AYUSH: {problem.ayushCode || problem.code}</small>
                                    {problem.icdCode && (
                                      <small className="text-green-600 ml-2">ICD: {problem.icdCode}</small>
                                    )}
                                  </li>
                                ))}
                                {prescription.diseases && prescription.diseases.map((disease, idx) => (
                                  <li key={idx} className="text-gray-600">
                                    • {disease.display} 
                                    <br/>
                                    <small className="text-blue-600">AYUSH: {disease.ayushCode}</small>
                                    {disease.icdCode && (
                                      <small className="text-green-600 ml-2">ICD: {disease.icdCode}</small>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <strong>Medicines:</strong>
                              <ul className="mt-1 space-y-1">
                                {prescription.medicines.map((med, idx) => (
                                  <li key={idx} className="text-gray-600">• {med.medicine} - {med.dosage}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-6 text-center">
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="font-semibold text-gray-800 mb-2">No Prescription History</h3>
                      <p className="text-gray-600 mb-4">Create your first prescription to see it here</p>
                      
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}