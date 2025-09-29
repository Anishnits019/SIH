#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- tiny arg parser ---
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) {
      const k = a.replace(/^--/, "");
      const v = arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true;
      acc.push([k, v]);
    }
    return acc;
  }, [])
);

// ===== Required/optional args =====
const inputCsv   = args.in || "data/namaste.csv";
const outDir     = args.out || "out";
const baseUrl    = args["base-url"] || "https://yourgithubusername.github.io/namaste-fhir";
const csVersion  = args.version || "2025.09";
const publisher  = args.publisher || "Team Namaste, SIH 2025";
const status     = args.status || "active";
const experimental = String(args.experimental ?? "true").toLowerCase() === "true";

// Optional explicit column names (auto-detect if omitted)
const systemCol     = args["system-col"]     || null;
const codeCol       = args["code-col"]       || null;
const displayCol    = args["display-col"]    || null;
const englishCol    = args["english-col"]    || null;
const definitionCol = args["definition-col"] || null;
const synonymsCol   = args["synonyms-col"]   || null;

// Optional subset for ValueSet (comma-separated)
const vsCodesArg = args["vs-codes"] || ""; // "EC-3,EC-3.2"
const vsCodes = vsCodesArg ? vsCodesArg.split(",").map(s => s.trim()).filter(Boolean) : null;

// ===== Helpers =====
const todayISO = () => new Date().toISOString().slice(0, 10);
const toTitle = s => s ? (s[0].toUpperCase() + s.slice(1)) : s;

function pickColumn(headers, ...candidates) {
  const low = headers.map(h => h.toLowerCase().trim());
  for (const cand of candidates) {
    const idx = low.findIndex(h => h.includes(cand.toLowerCase()));
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function sanitizeCode(x) {
  if (x == null) return null;
  let code = String(x).trim();
  if (!code) return null;
  if (/^(none|null|nan|na)$/i.test(code)) return null;
  if (code.includes("*")) return null;       // skip wildcards
  code = code.replace(/\s+/g, "");           // remove whitespace
  return code || null;
}

function cleanIdSlug(s) {
  return String(s || "unspecified")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-_.]/g, "-")
    .replace(/-+/g, "-");
}

// ===== FIXED HERE =====
// Now designations don’t use the invalid `designation-usage/synonym`.
function addDesignation(arr, value, language = "en") {
  if (!value) return;
  arr.push({
    value,
    language
  });
}

// ===== Read CSV =====
if (!fs.existsSync(inputCsv)) {
  console.error(`❌ CSV not found: ${inputCsv}`);
  process.exit(1);
}

const csvRaw = fs.readFileSync(inputCsv, "utf8");
const rows = parse(csvRaw, { columns: true, skip_empty_lines: true });
if (!rows.length) {
  console.error("❌ CSV contains no data rows");
  process.exit(1);
}

const headers = Object.keys(rows[0]);

// Auto-detect columns if not provided
const resolved = {
  system:     systemCol     || pickColumn(headers, "system", "tradition", "stream"),
  code:       codeCol       || pickColumn(headers, "namaste", "mock", "code"),
  display:    displayCol    || pickColumn(headers, "display", "term", "disease", "name", "original"),
  english:    englishCol    || pickColumn(headers, "english equivalent", "english", "eng", "translation"),
  definition: definitionCol || pickColumn(headers, "definition", "desc", "description", "brief"),
  synonyms:   synonymsCol   || pickColumn(headers, "synonym", "synonyms", "aka"),
};

if (!resolved.code) {
  console.error("❌ Could not detect a code column. Pass --code-col <columnName>");
  console.error(`Headers seen: ${headers.join(", ")}`);
  process.exit(1);
}

// ===== Group & Build Concepts =====
const grouped = new Map(); // key: systemClean -> { systemLabel, concepts: [], stats }

let totalRows = 0, skipped = 0;

for (const r of rows) {
  totalRows++;

  const rawSystem = resolved.system ? (r[resolved.system] ?? "unspecified") : "unspecified";
  const systemLabel = String(rawSystem).trim() || "unspecified";
  const systemClean = cleanIdSlug(systemLabel);

  const rawCode = r[resolved.code];
  const code = sanitizeCode(rawCode);
  if (!code) { skipped++; continue; }

  let display = resolved.display ? String(r[resolved.display] || "").trim() : "";
  let eng = resolved.english ? String(r[resolved.english] || "").trim() : "";
  const definition = resolved.definition ? String(r[resolved.definition] || "").trim() : "";
  const synStr = resolved.synonyms ? String(r[resolved.synonyms] || "") : "";
  const syns = synStr.split(/[;|,]/).map(s => s.trim()).filter(Boolean);

  if (!display && eng) display = eng;   // fallback to English
  if (!display) display = code;         // final fallback

  const concept = { code, display };
  if (definition) concept.definition = definition;

  const designation = [];
  if (eng && eng !== display) addDesignation(designation, eng, "en");
  for (const s of syns) addDesignation(designation, s, "en");
  if (designation.length) concept.designation = designation;

  if (!grouped.has(systemClean)) {
    grouped.set(systemClean, {
      systemLabel,
      concepts: [],
      seen: new Set()
    });
  }
  const bucket = grouped.get(systemClean);
  if (!bucket.seen.has(code)) {
    bucket.concepts.push(concept);
    bucket.seen.add(code);
  }
}

// ===== Write out FHIR artifacts =====
fs.mkdirSync(outDir, { recursive: true });

const summaries = [];
for (const [systemClean, bucket] of grouped.entries()) {
  const title = `NAMASTE ${toTitle(bucket.systemLabel)} Terms`;
  const csId  = `namaste-${systemClean}`;
  const csUrl = `${baseUrl}/CodeSystem/${csId}`;

  const codeSystem = {
    resourceType: "CodeSystem",
    id: csId,
    url: csUrl,
    version: csVersion,
    name: `NAMASTE${toTitle(bucket.systemLabel)}Terms`.replace(/\s+/g, ""),
    title,
    status,
    experimental,
    publisher,
    date: todayISO(),
    description: `Terminology for ${bucket.systemLabel} disorders curated from CSV; generated as FHIR CodeSystem.`,
    caseSensitive: true,
    content: "complete",
    concept: bucket.concepts
  };

  const csFile = path.join(outDir, `CodeSystem-${csId}.json`);
  fs.writeFileSync(csFile, JSON.stringify(codeSystem, null, 2), "utf8");

  // Build ValueSet (all codes by default, or subset if --vs-codes provided)
  const vsId  = vsCodes && vsCodes.length ? `vs-${systemClean}-subset` : `vs-${systemClean}-all`;
  const vsUrl = `${baseUrl}/ValueSet/${vsId}`;
  const include = { system: csUrl };

  if (vsCodes && vsCodes.length) {
    include.concept = vsCodes.map(c => ({ code: c }));
  }

  const valueSet = {
    resourceType: "ValueSet",
    id: vsId,
    url: vsUrl,
    version: csVersion,
    name: (vsCodes && vsCodes.length)
      ? `Subset${toTitle(bucket.systemLabel)}DisordersVS`
      : `All${toTitle(bucket.systemLabel)}DisordersVS`,
    title: (vsCodes && vsCodes.length)
      ? `ValueSet - Subset NAMASTE ${toTitle(bucket.systemLabel)} Disorders`
      : `ValueSet - All NAMASTE ${toTitle(bucket.systemLabel)} Disorders`,
    status,
    experimental,
    publisher,
    date: todayISO(),
    description: (vsCodes && vsCodes.length)
      ? `ValueSet with a selected subset of ${bucket.systemLabel} disorders from the associated CodeSystem.`
      : `This ValueSet includes all ${bucket.systemLabel} disorders from the associated CodeSystem.`,
    compose: { include: [ include ] }
  };

  const vsFile = path.join(outDir, `ValueSet-${vsId}.json`);
  fs.writeFileSync(vsFile, JSON.stringify(valueSet, null, 2), "utf8");

  summaries.push({
    system: bucket.systemLabel,
    concepts: bucket.concepts.length,
    files: { codeSystem: csFile, valueSet: vsFile }
  });
}

// ===== Logs =====
console.log(`✅ Processed rows: ${totalRows}`);
console.log(`✅ Systems generated: ${summaries.length}`);
console.log(`ℹ️  Skipped (empty/(None)/*/dup code rows filtered): ${skipped}`);
for (const s of summaries) {
  console.log(`— ${s.system}: ${s.concepts} concepts`);
  console.log(`   CS: ${s.files.codeSystem}`);
  console.log(`   VS: ${s.files.valueSet}`);
}
