import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function TerminologyPage({
  system = "",
  apiBase,
  excludeSystems = ["siddha"],
  icdOnly = true
}) {
  const navigate = useNavigate();
  const API_BASE = useMemo(
    () => apiBase || import.meta.env.VITE_API_URL,
    [apiBase]
);

  // UI state
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [mode, setMode] = useState("results");

  // Search + results
  const [q, setQ] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestErr, setSuggestErr] = useState("");
  const [systems, setSystems] = useState([]);

  // Filtering/probing state
  const [filteringICD, setFilteringICD] = useState(false);
  const [filterNote, setFilterNote] = useState("");

  // Selection + mapping
  const [selectedCS, setSelectedCS] = useState(null);
  const [selectedCode, setSelectedCode] = useState("");
  const [mapLoading, setMapLoading] = useState(false);
  const [mapErr, setMapErr] = useState("");
  const [conceptMap, setConceptMap] = useState(null);

  // JSON toggles
  const [showCMJson, setShowCMJson] = useState(false);
  const [showCSJson, setShowCSJson] = useState(false);

  // Cache: hasMapping[`${sysId}|${code}`] => true/false
  const [hasMapping, setHasMapping] = useState({});

  // Bundle UX state
  const [patGiven, setPatGiven] = useState("");
  const [patFamily, setPatFamily] = useState("");
  const [collectionBundle, setCollectionBundle] = useState(null);
  const [transactionBundle, setTransactionBundle] = useState(null);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [collectionErr, setCollectionErr] = useState("");
  const [transactionErr, setTransactionErr] = useState("");

  // FHIR BUNDLE STATE
  const [fhirBundle, setFhirBundle] = useState(null);
  const [fhirBundleLoading, setFhirBundleLoading] = useState(false);
  const [fhirBundleError, setFhirBundleError] = useState("");

  // Selected codes to return to EMR
  const [selectedCodes, setSelectedCodes] = useState([]);

  // Copy feedback state
  const [copyFeedback, setCopyFeedback] = useState("");

  // NEW STATES FOR DISEASE SELECTION
  const [selectedDiseases, setSelectedDiseases] = useState([]);
  const [addNotification, setAddNotification] = useState("");
  const [doctorInfo] = useState({
    name: "Dr. Rajesh Sharma",
    id: "DOC001",
    qualification: "BAMS, MD"
  });

  // helpers
  const toArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  const sysShort = (csId) => (csId || "").replace(/^namaste-/, "");

  const mappingRows = (cm) => {
    const rows = [];
    for (const g of toArray(cm?.group)) {
      for (const el of toArray(g?.element)) {
        for (const t of toArray(el?.target)) {
          rows.push({
            srcCode: el?.code || "",
            srcDisp: el?.display || "",
            tgtCode: t?.code || "",
            tgtDisp: t?.display || "",
            eq: t?.equivalence || t?.relationship || "-",
          });
        }
      }
    }
    return rows;
  };

  // find display for selected code in the current CS
  const displayForSelected = () => {
    if (!selectedCS || !selectedCode) return selectedCode;
    const pool = icdOnly ? (selectedCS._icdConcepts ?? []) : toArray(selectedCS.concept);
    return (pool.find((c) => c.code === selectedCode)?.display) || selectedCode;
  };

  // Get current concept with TM2/MMS codes
  const getCurrentConcept = () => {
    if (!selectedCS || !selectedCode) return null;
    const pool = icdOnly ? (selectedCS._icdConcepts ?? []) : toArray(selectedCS.concept);
    return pool.find((c) => c.code === selectedCode);
  };

  // Copy to clipboard with feedback
  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(`${type} copied!`);
    setTimeout(() => setCopyFeedback(""), 2000);
  };

  // NEW FUNCTIONS FOR DISEASE SELECTION
  const addDiseaseToPrescription = (disease) => {
    const diseaseData = {
      ...disease,
      id: `${disease.ayushCode}-${disease.icdCode}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      doctor: doctorInfo.name,
      doctorId: doctorInfo.id,
      status: "added"
    };

    setSelectedDiseases(prev => {
      const exists = prev.find(d => 
        d.ayushCode === disease.ayushCode && d.icdCode === disease.icdCode
      );
      if (exists) return prev;
      return [...prev, diseaseData];
    });

    // Show notification
    setAddNotification(`✅ ${disease.display} added to prescription!`);
    setTimeout(() => setAddNotification(""), 3000);

    // Save to localStorage for prescription page
    const currentPrescription = JSON.parse(localStorage.getItem('prescriptionDiseases') || '[]');
    const updatedPrescription = [...currentPrescription.filter(d => 
      !(d.ayushCode === disease.ayushCode && d.icdCode === disease.icdCode)
    ), diseaseData];
    localStorage.setItem('prescriptionDiseases', JSON.stringify(updatedPrescription));
  };

  const removeDiseaseFromPrescription = (diseaseId) => {
    setSelectedDiseases(prev => prev.filter(d => d.id !== diseaseId));
    
    // Update localStorage
    const currentPrescription = JSON.parse(localStorage.getItem('prescriptionDiseases') || '[]');
    const updatedPrescription = currentPrescription.filter(d => d.id !== diseaseId);
    localStorage.setItem('prescriptionDiseases', JSON.stringify(updatedPrescription));
  };

  const goToPrescription = () => {
    navigate("/prescription");
  };

  // Load selected diseases on component mount
  useEffect(() => {
    const savedDiseases = JSON.parse(localStorage.getItem('prescriptionDiseases') || '[]');
    setSelectedDiseases(savedDiseases);
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(fetchSuggestions, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, system]);

  async function fetchSuggestions() {
    const text = q.trim();
    setSuggestErr("");
    setFilterNote("");
    if (!text) {
      setSystems([]);
      setMode("results");
      setSelectedCS(null);
      setConceptMap(null);
      return;
    }

    setSuggestLoading(true);
    try {
      const params = new URLSearchParams({ q: text });
      if (system) params.append("system", system);
      const res = await fetch(`${API_BASE}/api/suggest?${params}`);
      const bundle = await res.json();

      const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];

      // Merge by CodeSystem id
      const csMap = new Map();
      for (const e of entries) {
        const cs = e?.resource;
        if (!cs || cs.resourceType !== "CodeSystem") continue;
        const id = cs.id || cs.url;
        if (!id) continue;

        // Exclude by system id substring (e.g., "siddha")
        if (excludeSystems.some((s) => id?.toLowerCase().includes(s.toLowerCase()))) continue;

        if (!csMap.has(id)) {
          csMap.set(id, { ...cs, concept: [...toArray(cs.concept)] });
        } else {
          const existing = csMap.get(id);
          const seen = new Set(existing.concept.map((c) => c?.code));
          for (const c of toArray(cs.concept)) {
            if (c?.code && !seen.has(c.code)) {
              existing.concept.push(c);
              seen.add(c.code);
            }
          }
          ["title", "version", "publisher", "status", "name", "url"].forEach((k) => {
            if (!existing[k] && cs[k]) existing[k] = cs[k];
          });
        }
      }

      let list = [...csMap.values()];

      // If ICD-only mode, probe map availability and keep only mappable concepts
      if (icdOnly) {
        setFilteringICD(true);
        setFilterNote("Filtering to ICD-mapped codes…");
        list = await filterCodeSystemsByICD(list);
      }

      setSystems(list);
      setMode("results");
      setSelectedCS(null);
      setConceptMap(null);
    } catch (e) {
      setSuggestErr(String(e?.message || e));
      setSystems([]);
    } finally {
      setSuggestLoading(false);
      setFilteringICD(false);
      setFilterNote("");
    }
  }

  // Probe mapping per concept (cap per system to avoid too many calls)
  async function filterCodeSystemsByICD(csList) {
    const MAX_CONCEPTS_TO_CHECK = 24;
    const updated = [];
    const cache = { ...hasMapping };

    for (const cs of csList) {
      const id = cs.id || "";
      const sShort = sysShort(id);
      const concepts = toArray(cs.concept).slice(0, MAX_CONCEPTS_TO_CHECK);

      const okConcepts = [];
      for (const c of concepts) {
        const key = `${id}|${c.code}`;
        if (cache[key] === true) {
          okConcepts.push(c);
          continue;
        }
        if (cache[key] === false) {
          continue;
        }

        try {
          const url = `${API_BASE}/api/suggest/map?system=${encodeURIComponent(
            sShort
          )}&code=${encodeURIComponent(c.code)}`;
          const res = await fetch(url);
          const data = await res.json();

          const hasTargets =
            res.ok &&
            data?.resourceType === "ConceptMap" &&
            toArray(data.group).some((g) =>
              toArray(g.element).some((el) => toArray(el.target).length > 0)
            );

          cache[key] = !!hasTargets;
          if (hasTargets) okConcepts.push(c);
        } catch {
          cache[key] = false;
        }
      }

      if (okConcepts.length > 0) {
        updated.push({ ...cs, _icdConcepts: okConcepts });
      }
    }

    setHasMapping(cache);
    return updated;
  }

  function openDetails(cs) {
    setSelectedCS(cs);
    setMode("details");
    setSelectedCode("");
    setConceptMap(null);
    setMapErr("");
    setShowCMJson(false);
    setShowCSJson(false);

    if (icdOnly && !cs._icdConcepts) {
      (async () => {
        setFilteringICD(true);
        const filtered = await filterCodeSystemsByICD([cs]);
        setFilteringICD(false);
        if (filtered.length) {
          setSelectedCS(filtered[0]);
        }
      })();
    }

    // reset bundle panel
    setPatGiven(""); setPatFamily("");
    setCollectionBundle(null); setTransactionBundle(null);
    setCollectionErr(""); setTransactionErr("");
    setFhirBundle(null); setFhirBundleError("");
  }

  function backToResults() {
    setMode("results");
    setSelectedCS(null);
    setConceptMap(null);
    setMapErr("");
    setShowCMJson(false);
    setShowCSJson(false);
    setPatGiven(""); setPatFamily("");
    setCollectionBundle(null); setTransactionBundle(null);
    setCollectionErr(""); setTransactionErr("");
    setFhirBundle(null); setFhirBundleError("");
  }

  // Add code to selection for EMR
  const addCodeToSelection = (code, display, system) => {
    const newCode = { code, display, system, timestamp: new Date().toISOString() };
    setSelectedCodes(prev => [...prev.filter(c => c.code !== code), newCode]);
  };

  // Remove code from selection
  const removeCodeFromSelection = (code) => {
    setSelectedCodes(prev => prev.filter(c => c.code !== code));
  };

  // Apply selected codes and return to EMR
  const applyAndReturn = () => {
    navigate(-1);
  };

  async function handleTranslate(code) {
    if (!selectedCS || !code) return;
    setSelectedCode(code);
    setMapErr("");
    setConceptMap(null);
    setShowCMJson(false);
    setShowCSJson(false);
    setMapLoading(true);

    try {
      const sShort = sysShort(selectedCS.id || "");
      const url = `${API_BASE}/api/suggest/map?system=${encodeURIComponent(sShort)}&code=${encodeURIComponent(code)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || data?.resourceType === "OperationOutcome") {
        const msg = data?.issue?.[0]?.details?.text || `Mapping fetch failed (HTTP ${res.status})`;
        throw new Error(msg);
      }
      setConceptMap(data);
      
      // Auto-add to selection when mapping is loaded
      const currentConcept = getCurrentConcept();
      if (currentConcept) {
        addCodeToSelection(currentConcept.code, currentConcept.display, sShort);
      }
      
    } catch (e) {
      setMapErr(String(e?.message || e));
      setConceptMap(null);
    } finally {
      setMapLoading(false);
    }
  }

  const showEmptyState =
    !q.trim() && !selectedCS && systems.length === 0 && !suggestLoading && !suggestErr;

  const exampleChips = [ "kasa", "jwara", "udara", "pitta", "Kann Thinai"];

  const displayConcepts = (cs) =>
    icdOnly ? (cs._icdConcepts ?? []) : toArray(cs.concept);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50">
      {/* Enhanced Header */}

      {addNotification && (
  <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
    <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg font-semibold flex items-center gap-2">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {addNotification}
    </div>
  </div>
)}

      <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-lg relative z-40">
  <div className="max-w-7xl mx-auto px-6 py-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="w-12 h-12 bg-gradient-to-r from-blue-600 to-teal-500 rounded-xl flex items-center justify-center text-white hover:from-blue-700 hover:to-teal-600 transition-all duration-200 shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex items-center space-x-3">
          <div className="w-14 h-14 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">AYUSH Terminology Mapping</h1>
            <p className="text-gray-600">NAMASTE → ICD-11 Mapping for EMR Integration</p>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Copy Feedback - Keep this in header */}
        {copyFeedback && (
          <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg font-semibold">
            {copyFeedback}
          </div>
        )}
        
        {/* Selected Diseases Badge */}
        {selectedDiseases.length > 0 && (
          <button
            onClick={goToPrescription}
            className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Go to Prescription ({selectedDiseases.length})</span>
          </button>
        )}
        
        {/* Selected Codes Badge */}
        {selectedCodes.length > 0 && (
          <div className="bg-green-100 text-green-800 px-3 py-2 rounded-lg font-semibold">
            {selectedCodes.length} code(s) selected
          </div>
        )}
      </div>
    </div>
  </div>
</div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* LEFT PANEL - Search & CodeSystems */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              {/* Panel Header */}
              <div className="bg-gradient-to-r from-blue-600 to-teal-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white">
                    {mode === "results" ? "AYUSH Code Search" : "CodeSystem Details"}
                  </h2>
                  {mode === "details" && (
                    <button 
                      onClick={backToResults}
                      className="text-white/90 hover:text-white text-sm font-medium flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      <span>Back</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Panel Content */}
              <div className="p-6">
                {mode === "results" && (
                  <>
                    {/* Search Section */}
                    <div className="space-y-4">
                      <div className="flex space-x-3">
                        <input
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder="Search AYUSH terms..."
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200"
                        />
                      </div>

                      {(suggestLoading || filteringICD) && (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <span className="ml-2 text-gray-600">
                            {suggestLoading ? "Searching..." : filterNote || "Filtering..."}
                          </span>
                        </div>
                      )}

                      {suggestErr && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                          {suggestErr}
                        </div>
                      )}
                    </div>

                    {/* Example Chips */}
                    {showEmptyState && (
                      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-teal-50 rounded-xl border border-blue-200">
                        <h3 className="font-semibold text-gray-800 mb-3">Quick Search Examples</h3>
                        <div className="flex flex-wrap gap-2">
                          {exampleChips.map((ex) => (
                            <button
                              key={ex}
                              onClick={() => setQ(ex)}
                              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-blue-300 transition-colors"
                            >
                              {ex}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Results */}
                    {systems.length > 0 && (
                      <div className="mt-6 space-y-4">
                        {systems.map((cs) => (
                          <div
                            key={cs.id}
                            onClick={() => openDetails(cs)}
                            className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all duration-200"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-800 text-lg mb-1">{cs.title}</h3>
                                <p className="text-gray-600 text-sm">
                                  {cs.publisher} • v{cs.version}
                                </p>
                              </div>
                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                                CodeSystem
                              </span>
                            </div>

                            {displayConcepts(cs).length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {displayConcepts(cs).slice(0, 6).map((c) => (
                                  <span 
                                    key={c.code}
                                    className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-lg border"
                                    title={`${c.code} — ${c.display}`}
                                  >
                                    <span className="font-semibold">{c.code}</span>
                                    <span className="mx-1">·</span>
                                    <span className="truncate">{c.display}</span>
                                  </span>
                                ))}
                                {displayConcepts(cs).length > 6 && (
                                  <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-lg">
                                    +{displayConcepts(cs).length - 6} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No Results */}
                    {!suggestLoading && !filteringICD && q.trim() && systems.length === 0 && (
                      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-center">
                        No results with ICD mappings found.
                      </div>
                    )}
                  </>
                )}

                {mode === "details" && selectedCS && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-teal-50 rounded-xl p-4 border border-blue-200">
                      <h3 className="font-bold text-gray-800 text-lg mb-2">{selectedCS.title}</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div><strong>Publisher:</strong> {selectedCS.publisher}</div>
                        <div><strong>Version:</strong> {selectedCS.version}</div>
                        <div><strong>Status:</strong> {selectedCS.status || "Active"}</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">
                        Concepts {icdOnly && <span className="text-blue-600 text-sm">(ICD-mapped only)</span>}
                      </h4>
                      
                      {displayConcepts(selectedCS).length > 0 ? (
                        <div className="space-y-2">
                          {displayConcepts(selectedCS).map((c) => (
                            <div
                              key={c.code}
                              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-800">{c.code}</div>
                                <div className="text-sm text-gray-600 truncate">{c.display}</div>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleTranslate(c.code); }}
                                disabled={mapLoading && selectedCode === c.code}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {mapLoading && selectedCode === c.code ? (
                                  <div className="flex items-center space-x-1">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                    <span>Mapping...</span>
                                  </div>
                                ) : (
                                  "Translate"
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                          No ICD-mapped concepts available.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL - Mapping & Results */}
          <div className="lg:col-span-3 space-y-6">
            {/* ADDED DISEASES PANEL */}
            {selectedDiseases.length > 0 && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 text-lg flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Added to Prescription ({selectedDiseases.length})
                  </h3>
                  <button
                    onClick={goToPrescription}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
                  >
                    Go to Prescription
                  </button>
                </div>
                <div className="grid gap-3">
                  {selectedDiseases.map((disease) => (
                    <div key={disease.id} className="bg-white border border-green-200 rounded-xl p-4">
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
                          <div className="text-sm text-gray-600">
                            Added by {disease.doctor} • {new Date(disease.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => removeDiseaseFromPrescription(disease.id)}
                          className="text-red-500 hover:text-red-700 p-2 rounded-lg transition-colors ml-4"
                          title="Remove from prescription"
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
            )}

            {/* Selected Codes Panel */}
            {selectedCodes.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-200 rounded-2xl p-6 shadow-lg">
                <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Selected Codes for EMR ({selectedCodes.length})
                </h3>
                <div className="flex flex-wrap gap-3">
                  {selectedCodes.map((code) => (
                    <div key={code.code} className="bg-white border border-blue-200 rounded-xl p-3 flex items-center space-x-3">
                      <div>
                        <div className="font-semibold text-gray-800">{code.code}</div>
                        <div className="text-sm text-gray-600">{code.display}</div>
                        <div className="text-xs text-gray-500">{code.system}</div>
                      </div>
                      <button
                        onClick={() => removeCodeFromSelection(code.code)}
                        className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                        title="Remove from selection"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Mapping Panel */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">AYUSH → ICD Mapping</h2>
                  <p className="text-gray-600">Real-time terminology mapping for EMR integration</p>
                </div>
                <div className="flex items-center space-x-2">
                  {mapLoading && (
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      Loading...
                    </span>
                  )}
                  {mapErr && (
                    <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                      {mapErr}
                    </span>
                  )}
                </div>
              </div>

              {conceptMap ? (
                <div className="space-y-6">
                  {/* ConceptMap Info */}
                  <div className="bg-gradient-to-r from-blue-50 to-teal-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-800">ConceptMap Details</h3>
                        <div className="text-sm text-gray-600 space-y-1 mt-1">
                          <div><strong>Title:</strong> {conceptMap.title || conceptMap.name || conceptMap.id}</div>
                          <div><strong>Version:</strong> {conceptMap.version || "—"}</div>
                          <div><strong>Mapping Groups:</strong> {toArray(conceptMap.group).length}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mapping Table with Add Buttons */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-800">Mapping Results</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                              AYUSH Code
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                              ICD Code
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                              Relationship
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {mappingRows(conceptMap).map((r, i) => {
                            const isAdded = selectedDiseases.some(d => 
                              d.ayushCode === r.srcCode && d.icdCode === r.tgtCode
                            );
                            
                            return (
                              <tr key={i} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-semibold text-gray-800">{r.srcCode}</div>
                                  <div className="text-sm text-gray-600">{r.srcDisp}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-semibold text-gray-800">{r.tgtCode}</div>
                                  <div className="text-sm text-gray-600">{r.tgtDisp}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    {r.eq}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  {isAdded ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      ✅ Added
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => addDiseaseToPrescription({
                                        display: r.srcDisp,
                                        ayushCode: r.srcCode,
                                        icdCode: r.tgtCode,
                                        icdDisplay: r.tgtDisp,
                                        relationship: r.eq
                                      })}
                                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                                    >
                                      Add to Prescription
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* JSON Toggles */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    <button
                      onClick={() => setShowCMJson(v => !v)}
                      className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showCMJson ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                      </svg>
                      {showCMJson ? "Hide ConceptMap JSON" : "Show ConceptMap JSON"}
                    </button>
                    {selectedCS && (
                      <button
                        onClick={() => setShowCSJson(v => !v)}
                        className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showCSJson ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                        </svg>
                        {showCSJson ? "Hide CodeSystem JSON" : "Show CodeSystem JSON"}
                      </button>
                    )}
                  </div>

                  {/* JSON Previews - Small Expandable Windows */}
                  {(showCMJson || showCSJson) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {showCMJson && (
                        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
                          <div className="bg-gray-800 px-4 py-3 text-white font-semibold flex justify-between items-center">
                            <span className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                              </svg>
                              ConceptMap JSON
                            </span>
                            <button
                              onClick={() => copyToClipboard(JSON.stringify(conceptMap, null, 2), "ConceptMap JSON")}
                              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </button>
                          </div>
                          <div className="overflow-hidden transition-all duration-300">
                            <pre className="p-4 text-gray-800 text-sm overflow-x-auto bg-white font-mono whitespace-pre-wrap max-h-80">
                              {JSON.stringify(conceptMap, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {showCSJson && selectedCS && (
                        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
                          <div className="bg-gray-800 px-4 py-3 text-white font-semibold flex justify-between items-center">
                            <span className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                              </svg>
                              CodeSystem JSON
                            </span>
                            <button
                              onClick={() => copyToClipboard(JSON.stringify(selectedCS, null, 2), "CodeSystem JSON")}
                              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </button>
                          </div>
                          <div className="overflow-hidden transition-all duration-300">
                            <pre className="p-4 text-gray-800 text-sm overflow-x-auto bg-white font-mono whitespace-pre-wrap max-h-80">
                              {JSON.stringify(selectedCS, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 bg-gradient-to-r from-blue-50 to-teal-50 rounded-xl border border-blue-200">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Ready to Map</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Select a CodeSystem from the left panel and click "Translate" on any concept to view 
                    AYUSH → ICD mappings for your EMR records.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



