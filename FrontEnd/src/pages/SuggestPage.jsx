import { useEffect, useMemo, useState } from "react";

/**
 * All-in-one UI (drop into App and render <SuggestPage />)
 *
 * Props:
 *  - system?: "ayurveda" | "siddha" | "unani" | "" (optional; sent to /api/suggest)
 *  - apiBase?: string (default: VITE_API_BASE or http://localhost:4000)
 *  - excludeSystems?: string[]  // e.g. ["siddha"] to hide a system by id substring
 *  - icdOnly?: boolean          // true => show only concepts that have an ICD mapping
 */
export default function SuggestPage({
  system = "",
  apiBase,
  excludeSystems = ["siddha"],     // ✅ default: remove Siddha searches
  icdOnly = true                   // ✅ default: keep only ICD-mappable concepts
}) {
  const API_BASE = useMemo(
    () => apiBase || import.meta.env.VITE_API_BASE || "http://localhost:4000",
    [apiBase]
  );

  // UI state
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [mode, setMode] = useState("results"); // "results" | "details"

  // Search + results
  const [q, setQ] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestErr, setSuggestErr] = useState("");
  const [systems, setSystems] = useState([]); // merged CodeSystems with optional _icdConcepts

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
    const MAX_CONCEPTS_TO_CHECK = 24; // tune as needed
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

    // In case this CS came without _icdConcepts (icdOnly disabled), optionally probe here
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
  }

  function backToResults() {
    setMode("results");
    setSelectedCS(null);
    setConceptMap(null);
    setMapErr("");
    setShowCMJson(false);
    setShowCSJson(false);
  }

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
    <div style={{
      display: "flex",
      height: "100vh",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      background: "#fafafa"
    }}>
      {/* LEFT PANEL (collapsible) */}
      <div
        style={{
          width: isLeftCollapsed ? 56 : 460,
          transition: "width 180ms ease",
          borderRight: "1px solid #e5e7eb",
          background: "#fff",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* header */}
        <div style={{
          position: "sticky",
          top: 0,
          background: "#fff",
          zIndex: 1,
          padding: 12,
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <button
            onClick={() => setIsLeftCollapsed(v => !v)}
            style={iconBtn}
            title={isLeftCollapsed ? "Expand" : "Collapse"}
          >
            {isLeftCollapsed ? "›" : "‹"}
          </button>
          {!isLeftCollapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {mode === "details" && (
                <button onClick={backToResults} style={btnSecondarySm} title="Back to results">
                  ← Back
                </button>
              )}
              <h2 style={{ margin: 0, fontSize: 18 }}>
                {mode === "results" ? "AYUSH Code Search" : "CodeSystem Details"}
              </h2>
            </div>
          )}
        </div>

        {/* body */}
        <div style={{ padding: isLeftCollapsed ? 8 : 12, overflowY: "auto", flex: 1 }}>
          {!isLeftCollapsed && (
            <>
              {/* search only in results mode */}
              {mode === "results" && (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Type to search (starts with)…"
                      style={{
                        padding: 10, flex: 1, border: "1px solid #e5e7eb",
                        borderRadius: 10, outline: "none"
                      }}
                    />
                    <select
                      value={system}
                      onChange={() => {}}
                      disabled
                      title="System is controlled by parent"
                      style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10, opacity: 0.6 }}
                    >
                      <option value="">All</option>
                      <option value="ayurveda">Ayurveda</option>
                      {/* Siddha intentionally hidden by default */}
                      <option value="unani">Unani</option>
                    </select>
                  </div>

                  {(suggestLoading || filteringICD) && (
                    <div style={{ marginTop: 8, opacity: 0.8 }}>
                      {suggestLoading ? "Loading…" : filterNote || "Filtering…"}
                    </div>
                  )}
                  {suggestErr && <div style={{ marginTop: 8, color: "crimson" }}>{suggestErr}</div>}

                  {showEmptyState && (
                    <div style={emptyCard}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Start searching</div>
                      <div style={{ color: "#475569" }}>Type at least 1 character, or try:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                        {exampleChips.map((ex) => (
                          <button
                            key={ex}
                            style={chipBtn}
                            onClick={() => setQ(ex)}
                            title={`Search "${ex}"`}
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RESULTS: one card per CodeSystem (already filtered) */}
                  {systems.length > 0 && (
                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      {systems.map((cs) => (
                        <div
                          key={cs.id}
                          style={csCard}
                          onClick={() => openDetails(cs)}
                          title="Open this CodeSystem"
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{cs.title}</div>
                              <div style={{ fontSize: 12, color: "#475569" }}>
                                {cs.publisher} • v{cs.version}
                              </div>
                            </div>
                            <span style={badge}>CodeSystem</span>
                          </div>

                          {/* show up to 10 ICD-available concept chips */}
                          {displayConcepts(cs).length > 0 && (
                            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {displayConcepts(cs).slice(0, 10).map((c) => (
                                <span key={c.code} style={conceptChip} title={`${c.code} — ${c.display}`}>
                                  <b>{c.code}</b>&nbsp;·&nbsp;<span style={{ opacity: 0.9 }}>{c.display}</span>
                                </span>
                              ))}
                              {displayConcepts(cs).length > 10 && (
                                <span style={{ ...conceptChip, opacity: 0.7 }}>
                                  +{displayConcepts(cs).length - 10} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* no systems after filtering */}
                  {!suggestLoading && !filteringICD && q.trim() && systems.length === 0 && (
                    <div style={{ ...emptyCard, color: "#991b1b", background: "#fff8f8", borderColor: "#fecaca" }}>
                      No results with ICD mappings{excludeSystems.length ? " (some systems excluded)" : ""}.
                    </div>
                  )}
                </>
              )}

              {/* DETAILS: only the CodeSystem you clicked */}
              {mode === "details" && selectedCS && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <h3 style={{ margin: "0 0 6px 0" }}>{selectedCS.title}</h3>
                      <div style={{ fontSize: 13, color: "#475569" }}>
                        <strong>{selectedCS.publisher}</strong> • v{selectedCS.version}
                      </div>
                    </div>
                  </div>

                  <h4 style={{ margin: "14px 0 8px 0" }}>
                    Concepts {icdOnly && <small style={{ color: "#2563eb" }}>(ICD-mapped only)</small>}
                  </h4>

                  {displayConcepts(selectedCS).length > 0 ? (
                    <ul style={{ paddingLeft: 0, margin: 0 }}>
                      {displayConcepts(selectedCS).map((c) => (
                        <li key={c.code} style={conceptItem}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700 }}>{c.code}</div>
                            <div style={{ color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {c.display}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleTranslate(c.code); }}
                            style={btnPrimary}
                            disabled={mapLoading && selectedCode === c.code}
                            title="Translate AYUSH → ICD"
                          >
                            {mapLoading && selectedCode === c.code ? "Translating…" : "Translate"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: "#64748b" }}>
                      {icdOnly ? "No ICD-mapped concepts left for this CodeSystem." : "No concepts found."}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* collapsed hint */}
          {isLeftCollapsed && (
            <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: "#334155", opacity: 0.7, marginTop: 8 }}>
              {mode === "results" ? "Search" : "Details"}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: mapping + JSON */}
      <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>AYUSH → ICD Mapping</h2>
          {mapLoading && <span style={chip}>Loading…</span>}
          {mapErr && <span style={{ ...chip, background: "#fee2e2", color: "#991b1b" }}>{mapErr}</span>}
        
        </div>

        {conceptMap ? (
          <div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={chip}>ConceptMap: {conceptMap.title || conceptMap.name || conceptMap.id}</span>
              <span style={chip}>Version: {conceptMap.version || "—"}</span>
              <span style={chip}>Groups: {toArray(conceptMap.group).length}</span>
            </div>

            <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead style={{ background: "#f8fafc" }}>
                  <tr>
                    <Th>AYUSH Code</Th>
                    <Th>ICD Code</Th>
                    <Th>Relationship</Th>
                  </tr>
                </thead>
                <tbody>
                  {mappingRows(conceptMap).map((r, i) => (
                    <tr key={i}>
                      <Td>
                        <div style={{ fontWeight: 600 }}>{r.srcCode}</div>
                        <div style={{ color: "#334155" }}>{r.srcDisp}</div>
                      </Td>
                      <Td>
                        <div style={{ fontWeight: 600 }}>{r.tgtCode}</div>
                        <div style={{ color: "#334155" }}>{r.tgtDisp}</div>
                      </Td>
                      <Td>{r.eq}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => setShowCMJson(v => !v)}
                style={btnSecondary}
                title="Show/Hide raw ConceptMap JSON"
              >
                {showCMJson ? "Hide ConceptMap JSON" : "Show ConceptMap JSON"}
              </button>
              {selectedCS && (
                <button
                  onClick={() => setShowCSJson(v => !v)}
                  style={btnSecondary}
                  title="Show/Hide raw CodeSystem JSON"
                >
                  {showCSJson ? "Hide CodeSystem JSON" : "Show CodeSystem JSON"}
                </button>
              )}
            </div>

            {(showCMJson || showCSJson) && (
              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: showCMJson && showCSJson ? "1fr 1fr" : "1fr",
                  gap: 12
                }}
              >
                {showCMJson && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>ConceptMap JSON</div>
                    <JsonPreviewLight data={conceptMap} />
                  </div>
                )}
                {showCSJson && selectedCS && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>CodeSystem JSON</div>
                    <JsonPreviewLight data={selectedCS} />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: "#64748b", marginTop: 16 }}>
            🧭 Open a CodeSystem on the left, then click <b>Translate</b> on a concept to view mappings here.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- styles & helpers ---------- */

const iconBtn = {
  width: 32, height: 32, borderRadius: 8,
  border: "1px solid #e5e7eb", background: "#fff",
  cursor: "pointer", fontWeight: 700
};

const btnPrimary = {
  padding: "8px 12px",
  border: "none",
  borderRadius: 10,
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const btnSecondary = {
  padding: "8px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 700,
};

const btnSecondarySm = {
  padding: "6px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12
};

const chip = {
  fontSize: 12,
  padding: "4px 8px",
  background: "#e5f2ff",
  color: "#1e3a8a",
  borderRadius: 999,
  border: "1px solid #bfdbfe",
};

const chipBtn = {
  fontSize: 12,
  padding: "4px 8px",
  background: "#f1f5f9",
  color: "#0f172a",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  cursor: "pointer"
};

const emptyCard = {
  marginTop: 12,
  padding: 14,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#ffffff"
};

const csCard = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#ffffff",
  padding: 12,
  cursor: "pointer"
};

const badge = {
  fontSize: 11,
  padding: "2px 8px",
  background: "#f1f5f9",
  color: "#0f172a",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  alignSelf: "flex-start"
};

const conceptChip = {
  fontSize: 12,
  padding: "6px 8px",
  background: "#f8fafc",
  color: "#0f172a",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};

const conceptItem = {
  listStyle: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "10px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#f9fafb",
  marginBottom: 8,
};

function Th({ children }) {
  return (
    <th style={{ border: "1px solid #e5e7eb", padding: 10, textAlign: "left", fontSize: 13, color: "#0f172a" }}>
      {children}
    </th>
  );
}
function Td({ children }) {
  return (
    <td style={{ border: "1px solid #e5e7eb", padding: 10, verticalAlign: "top", background: "#ffffff" }}>
      {children}
    </td>
  );
}
function JsonPreviewLight({ data }) {
  return (
    <pre style={{
      background: "#ffffff",
      color: "#111827",
      padding: 12,
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      fontSize: 13,
      overflowX: "auto",
      maxHeight: 380,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
