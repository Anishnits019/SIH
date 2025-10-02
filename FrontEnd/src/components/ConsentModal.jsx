// src/components/ConsentModal.jsx
import React from 'react';

export default function ConsentModal({ patient, bundle, onConsent, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold text-gray-800 mb-4">🛡️ ABHA Consent Required</h3>
        <p className="text-gray-600 mb-4">
          Patient <strong>{patient.name}</strong> (ABHA: {patient.abha}) 
          must consent to share this medical data.
        </p>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800">
            <strong>Data to be shared:</strong><br/>
            • {bundle.entry.filter(e => e.resource.resourceType === 'Condition').length} Medical Conditions<br/>
            • {bundle.entry.filter(e => e.resource.resourceType === 'MedicationRequest').length} Medications<br/>
            • Patient Demographics
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">
            Cancel
          </button>
          <button onClick={onConsent} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg">
            ✅ Grant Consent
          </button>
        </div>
      </div>
    </div>
  );
}