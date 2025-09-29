// Usage:
// node BackEnd/scripts/build-conceptmaps-from-codesystems.js \
//   --in BackEnd/out/codesystems \
//   --out BackEnd/out/conceptmaps \
//   --limit 3 --max 0
//
// What it does:
// - Finds all CodeSystem-*.json inside --in (your 5 systems: ay/sd/un/yg/hm)
// - For each concept (display + synonyms), queries WHO MMS + TM2
// - Picks best match (lexical+API score) per linearization
// - Writes FHIR ConceptMap JSON per CodeSystem + review CSVs + unresolved CSV
//
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {searchMMS,searchTM2} from "../services/whoIcdClient.js"
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ROOT is the BackEnd folder (because this script lives in BackEnd/scripts)
const ROOT = path.resolve(__dirname, '..');

/** Resolve a path relative to BackEnd/, de-duping accidental "BackEnd/" prefixes. */
function r(p) {
  if (!p) return ROOT;
  if (path.isAbsolute(p)) return p;
  // strip leading "BackEnd/" or "BackEnd\" if present
  const cleaned = p.replace(/^BackEnd[\\/]/i, '');
  return path.resolve(ROOT, cleaned);
}

// ---- CLI args
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, x, i, arr) => {
    if (x.startsWith('--')) acc.push([x.slice(2), (arr[i + 1] || '').startsWith('--') ? true : arr[i + 1]]);
    return acc;
  }, [])
);

// Use BackEnd-relative defaults
const IN_DIR  = r(args.in  || 'out/codesystems');
const OUT_DIR = r(args.out || 'out/conceptmaps');

// (optional) limits
const LIMIT = Number(args.limit || 3);
const MAX   = Number(args.max || 0);

console.log('Using paths:');
console.log('  IN_DIR :', IN_DIR);
console.log('  OUT_DIR:', OUT_DIR);

// --- helpers ---
function readJSON(p){ return JSON.parse(fs.readFileSync(p, "utf8")); }
function norm(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim(); }
function jaccard(a,b){
  const A = new Set(norm(a).split(" ").filter(Boolean));
  const B = new Set(norm(b).split(" ").filter(Boolean));
  if (!A.size && !B.size) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return inter / (union || 1);
}
function bestPick(sourceDisplay, list){
  let best = null;
  for (const it of list){
    const lex = jaccard(sourceDisplay, it.title);
    const api = typeof it.score === "number" ? Math.max(0,Math.min(1,it.score)) : 0;
    const combined = 0.7*lex + 0.3*api;
    if (!best || combined > best._score) best = { ...it, _score: combined, _lex: lex, _api: api };
  }
  if (!best) return null;
  const equivalence = best._lex >= 0.85 ? "equivalent" : "related";
  return { code: best.code, display: best.title, equivalence, score: best._score };
}
function ensureDir(p){ fs.mkdirSync(p, { recursive: true }); }
function conceptSynonyms(concept){
  const arr = [];
  if (Array.isArray(concept.designation)) {
    for (const d of concept.designation) if (d?.value) arr.push(String(d.value));
  }
  return arr;
}
// flatten nested CodeSystem.concept[]
function flattenConcepts(list, acc = []){
  if (!Array.isArray(list)) return acc;
  for (const c of list){
    if (c?.code && c?.display) acc.push({ code: c.code, display: c.display, synonyms: conceptSynonyms(c) });
    if (Array.isArray(c.concept)) flattenConcepts(c.concept, acc);
  }
  return acc;
}

// per-CodeSystem processor
async function processCodeSystem(csPath){
  const cs = readJSON(csPath);
  const csId   = cs.id || path.basename(csPath).replace(/\.json$/,"");
  const csUrl  = cs.url || `https://your.domain/fhir/CodeSystem/${csId}`;
  const concepts = flattenConcepts(cs.concept || []);
  const slice = (MAX > 0) ? concepts.slice(0, MAX) : concepts;

  console.log(`\n📘 ${csId}: concepts=${concepts.length}, processing=${slice.length}`);

  const rows = [];     // for review CSV
  const unresolved = [];

  // search/cache location (per CS) to save API calls
  const cacheFile = path.join(OUT_DIR, "..", "cache", `who_cache_${csId}.json`);
  ensureDir(path.dirname(cacheFile));
  let CACHE = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile,"utf8")) : {};
  const ck = (lin, q) => `${lin}::${q.toLowerCase().trim()}`;

  async function searchWithCache(linearization, q){
    const key = ck(linearization, q);
    if (CACHE[key]) return CACHE[key];
    const data = linearization === "mms" ? await searchMMS(q, { limit: LIMIT }) : await searchTM2(q, { limit: LIMIT });
    CACHE[key] = data;
    if (Math.random() < 0.05) fs.writeFileSync(cacheFile, JSON.stringify(CACHE, null, 2), "utf8");
    return data;
  }

  for (const c of slice){
    const queries = new Set([c.display, ...c.synonyms]);
    let bestMMS = null, bestTM2 = null;

    for (const q of [...queries].filter(Boolean)){
      await new Promise(r => setTimeout(r, 200)); // be nice to the API
      const [mms, tm2] = await Promise.all([
        searchWithCache("mms", q),
        searchWithCache("tm2", q)
      ]);
      const pM = bestPick(c.display, mms);
      const pT = bestPick(c.display, tm2);
      if (pM && (!bestMMS || pM.score > bestMMS.score)) bestMMS = pM;
      if (pT && (!bestTM2 || pT.score > bestTM2.score)) bestTM2 = pT;
    }

    if (!bestMMS && !bestTM2){
      unresolved.push(c);
      continue;
    }
    if (bestTM2){
      rows.push({
        source_code: c.code,
        source_display: c.display,
        target_system: "http://id.who.int/icd/release/11/tm2",
        target_code: bestTM2.code,
        target_display: bestTM2.display,
        equivalence: bestTM2.equivalence
      });
    }
    if (bestMMS){
      rows.push({
        source_code: c.code,
        source_display: c.display,
        target_system: "http://id.who.int/icd/release/11/mms",
        target_code: bestMMS.code,
        target_display: bestMMS.display,
        equivalence: bestMMS.equivalence
      });
    }
  }

  fs.writeFileSync(cacheFile, JSON.stringify(CACHE, null, 2), "utf8");

  // write review CSV
  ensureDir(OUT_DIR);
  const csvPath = path.join(OUT_DIR, `map-${csId}-icd11.auto.csv`);
  const header = "source_code,source_display,target_system,target_code,target_display,equivalence\n";
  const lines = rows.map(r => [r.source_code, r.source_display, r.target_system, r.target_code, r.target_display, r.equivalence]
    .map(v => `"${String(v).replace(/"/g,'""')}"`).join(","));
  fs.writeFileSync(csvPath, header + lines.join("\n"), "utf8");

  // write unresolved CSV
  if (unresolved.length){
    const ufile = path.join(OUT_DIR, `unresolved-${csId}.csv`);
    const uhead = "code,display,synonyms\n";
    const ulines = unresolved.map(u => `"${u.code}","${u.display}","${u.synonyms.join(";").replace(/"/g,'""')}"`);
    fs.writeFileSync(ufile, uhead + ulines.join("\n"), "utf8");
  }

  // build ConceptMap JSON
  const cm = {
    resourceType: "ConceptMap",
    id: `map-${csId}-icd11-auto`,
    url: `https://your.domain/fhir/ConceptMap/${csId}-to-icd11-auto`,
    version: "2025.09",
    name: `${csId.replace(/[^A-Za-z0-9]/g,"")}_to_ICD11_Auto`,
    title: `${csId} to ICD-11 (Auto)`,
    status: "active",
    experimental: true,
    publisher: "SIH Demo",
    group: [
      { source: csUrl, target: "http://id.who.int/icd/release/11/tm2", element: [] },
      { source: csUrl, target: "http://id.who.int/icd/release/11/mms", element: [] }
    ]
  };

  const byTgt = new Map([
    ["http://id.who.int/icd/release/11/tm2", 0],
    ["http://id.who.int/icd/release/11/mms", 1]
  ]);
  const elIndex = new Map(); // key = `${gi}||${source_code}`

  for (const r of rows){
    const gi = byTgt.get(r.target_system);
    const key = `${gi}||${r.source_code}`;
    if (!elIndex.has(key)){
      cm.group[gi].element.push({ code: r.source_code, display: r.source_display, target: [] });
      elIndex.set(key, cm.group[gi].element[cm.group[gi].element.length-1]);
    }
    elIndex.get(key).target.push({
      code: r.target_code,
      display: r.target_display,
      equivalence: r.equivalence || "related"
    });
  }

  const outPath = path.join(OUT_DIR, `map-${csId}-icd11.auto.json`);
  fs.writeFileSync(outPath, JSON.stringify(cm, null, 2), "utf8");

  console.log(`✅ ${csId}: wrote ConceptMap -> ${outPath}`);
  console.log(`✅ ${csId}: review CSV       -> ${csvPath}`);
  if (unresolved.length) console.log(`⚠️  ${csId}: unresolved -> ${unresolved.length}`);
}

// --- main ---
(function main(){
  if (!fs.existsSync(IN_DIR)) {
    console.error("❌ Input dir not found:", IN_DIR);
    process.exit(1);
  }
  const files = fs.readdirSync(IN_DIR)
    .filter(f => /^CodeSystem-.*\.json$/i.test(f))
    .map(f => path.join(IN_DIR, f));

  if (!files.length){
    console.error("❌ No CodeSystem-*.json found in", IN_DIR);
    process.exit(1);
  }

  ensureDir(OUT_DIR);

  (async () => {
    for (const f of files) {
      try { await processCodeSystem(f); }
      catch (e) {
        console.error(`❌ Failed ${path.basename(f)}:`, e.response?.data || e.message);
      }
    }
    console.log("\n🎉 Done.");
  })();
})();