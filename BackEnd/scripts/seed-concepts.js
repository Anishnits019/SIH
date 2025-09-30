// BackEnd/scripts/seed-concepts.js
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Concept from "../Models/CodeSystem.js";

dotenv.config();

const INPUTS = [
  { system: "ayurveda", file: path.resolve("out/codesystem/CodeSystem-namaste-ayurveda.json") },
  { system: "siddha",   file: path.resolve("out/codesystem/CodeSystem-namaste-siddha.json") },
  { system: "unani",    file: path.resolve("out/codesystem/CodeSystem-namaste-unani.json") },
];

async function run() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/sih_terminology";
  await mongoose.connect(uri);
  console.log("✅ Connected:", uri);

  for (const { system, file } of INPUTS) {
    if (!fs.existsSync(file)) {
      console.warn("⚠️  Missing file:", file);
      continue;
    }
    const json = JSON.parse(fs.readFileSync(file, "utf-8"));

    // Accept either FHIR CodeSystem or flat list
    const concepts = Array.isArray(json.concept) ? json.concept : json;

    const bulk = concepts.map((c) => ({
      updateOne: {
        filter: { system, code: c.code },
        update: {
          $set: {
            system,
            code: c.code,
            display: c.display,
            definition: c.definition || "",
            designations: (c.designation || []).map((d) => ({
              value: d.value,
              language: d.language || "en",
            })),
            tm2: c.tm2 || [],
            biomed: c.biomed || [],
            version: json.version || "1.0.0",
            source: json.url || "ingest",
          },
        },
        upsert: true,
      },
    }));

    if (bulk.length) {
      const res = await Concept.bulkWrite(bulk, { ordered: false });
      console.log(`✅ Upserted ${system}:`, res.upsertedCount, "updated:", res.modifiedCount);
    }
  }

  await mongoose.disconnect();
  console.log("🏁 Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});