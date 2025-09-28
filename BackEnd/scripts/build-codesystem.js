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

// Required/optional args
const inputCsv  = args.in || "BackEnd/data/namaste_mock_1000_detailed.csv";
const outDir    = args.out || "BackEnd/out";  // note: now it's a directory, not a single file
const csVersion = args.version || "1.0.0";
const publisher = args.publisher || "Your Team / SIH Demo";

if (!fs.existsSync(inputCsv)) {
  console.error(`❌ CSV not found: ${inputCsv}`);
  process.exit(1);
}
const csvRaw = fs.readFileSync(inputCsv, "utf8");
const rows = parse(csvRaw, { columns: true, skip_empty_lines: true });

// Group concepts by system
const grouped = {};
for (const r of rows) {
  if (!r.code || !r.display) continue;
  const sys = (r.system || "unspecified").trim().toLowerCase();
  if (!grouped[sys]) grouped[sys] = [];

  const concept = {
    code: String(r.code).trim(),
    display: String(r.display).trim()
  };
  if (r.definition && String(r.definition).trim()) {
    concept.definition = String(r.definition).trim();
  }
  const syns = (r.synonyms || "")
    .split(";")
    .map(s => s.trim())
    .filter(Boolean);
  if (syns.length) {
    concept.designation = syns.map(s => ({ language: "en", value: s }));
  }
  grouped[sys].push(concept);
}

// Write one CodeSystem per system
fs.mkdirSync(outDir, { recursive: true });

for (const [sys, concepts] of Object.entries(grouped)) {
  if (!concepts.length) continue;

  const sysClean = sys.replace(/\s+/g, "-"); // safe for filenames and ids
  const csId   = `namaste-${sysClean.slice(0,2)}`;
  const csUrl  = `https://yourgithubusername.github.io/namaste-fhir/CodeSystem/namaste-${sysClean}`;
  const csName = `NAMASTE ${sysClean[0].toUpperCase()}${sysClean.slice(1)} Terms`;

  const codeSystem = {
    resourceType: "CodeSystem",
    id: csId,
    url: csUrl,
    version: csVersion,
    name: csName.replace(/\s+/g, ""),
    title: csName,
    status: "active",
    experimental: true,
    publisher,
    content: "complete",
    concept: concepts
  };

  const outFile = path.join(outDir, `CodeSystem-namaste-${sysClean}.json`);
  fs.writeFileSync(outFile, JSON.stringify(codeSystem, null, 2), "utf8");
  console.log(`✅ Wrote CodeSystem (${concepts.length} concepts) for '${sys}' -> ${outFile}`);
}
