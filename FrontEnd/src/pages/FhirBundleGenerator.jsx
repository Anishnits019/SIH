import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ConsentModal from "../components/ConsentModal";

export default function BundleGenerator() {
  const [generatedBundle, setGeneratedBundle] = useState(null);
  const [bundleType, setBundleType] = useState("collection");
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState("");
  const [showConsent, setShowConsent] = useState(false);
  const [currentBundle, setCurrentBundle] = useState(null);
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();
  const API = import.meta.env.VITE_API_URL;
  // ✅ FIXED: Generate Collection Bundle (READ-ONLY, no requests)

  const generateCollectionBundle = () => {
    const patientData = JSON.parse(localStorage.getItem("selectedPatient") || "null");
    const diagnosedProblems = JSON.parse(localStorage.getItem(`diagnosedProblems_${patientData?.abha}`) || "[]");
    const prescriptionHistory = JSON.parse(localStorage.getItem(`prescriptionHistory_${patientData?.abha}`) || "[]");
    const prescriptionDiseases = JSON.parse(localStorage.getItem('prescriptionDiseases') || "[]");
    
    // Get doctor info
    const token = localStorage.getItem("token");
    let doctorInfo = { name: "Dr. Sharma", id: "DOC001", qualification: "BAMS" };
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        doctorInfo = {
          name: payload.name || "Dr. Sharma",
          id: payload.sub || "DOC001",
          qualification: payload.qualification || "BAMS"
        };
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }

    if (!patientData) {
      alert("No patient data found. Please select a patient first.");
      return null;
    }

    // ✅ CORRECT: Collection Bundle (just resources, no requests)
    const bundle = {
      resourceType: "Bundle",
      id: `bundle-collection-${Date.now()}`, // ✅ collection ID
      type: "collection", // ✅ collection type
      timestamp: new Date().toISOString(),
      entry: []
    };

    // Add resources WITHOUT request objects
    // 1. Patient Resource
    bundle.entry.push({
      fullUrl: `Patient/${patientData.abha}`,
      resource: {
        resourceType: "Patient",
        id: patientData.abha,
        identifier: [{
          system: "https://abdm.gov.in/abha",
          value: patientData.abha
        }],
        name: [{
          use: "official",
          text: patientData.name
        }],
        gender: patientData.gender?.toLowerCase(),
        birthDate: calculateBirthDate(patientData.age)
      }
      // ✅ NO request object for collection
    });

    // 2. Practitioner Resource
    bundle.entry.push({
      fullUrl: `Practitioner/${doctorInfo.id}`,
      resource: {
        resourceType: "Practitioner",
        id: doctorInfo.id,
        name: [{
          use: "official",
          text: doctorInfo.name
        }],
        qualification: [{
          code: {
            text: doctorInfo.qualification
          }
        }]
      }
      // ✅ NO request object for collection
    });

    // 3. Condition Resources from diagnosed problems
    diagnosedProblems.forEach((problem, index) => {
      bundle.entry.push({
        fullUrl: `Condition/${problem.id}`,
        resource: {
          resourceType: "Condition",
          id: problem.id,
          clinicalStatus: {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: problem.status === "active" ? "active" : "inactive"
            }]
          },
          code: {
            coding: [
              {
                system: "http://namaste-ayush.codes",
                code: problem.ayushCode || problem.code,
                display: problem.ayushDisplay || problem.display
              },
              ...(problem.icdCode ? [{
                system: "http://hl7.org/fhir/sid/icd-11",
                code: problem.icdCode,
                display: problem.icdDisplay || ""
              }] : [])
            ]
          },
          subject: {
            reference: `Patient/${patientData.abha}`
          },
          recorder: {
            reference: `Practitioner/${doctorInfo.id}`
          },
          recordedDate: problem.date
        }
        // ✅ NO request object for collection
      });
    });

    // 4. Condition Resources from prescription diseases
    prescriptionDiseases.forEach((disease, index) => {
      bundle.entry.push({
        fullUrl: `Condition/${disease.id}`,
        resource: {
          resourceType: "Condition",
          id: disease.id,
          clinicalStatus: {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: "active"
            }]
          },
          code: {
            coding: [
              {
                system: "http://namaste-ayush.codes",
                code: disease.ayushCode,
                display: disease.display
              },
              ...(disease.icdCode ? [{
                system: "http://hl7.org/fhir/sid/icd-11",
                code: disease.icdCode,
                display: disease.icdDisplay || ""
              }] : [])
            ]
          },
          subject: {
            reference: `Patient/${patientData.abha}`
          },
          recorder: {
            reference: `Practitioner/${doctorInfo.id}`
          },
          recordedDate: disease.timestamp
        }
        // ✅ NO request object for collection
      });
    });

    // 5. Medication Resources from prescription history
    prescriptionHistory.forEach((prescription, prescriptionIndex) => {
      prescription.medicines?.forEach((med, medIndex) => {
        if (med.medicine && med.medicine.trim()) {
          bundle.entry.push({
            fullUrl: `MedicationRequest/${prescription.id}-med-${medIndex}`,
            resource: {
              resourceType: "MedicationRequest",
              id: `${prescription.id}-med-${medIndex}`,
              status: "active",
              intent: "order",
              medicationCodeableConcept: {
                text: med.medicine
              },
              subject: {
                reference: `Patient/${patientData.abha}`
              },
              requester: {
                reference: `Practitioner/${doctorInfo.id}`
              },
              dosageInstruction: [{
                text: `${med.dosage || ''} ${med.frequency || ''} ${med.duration || ''}`.trim(),
                timing: {
                  code: {
                    text: med.frequency
                  }
                }
              }],
              authoredOn: prescription.date
            }
            // ✅ NO request object for collection
          });
        }
      });
    });

    return bundle;
  };

  // ✅ FIXED: Generate Transaction Bundle (with request objects)
  const generateTransactionBundle = () => {
    const patientData = JSON.parse(localStorage.getItem("selectedPatient") || "null");
    const diagnosedProblems = JSON.parse(localStorage.getItem(`diagnosedProblems_${patientData?.abha}`) || "[]");
    const prescriptionHistory = JSON.parse(localStorage.getItem(`prescriptionHistory_${patientData?.abha}`) || "[]");
    const prescriptionDiseases = JSON.parse(localStorage.getItem('prescriptionDiseases') || "[]");
    
    // Get doctor info
    const token = localStorage.getItem("token");
    let doctorInfo = { name: "Dr. Sharma", id: "DOC001", qualification: "BAMS" };
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        doctorInfo = {
          name: payload.name || "Dr. Sharma",
          id: payload.sub || "DOC001",
          qualification: payload.qualification || "BAMS"
        };
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }

    if (!patientData) {
      alert("No patient data found. Please select a patient first.");
      return null;
    }

    // ✅ CORRECT: Transaction Bundle (with request objects)
    const bundle = {
      resourceType: "Bundle",
      id: `bundle-transaction-${Date.now()}`, // ✅ transaction ID
      type: "transaction", // ✅ transaction type
      timestamp: new Date().toISOString(),
      entry: []
    };

    // Add resources WITH request objects
    // 1. Patient Resource
    bundle.entry.push({
      fullUrl: `Patient/${patientData.abha}`,
      resource: {
        resourceType: "Patient",
        id: patientData.abha,
        identifier: [{
          system: "https://abdm.gov.in/abha",
          value: patientData.abha
        }],
        name: [{
          use: "official",
          text: patientData.name
        }],
        gender: patientData.gender?.toLowerCase(),
        birthDate: calculateBirthDate(patientData.age)
      },
      request: {
        method: "PUT", // ✅ Request object for transaction
        url: `Patient/${patientData.abha}`
      }
    });

    // 2. Practitioner Resource
    bundle.entry.push({
      fullUrl: `Practitioner/${doctorInfo.id}`,
      resource: {
        resourceType: "Practitioner",
        id: doctorInfo.id,
        name: [{
          use: "official",
          text: doctorInfo.name
        }],
        qualification: [{
          code: {
            text: doctorInfo.qualification
          }
        }]
      },
      request: {
        method: "PUT", // ✅ Request object for transaction
        url: `Practitioner/${doctorInfo.id}`
      }
    });

    // 3. Condition Resources from diagnosed problems
    diagnosedProblems.forEach((problem, index) => {
      bundle.entry.push({
        fullUrl: `Condition/${problem.id}`,
        resource: {
          resourceType: "Condition",
          id: problem.id,
          clinicalStatus: {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: problem.status === "active" ? "active" : "inactive"
            }]
          },
          code: {
            coding: [
              {
                system: "http://namaste-ayush.codes",
                code: problem.ayushCode || problem.code,
                display: problem.ayushDisplay || problem.display
              },
              ...(problem.icdCode ? [{
                system: "http://hl7.org/fhir/sid/icd-11",
                code: problem.icdCode,
                display: problem.icdDisplay || ""
              }] : [])
            ]
          },
          subject: {
            reference: `Patient/${patientData.abha}`
          },
          recorder: {
            reference: `Practitioner/${doctorInfo.id}`
          },
          recordedDate: problem.date
        },
        request: {
          method: "PUT", // ✅ Request object for transaction
          url: `Condition/${problem.id}`
        }
      });
    });

    // 4. Condition Resources from prescription diseases
    prescriptionDiseases.forEach((disease, index) => {
      bundle.entry.push({
        fullUrl: `Condition/${disease.id}`,
        resource: {
          resourceType: "Condition",
          id: disease.id,
          clinicalStatus: {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: "active"
            }]
          },
          code: {
            coding: [
              {
                system: "http://namaste-ayush.codes",
                code: disease.ayushCode,
                display: disease.display
              },
              ...(disease.icdCode ? [{
                system: "http://hl7.org/fhir/sid/icd-11",
                code: disease.icdCode,
                display: disease.icdDisplay || ""
              }] : [])
            ]
          },
          subject: {
            reference: `Patient/${patientData.abha}`
          },
          recorder: {
            reference: `Practitioner/${doctorInfo.id}`
          },
          recordedDate: disease.timestamp
        },
        request: {
          method: "PUT", // ✅ Request object for transaction
          url: `Condition/${disease.id}`
        }
      });
    });

    // 5. Medication Resources from prescription history
    prescriptionHistory.forEach((prescription, prescriptionIndex) => {
      prescription.medicines?.forEach((med, medIndex) => {
        if (med.medicine && med.medicine.trim()) {
          bundle.entry.push({
            fullUrl: `MedicationRequest/${prescription.id}-med-${medIndex}`,
            resource: {
              resourceType: "MedicationRequest",
              id: `${prescription.id}-med-${medIndex}`,
              status: "active",
              intent: "order",
              medicationCodeableConcept: {
                text: med.medicine
              },
              subject: {
                reference: `Patient/${patientData.abha}`
              },
              requester: {
                reference: `Practitioner/${doctorInfo.id}`
              },
              dosageInstruction: [{
                text: `${med.dosage || ''} ${med.frequency || ''} ${med.duration || ''}`.trim(),
                timing: {
                  code: {
                    text: med.frequency
                  }
                }
              }],
              authoredOn: prescription.date
            },
            request: {
              method: "PUT", // ✅ Request object for transaction
              url: `MedicationRequest/${prescription.id}-med-${medIndex}`
            }
          });
        }
      });
    });

    return bundle;
  };

  const calculateBirthDate = (age) => {
    const birthYear = new Date().getFullYear() - parseInt(age);
    return `${birthYear}-01-01`;
  };

  const handleGenerateBundle = () => {
    setLoading(true);
    setCopySuccess("");
    
    setTimeout(() => {
      let bundle;
      if (bundleType === "collection") {
        bundle = generateCollectionBundle();
      } else {
        bundle = generateTransactionBundle();
      }
      
      setGeneratedBundle(bundle);
      setLoading(false);
    }, 500);
  };

  const copyToClipboard = () => {
    if (generatedBundle) {
      navigator.clipboard.writeText(JSON.stringify(generatedBundle, null, 2));
      setCopySuccess("✅ Bundle copied to clipboard!");
      setTimeout(() => setCopySuccess(""), 3000);
    }
  };

  const downloadBundle = () => {
    if (generatedBundle) {
      const blob = new Blob([JSON.stringify(generatedBundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fhir-${bundleType}-bundle-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getPatientInfo = () => {
    const patient = JSON.parse(localStorage.getItem("selectedPatient") || "null");
    return patient;
  };

  // Mock ABHA Token Generator
  const generateMockABHAToken = (patientAbha, doctorInfo) => {
    return {
      token: `mock_abha_${Date.now()}`,
      patientAbha: patientAbha,
      doctorId: doctorInfo.id,
      scope: 'medical_records:read write',
      expiresIn: 3600,
      timestamp: new Date().toISOString()
    };
  };

  const sendToABDMGateway = async (bundle, abhaToken) => {
    setSending(true);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const response = {
          success: true,
          message: "✅ Bundle successfully sent to ABDM Gateway",
          bundleId: bundle.id,
          timestamp: new Date().toISOString(),
          abdmTransactionId: `ABDM_TX_${Date.now()}`
        };
        
        setSending(false);
        resolve(response);
      }, 2000);
    });
  };

  const logAuditTrail = (bundle, abhaToken, abdmResponse) => {
    const auditLog = {
      timestamp: new Date().toISOString(),
      bundleId: bundle.id,
      patientAbha: abhaToken.patientAbha,
      doctorId: abhaToken.doctorId,
      resourcesSent: bundle.entry.length,
      abdmTransactionId: abdmResponse.abdmTransactionId,
      consentGranted: true,
      oauthToken: abhaToken.token
    };

    // Save to localStorage
    const existingLogs = JSON.parse(localStorage.getItem('abdmAuditLogs') || '[]');
    localStorage.setItem('abdmAuditLogs', JSON.stringify([auditLog, ...existingLogs]));
  };

  const handleSendToABDM = async (bundle) => {
    // Only allow Transaction bundles to be sent
    if (bundle.type !== "transaction") {
      alert("❌ Only Transaction bundles can be sent to ABDM Gateway");
      return;
    }
    
    setCurrentBundle(bundle);
    setShowConsent(true);
  };

  const handleConsentGranted = async () => {
    if (!currentBundle || !patient) return;
    
    // 1. Generate mock ABHA token
    const token = localStorage.getItem("token");
    let doctorInfo = { name: "Dr. Sharma", id: "DOC001" };
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        doctorInfo = { name: payload.name, id: payload.sub };
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }
    
    const abhaToken = generateMockABHAToken(patient.abha, doctorInfo);
    
    // 2. Send to ABDM
    const abdmResponse = await sendToABDMGateway(currentBundle, abhaToken);
    
    // 3. Log audit trail
    logAuditTrail(currentBundle, abhaToken, abdmResponse);
    
    // 4. Show success
    alert(`✅ ${abdmResponse.message}\nTransaction ID: ${abdmResponse.abdmTransactionId}`);
    
    setShowConsent(false);
    setCurrentBundle(null);
  };

  const patient = getPatientInfo();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">FHIR Bundle Generator</h1>
            <p className="text-gray-600">Generate Collection & Transaction Bundles from Medical Data</p>
          </div>
          <button 
            onClick={() => navigate("/dashboard")}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Controls Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
            <h3 className="font-semibold text-gray-800 text-lg mb-4">Generate Bundle</h3>
            
            {/* Patient Info */}
            {patient ? (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">Current Patient</h4>
                <p className="text-blue-900 font-medium">{patient.name}</p>
                <p className="text-blue-700 text-sm">ABHA: {patient.abha}</p>
                <p className="text-blue-700 text-sm">{patient.age} years • {patient.gender}</p>
              </div>
            ) : (
              <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">No Patient Selected</h4>
                <p className="text-yellow-700 text-sm">Please select a patient first</p>
              </div>
            )}

            {/* Bundle Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Bundle Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setBundleType("collection")}
                  className={`p-3 rounded-lg border font-medium text-center transition-colors ${
                    bundleType === "collection" 
                      ? "bg-blue-600 text-white border-blue-600" 
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Collection
                </button>
                <button
                  onClick={() => setBundleType("transaction")}
                  className={`p-3 rounded-lg border font-medium text-center transition-colors ${
                    bundleType === "transaction" 
                      ? "bg-green-600 text-white border-green-600" 
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Transaction
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {bundleType === "collection" 
                  ? "Read-only bundle for data storage" 
                  : "Transaction bundle for FHIR server updates"}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateBundle}
              disabled={loading || !patient}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                loading || !patient
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </div>
              ) : (
                `Generate ${bundleType === "collection" ? "Collection" : "Transaction"} Bundle`
              )}
            </button>

            {/* Data Sources Info */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-2">Data Sources</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Patient Demographics</li>
                <li>• Doctor Information</li>
                <li>• Diagnosed Problems</li>
                <li>• Prescription Data</li>
                <li>• Terminology Mappings</li>
              </ul>
            </div>
          </div>
        </div>

        {/* JSON Display Panel */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Panel Header */}
            <div className="border-b border-gray-200 p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {bundleType === "collection" ? "Collection Bundle" : "Transaction Bundle"}
                  </h2>
                  <p className="text-gray-600">
                    {bundleType === "collection" 
                      ? "Complete medical record for storage and archival" 
                      : "FHIR server transaction for updates"}
                  </p>
                </div>
                
                {generatedBundle && (
                  <div className="flex gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy JSON
                    </button>
                    <button
                      onClick={downloadBundle}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download
                    </button>
                  </div>
                )}
              </div>

              {/* Copy Success Message */}
              {copySuccess && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-700 font-medium">{copySuccess}</p>
                </div>
              )}
            </div>

            {/* JSON Display */}
            <div className="p-6">
              {!generatedBundle ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Bundle Generated</h3>
                  <p className="text-gray-600 mb-4">
                    Click "Generate Bundle" to create a FHIR {bundleType} bundle from your medical data
                  </p>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                  <div className="bg-gray-800 px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-white font-mono text-sm">
                        FHIR {bundleType.charAt(0).toUpperCase() + bundleType.slice(1)} Bundle
                      </span>
                    </div>
                    <div className="text-gray-300 text-sm">
                      {generatedBundle.entry.length} resources • {new Date(generatedBundle.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <pre className="p-6 text-green-400 text-sm overflow-x-auto font-mono whitespace-pre-wrap max-h-[70vh]">
                    {JSON.stringify(generatedBundle, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Bundle Info & ABDM Send Button */}
          {generatedBundle && (
            <div className="mt-6">
              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">{generatedBundle.entry.length}</div>
                  <div className="text-sm text-blue-800">Total Resources</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-2xl font-bold text-green-600">
                    {generatedBundle.entry.filter(e => e.resource.resourceType === 'Condition').length}
                  </div>
                  <div className="text-sm text-green-800">Conditions</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="text-2xl font-bold text-purple-600">
                    {generatedBundle.entry.filter(e => e.resource.resourceType === 'MedicationRequest').length}
                  </div>
                  <div className="text-sm text-purple-800">Medications</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <div className="text-2xl font-bold text-orange-600">
                    {generatedBundle.entry.filter(e => e.resource.resourceType === 'Patient').length + 
                     generatedBundle.entry.filter(e => e.resource.resourceType === 'Practitioner').length}
                  </div>
                  <div className="text-sm text-orange-800">People</div>
                </div>
              </div>

              {/* ABDM Send Button */}
              {generatedBundle && bundleType === "transaction" && (
                <div className="p-6 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl border border-green-200">
                  <h3 className="font-semibold text-green-800 text-lg mb-3">🚀 Ready to Send to ABDM</h3>
                  <p className="text-green-700 text-sm mb-4">
                    This transaction bundle contains {generatedBundle.entry.length} resources ready for ABDM Gateway.
                  </p>
                  <button
                    onClick={() => handleSendToABDM(generatedBundle)}
                    disabled={sending}
                    className={`bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center ${
                      sending ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {sending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending to ABDM...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send to ABDM Gateway
                      </>
                    )}
                  </button>
                </div>
              )}

              {generatedBundle && bundleType === "collection" && (
                <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <h3 className="font-semibold text-blue-800 text-lg mb-3">💾 Collection Bundle Ready</h3>
                  <p className="text-blue-700 text-sm">
                    This is a read-only collection bundle for storage. Switch to "Transaction" to send to ABDM.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Consent Modal */}
      {showConsent && (
        <ConsentModal
          patient={patient}
          bundle={currentBundle}
          onConsent={handleConsentGranted}
          onCancel={() => setShowConsent(false)}
        />
      )}
    </div>
  );
}