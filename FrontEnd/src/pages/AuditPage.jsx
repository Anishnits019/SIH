import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuditPage() {
  const [auditLogs, setAuditLogs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const logs = JSON.parse(localStorage.getItem('abdmAuditLogs') || '[]');
    setAuditLogs(logs);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📋 ABDM Audit Trail</h1>
            <p className="text-gray-600">Compliance logs and transaction history</p>
          </div>
          <button 
            onClick={() => navigate("/dashboard")}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {auditLogs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Audit Logs Yet</h3>
            <p className="text-gray-600">Send bundles to ABDM to see transaction history</p>
          </div>
        ) : (
          <div className="space-y-4">
            {auditLogs.map((log, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div><strong>Timestamp:</strong> {new Date(log.timestamp).toLocaleString()}</div>
                  <div><strong>Patient ABHA:</strong> {log.patientAbha}</div>
                  <div><strong>Bundle ID:</strong> {log.bundleId}</div>
                  <div><strong>ABDM TX ID:</strong> {log.abdmTransactionId}</div>
                  <div><strong>Resources:</strong> {log.resourcesSent}</div>
                  <div><strong>Consent:</strong> <span className="text-green-600">✅ Granted</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}