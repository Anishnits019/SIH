import mongoose from "mongoose";
import Concept from "./models/ayush_model.js";
import fs from "fs";

const files = [
  "./data/CodeSystem-namaste-ayurveda.json",
  "./data/CodeSystem-namaste-siddha.json",
  "./data/CodeSystem-namaste-unani.json",
];

async function run() {
  await mongoose.connect("mongodb://localhost:27017/ayush"); // or Atlas URI

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const system = data.id;
    const docs = data.concept.map((c) => ({
      system,
      code: c.code,
      display: c.display,
      definition: c.definition || "",
      designation: c.designation || [],
    }));
    await Concept.insertMany(docs);
  }

  console.log("✅ Seeded successfully!");
  process.exit();
}
run();
