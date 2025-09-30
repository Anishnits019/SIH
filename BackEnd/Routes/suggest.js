// Routes/suggest.js
import express from "express";
import mongoose from "mongoose";
const router = express.Router();

const col = () => mongoose.connection.collection("namaste"); // your CodeSystems collection
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  const system = (req.query.system || "").trim(); // "", "ayurveda", "siddha", "unani"

  // Always return FHIR Bundle
  res.set("Content-Type", "application/fhir+json");

  if (!q) {
    return res.json({ resourceType: "Bundle", type: "searchset", total: 0, entry: [] });
  }

  const rx = new RegExp("^" + esc(q), "i");           // starts-with
  const match = { "concept.display": rx };
  if (system) match.id = "namaste-" + system;         // e.g. "namaste-ayurveda"

  try {
    // Group matches by CodeSystem and return each as a FHIR fragment
    const fragments = await col().aggregate([
      { $unwind: "$concept" },
      { $match: match },
      { $group: {
          _id: "$id",
          id: { $first: "$id" },
          url: { $first: "$url" },
          version: { $first: "$version" },
          name: { $first: "$name" },
          title: { $first: "$title" },
          status: { $first: "$status" },
          publisher: { $first: "$publisher" },
          concepts: { $push: "$concept" }
      }},
      { $project: {
          _id: 0,
          resourceType: { $literal: "CodeSystem" },
          id: 1, url: 1, version: 1, name: 1, title: 1, status: 1, publisher: 1,
          content: { $literal: "fragment" },       // we’re returning a subset
          concept: { $slice: ["$concepts", 15] }    // cap per-system to 15
      }}
    ]).toArray();

    const bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: fragments.length,
      entry: fragments.map(cs => ({ resource: cs }))
    };

    res.json(bundle);
  } catch (e) {
    res.status(500).json({ resourceType: "OperationOutcome", issue: [{ severity: "error", details: { text: e.message } }] });
  }
});

// --- ADD BELOW: ICD-11 mapping lookup for a clicked suggestion ----------------
const conceptMapCol = () => mongoose.connection.collection("conceptmaps");

// GET /api/suggest/map?system=ayurveda&code=EC-3
// Returns a FHIR ConceptMap **fragment** with BOTH ICD-11 groups (MMS & TM2)
// for the single source code you clicked.
router.get("/map", async (req, res) => {
  res.type("application/fhir+json");

  const system = (req.query.system || "").trim(); // "ayurveda" | "siddha" | "unani"
  const code   = (req.query.code || "").trim();   // e.g. "EC-3"
  if (!system || !code) {
    return res.status(400).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", details: { text: "Missing system or code" } }]
    });
  }

  // Source CodeSystem URL used inside ConceptMap.group.source
  // (matches your ConceptMap file)
  const sourceUrl = `https://yourgithubusername.github.io/namaste-fhir/CodeSystem/namaste-${system}`;

  try {
    // Find the ConceptMap doc and extract only the groups/elements for this code.
    const agg = await conceptMapCol().aggregate([
      { $match: { resourceType: "ConceptMap", "group.source": sourceUrl } },
      { $unwind: "$group" },
      { $unwind: "$group.element" },
      { $match: { "group.element.code": code } },
      {
        $project: {
          _id: 0,
          id: 1, url: 1, version: 1, name: 1, title: 1, status: 1, publisher: 1,
          group: {
            source: "$group.source",
            target: "$group.target",
            element: {
              code: "$group.element.code",
              display: "$group.element.display",
              target: "$group.element.target" // full target array (code/display/equivalence)
            }
          }
        }
      },
      { $group: {
          _id: "$id",
          id: { $first: "$id" },
          url: { $first: "$url" },
          version: { $first: "$version" },
          name: { $first: "$name" },
          title: { $first: "$title" },
          status: { $first: "$status" },
          publisher: { $first: "$publisher" },
          groups: { $push: "$group" }
      }},
      {
        $project: {
          _id: 0,
          resourceType: { $literal: "ConceptMap" },
          id: 1, url: 1, version: 1, name: 1, title: 1, status: 1, publisher: 1,
          // Only the groups that contain this code (usually 2: MMS & TM2)
          group: "$groups"
        }
      }
    ]).toArray();

    if (!agg.length) {
      return res.status(404).json({
        resourceType: "OperationOutcome",
        issue: [{ severity: "warning", details: { text: `No ICD-11 mapping for ${system}:${code}` } }]
      });
    }

    // Respond with a ConceptMap fragment for that single code
    return res.json(agg[0]);
  } catch (e) {
    return res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", details: { text: e.message } }]
    });
  }
});
// -------------------------------------------------------------------------------


export default router;
