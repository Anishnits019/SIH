// Routes/suggest.js
import express from "express";
import mongoose from "mongoose";
import { randomUUID } from "crypto";

const router = express.Router();

const csCol   = () => mongoose.connection.collection("namaste"); // FHIR CodeSystem docs
const mapsCol = () => mongoose.connection.collection("maps");     // your ICD mappings

// ---------- helpers ----------
const escapeRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const uniq = (a) => [...new Set(a)];
const parseBool = (v) => /^(1|true|yes|y|on)$/i.test(String(v||""));
const shortFromId = (id) => (id || "").replace(/^namaste-/, "");
const parseCodes = (s) =>
  uniq(String(s||"").split(",").map(x=>x.trim()).filter(Boolean));

const icdTargetUrl = (t) =>
  String(t||"mms").toLowerCase()==="tm2"
    ? "http://id.who.int/icd/release/11/tm2"
    : "http://id.who.int/icd/release/11/mms";

function bundleTransaction(resources) {
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: resources.map(r => {
      const fullUrl = `urn:uuid:${randomUUID()}`;
      const type = r.resourceType;
      const id = r.id || randomUUID();
      const url = `${type}/${id}`;
      return { fullUrl, resource: r, request: { method: "PUT", url } };
    }),
  };
}

// Build a Condition with NAMASTE coding (+ ICD mapping if available)
function buildCondition({ csUrl, systemShort, patientId, concept, mapping, targetUrl, encounterId, onset, recorderRef }) {
  const now = new Date().toISOString();

  const namasteCoding = {
    system: csUrl || `urn:namaste:${systemShort}`,
    code: concept.code,
    display: concept.display || undefined,
  };

  const codings = [namasteCoding];

  if (mapping?.targetCode) {
    codings.push({
      system: targetUrl,
      code: mapping.targetCode,
      display: mapping.targetDisplay || undefined,
    });
  }

  const condition = {
    resourceType: "Condition",
    id: `cond-${concept.code}-${randomUUID().slice(0,8)}`,
    clinicalStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }],
    },
    verificationStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }],
    },
    category: [{
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "problem-list-item", display: "Problem List Item" }],
    }],
    code: { coding: codings, text: concept.display || concept.code },
    subject: { reference: `Patient/${patientId}` },
    recordedDate: now,
  };

  if (onset) condition.onsetDateTime = onset;
  if (encounterId) condition.encounter = { reference: `Encounter/${encounterId}` };
  if (recorderRef) condition.recorder = { reference: recorderRef };

  return condition;
}

// ---------- SINGLE ROUTE (kept your original path) ----------
// GET /api/suggest
// Common:
//   q=Va                        (for suggestions; starts-with on concept.display)
//   system=ayurveda|siddha|unani   (optional filter)
//   limit=15
//
// Patient bundle mode (builds a transaction Bundle ready to POST to your FHIR server):
//   bundle=patient
//   patientId=PT123             (required)
//   patientName=John%20Doe      (optional)
//   gender=male|female|other|unknown (optional)
//   birthDate=YYYY-MM-DD        (optional)
//   codes=EC-3,EC-3.2           (preferred; if omitted, takes top matches from q)
//   target=mms|tm2              (default mms)
//   encounterId=ENC001          (optional)
//   onset=2025-09-01            (optional; applies to all Conditions)
//   recorder=Practitioner/PR1   (optional)
//   forward=1                   (optional: if set and FHIR_BASE env is present, forwards bundle upstream)
router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  const systemShort = (req.query.system || "").trim().toLowerCase();
  const limit = Math.min(parseInt(req.query.limit || "15", 10), 100);
  const bundleMode = String(req.query.bundle || "").toLowerCase();

  // --- suggestion search (always needed; also used to fall back to codes) ---
  if (!q && bundleMode !== "patient") return res.json([]);

  const rx = q ? new RegExp("^" + escapeRx(q), "i") : null;
  const match = rx ? { "concept.display": rx } : {};
  if (systemShort) match.id = "namaste-" + systemShort;

  try {
    const hits = q
      ? await csCol().aggregate([
          { $unwind: "$concept" },
          { $match: match },
          { $project: { _id: 0, system: "$id", systemUrl: "$url", concept: "$concept" } },
          { $limit: limit }
        ]).toArray()
      : [];

    // ---- default behavior: raw suggestions ----
    if (bundleMode !== "patient") {
      return res.json(hits);
    }

    // ---- PATIENT BUNDLE MODE ----
    const patientId = String(req.query.patientId || "").trim();
    if (!patientId) return res.status(400).json({ error: "patientId is required for bundle=patient" });

    const patientName = String(req.query.patientName || "").trim();
    const gender = String(req.query.gender || "").trim().toLowerCase();
    const birthDate = String(req.query.birthDate || "").trim();
    const targetUrl = icdTargetUrl(req.query.target);
    const encounterId = String(req.query.encounterId || "").trim() || undefined;
    const onset = String(req.query.onset || "").trim() || undefined;
    const recorder = String(req.query.recorder || "").trim() || undefined;
    const forward = parseBool(req.query.forward);

    // Decide which codes to include
    let codes = parseCodes(req.query.codes);
    if (!codes.length && hits.length) {
      // fallback: take codes from the current suggestions
      codes = hits.map(h => h.concept?.code).filter(Boolean);
    }
    if (!codes.length) return res.status(400).json({ error: "No codes provided or found from q." });

    // Group by system id (e.g., namaste-ayurveda)
    const bySystem = new Map();
    const preferFromHits = new Map(); // code -> {display, systemId, systemUrl}
    for (const h of hits) {
      if (!h?.concept?.code) continue;
      preferFromHits.set(h.concept.code, { display: h.concept.display, systemId: h.system, systemUrl: h.systemUrl });
    }

    for (const code of codes) {
      // try to resolve system via hits; else lookup across CS docs
      let sysId = preferFromHits.get(code)?.systemId;
      let sysUrl = preferFromHits.get(code)?.systemUrl;
      let display = preferFromHits.get(code)?.display;

      if (!sysId) {
        // look for this code in any of the NAMASTE CodeSystems (cheap index-less scan with aggregate)
        const found = await csCol().aggregate([
          { $unwind: "$concept" },
          { $match: { "concept.code": code, ...(systemShort ? { id: "namaste-"+systemShort } : {}) } },
          { $project: { _id: 0, id: 1, url: 1, concept: 1 } },
          { $limit: 1 }
        ]).toArray();
        if (found.length) {
          sysId = found[0].id;
          sysUrl = found[0].url;
          display = found[0].concept?.display;
        }
      }

      if (!sysId) continue; // skip unknown codes

      if (!bySystem.has(sysId)) bySystem.set(sysId, { sysUrl, codes: new Set(), concepts: new Map() });
      bySystem.get(sysId).codes.add(code);
      bySystem.get(sysId).concepts.set(code, { code, display });
    }

    if (bySystem.size === 0) return res.status(404).json({ error: "None of the provided codes were found." });

    // Build Patient
    const patient = {
      resourceType: "Patient",
      id: patientId,
    };
    if (patientName) patient.name = [{ text: patientName }];
    if (gender) patient.gender = gender;
    if (birthDate) patient.birthDate = birthDate;

    const resources = [patient];

    // For each system group, pull mappings and create Conditions
    for (const [sysId, info] of bySystem.entries()) {
      const sysShort = shortFromId(sysId);
      const codeList = [...info.codes];

      // get mappings for these codes & chosen target
      const mapRows = await mapsCol().find({
        system: sysShort, // ayurveda|siddha|unani
        code: { $in: codeList },
        targetSystem: targetUrl.endsWith("/tm2") ? "icd11-tm2" : "icd11-mms",
      }, { projection: { _id: 0 } }).toArray();

      // fast lookup: srcCode -> mapping row (or first if multiple)
      const mapByCode = new Map();
      for (const r of mapRows) {
        if (!mapByCode.has(r.code)) mapByCode.set(r.code, r);
      }

      for (const code of codeList) {
        const concept = info.concepts.get(code) || { code, display: undefined };
        const mapping = mapByCode.get(code) || null;
        const cond = buildCondition({
          csUrl: info.sysUrl,
          systemShort: sysShort,
          patientId,
          concept,
          mapping,
          targetUrl,
          encounterId,
          onset,
          recorderRef: recorder || undefined,
        });
        resources.push(cond);
      }
    }

    // Build transaction bundle
    const bundle = bundleTransaction(resources);

    // Optionally forward to central FHIR server
    if (forward) {
      const fhirBase = process.env.FHIR_BASE;
      if (!fhirBase) return res.status(400).json({ error: "forward=1 but FHIR_BASE env is not set on server" });

      const resp = await fetch(`${fhirBase}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/fhir+json",
          Accept: "application/fhir+json",
        },
        body: JSON.stringify(bundle),
      });

      const out = await resp.json().catch(() => ({}));
      return res.status(resp.status).json(out);
    }

    return res.json(bundle);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
