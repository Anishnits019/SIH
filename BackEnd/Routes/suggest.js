import express from "express";
import mongoose from "mongoose";
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const col = () => mongoose.connection.collection("namaste");
const conceptMapCol = () => mongoose.connection.collection("conceptmaps");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------- Suggest route ----------------
router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  const system = (req.query.system || "").trim();

  res.type("application/fhir+json");
  if (!q) {
    return res.json({ resourceType: "Bundle", type: "searchset", total: 0, entry: [] });
  }

  const rx = new RegExp("^" + esc(q), "i");
  const match = { "concept.display": rx };
  if (system) match.id = "namaste-" + system;

  try {
    const fragments = await col()
      .aggregate([
        { $unwind: "$concept" },
        { $match: match },
        {
          $group: {
            _id: "$id",
            id: { $first: "$id" },
            url: { $first: "$url" },
            version: { $first: "$version" },
            name: { $first: "$name" },
            title: { $first: "$title" },
            status: { $first: "$status" },
            publisher: { $first: "$publisher" },
            concepts: { $push: "$concept" },
          },
        },
        {
          $project: {
            _id: 0,
            resourceType: { $literal: "CodeSystem" },
            id: 1,
            url: 1,
            version: 1,
            name: 1,
            title: 1,
            status: 1,
            publisher: 1,
            content: { $literal: "fragment" },
            concept: { $slice: ["$concepts", 15] },
          },
        },
      ])
      .toArray();

    const bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: fragments.length,
      entry: fragments.map((cs) => ({ resource: cs })),
    };

    res.json(bundle);
  } catch (e) {
    res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", details: { text: e.message } }],
    });
  }
});

// ---------------- ConceptMap lookup ----------------
router.get("/map", async (req, res) => {
  res.type("application/fhir+json");
  const system = (req.query.system || "").trim();
  const code = (req.query.code || "").trim();
  if (!system || !code) {
    return res.status(400).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", details: { text: "Missing system or code" } }],
    });
  }

  const sourceUrl = `https://yourgithubusername.github.io/namaste-fhir/CodeSystem/namaste-${system}`;

  try {
    const agg = await conceptMapCol()
      .aggregate([
        { $match: { resourceType: "ConceptMap", "group.source": sourceUrl } },
        { $unwind: "$group" },
        { $unwind: "$group.element" },
        { $match: { "group.element.code": code } },
        {
          $project: {
            _id: 0,
            id: 1,
            url: 1,
            version: 1,
            name: 1,
            title: 1,
            status: 1,
            publisher: 1,
            group: {
              source: "$group.source",
              target: "$group.target",
              element: {
                code: "$group.element.code",
                display: "$group.element.display",
                target: "$group.element.target",
              },
            },
          },
        },
        {
          $group: {
            _id: "$id",
            id: { $first: "$id" },
            url: { $first: "$url" },
            version: { $first: "$version" },
            name: { $first: "$name" },
            title: { $first: "$title" },
            status: { $first: "$status" },
            publisher: { $first: "$publisher" },
            groups: { $push: "$group" },
          },
        },
        {
          $project: {
            _id: 0,
            resourceType: { $literal: "ConceptMap" },
            id: 1,
            url: 1,
            version: 1,
            name: 1,
            title: 1,
            status: 1,
            publisher: 1,
            group: "$groups",
          },
        },
      ])
      .toArray();

    if (!agg.length) {
      return res.status(404).json({
        resourceType: "OperationOutcome",
        issue: [{ severity: "warning", details: { text: `No ICD-11 mapping for ${system}:${code}` } }],
      });
    }

    return res.json(agg[0]);
  } catch (e) {
    res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", details: { text: e.message } }],
    });
  }
});

// ---------------- FHIR BUNDLE CREATION (Collection) ----------------
router.post("/fhir-bundle", async (req, res) => {
  res.type("application/fhir+json");
  const { system, code, patient } = req.body || {};
  
  if (!system || !code) {
    return res.status(400).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", details: { text: "Missing system or code" } }],
    });
  }

  try {
    // Generate UUIDs for FHIR compliance
    const patientUuid = uuidv4();
    const conditionUuid = uuidv4();

    // Get the complete concept data
    const conceptData = await col()
      .aggregate([
        { $match: { id: `namaste-${system}` } },
        { $unwind: "$concept" },
        { $match: { "concept.code": code } },
        { $project: { _id: 0, concept: 1 } }
      ])
      .toArray();

    const concept = conceptData[0]?.concept;
    
    if (!concept) {
      return res.status(404).json({
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", details: { text: "Concept not found" } }],
      });
    }

    // Get ICD mappings for this concept
    const sourceUrl = `https://yourgithubusername.github.io/namaste-fhir/CodeSystem/namaste-${system}`;
    const conceptMapData = await conceptMapCol()
      .aggregate([
        { $match: { resourceType: "ConceptMap", "group.source": sourceUrl } },
        { $unwind: "$group" },
        { $unwind: "$group.element" },
        { $match: { "group.element.code": code } },
        { $unwind: "$group.element.target" },
        {
          $project: {
            _id: 0,
            icdCode: "$group.element.target.code",
            icdDisplay: "$group.element.target.display",
            equivalence: "$group.element.target.equivalence"
          }
        }
      ])
      .toArray();

    // Extract ICD codes from mappings
    const icdCodes = conceptMapData.map(item => ({
      code: item.icdCode,
      display: item.icdDisplay,
      equivalence: item.equivalence || "relatedto"
    }));

    // Create Patient Resource
    const patientResource = {
      resourceType: "Patient",
      id: patientUuid,
      name: [{
        use: "official",
        given: [patient?.given || "Clinical"],
        family: patient?.family || "User"
      }],
      gender: patient?.gender || "unknown"
    };

    // Create Condition Resource with NAMASTE + ICD codes
    const conditionResource = {
      resourceType: "Condition",
      id: conditionUuid,
      subject: { reference: `Patient/${patientUuid}` },
      code: {
        coding: [
          // NAMASTE code
          {
            system: `http://namaste-fhir/CodeSystem/namaste-${system}`,
            code: concept.code,
            display: concept.display
          },
          // ICD-11 codes
          ...icdCodes.map(icd => ({
            system: "http://id.who.int/icd/release/11/26",
            code: icd.code,
            display: icd.display
          }))
        ],
        text: `${concept.display} / ${icdCodes.map(icd => icd.display).join(', ')}`
      }
    };

    // Add TM2 code extension if available
    if (concept.tm2Code) {
      conditionResource.extension = conditionResource.extension || [];
      conditionResource.extension.push({
        url: "http://example.org/StructureDefinition/tm2-code",
        valueString: concept.tm2Code
      });
    }

    // Add MMS code extension if available
    if (concept.mmsCode) {
      conditionResource.extension = conditionResource.extension || [];
      conditionResource.extension.push({
        url: "http://example.org/StructureDefinition/mms-code",
        valueString: concept.mmsCode
      });
    }

    // Create Collection Bundle
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          fullUrl: `http://example.org/fhir/Patient/${patientUuid}`,
          resource: patientResource
        },
        {
          fullUrl: `http://example.org/fhir/Condition/${conditionUuid}`,
          resource: conditionResource
        }
      ]
    };

    res.json(bundle);

  } catch (e) {
    res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [{
        severity: "error",
        code: "exception",
        details: { text: e.message }
      }],
    });
  }
});

// ---------------- COLLECTION BUNDLE ENDPOINT ----------------
router.post("/collection", async (req, res) => {
  res.type("application/fhir+json");
  const { system, code, patient } = req.body || {};
  
  if (!system || !code) {
    return res.status(400).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", details: { text: "Missing system or code" } }],
    });
  }

  try {
    const patientUuid = uuidv4();
    const conditionUuid = uuidv4();

    // Get concept data
    const conceptData = await col()
      .aggregate([
        { $match: { id: `namaste-${system}` } },
        { $unwind: "$concept" },
        { $match: { "concept.code": code } },
        { $project: { _id: 0, concept: 1 } }
      ])
      .toArray();

    const concept = conceptData[0]?.concept;
    
    if (!concept) {
      return res.status(404).json({
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", details: { text: "Concept not found" } }],
      });
    }

    // Get ICD mappings
    const sourceUrl = `https://yourgithubusername.github.io/namaste-fhir/CodeSystem/namaste-${system}`;
    const conceptMapData = await conceptMapCol()
      .aggregate([
        { $match: { resourceType: "ConceptMap", "group.source": sourceUrl } },
        { $unwind: "$group" },
        { $unwind: "$group.element" },
        { $match: { "group.element.code": code } },
        { $unwind: "$group.element.target" },
        {
          $project: {
            _id: 0,
            icdCode: "$group.element.target.code",
            icdDisplay: "$group.element.target.display"
          }
        }
      ])
      .toArray();

    const icdCodes = conceptMapData.map(item => ({
      code: item.icdCode,
      display: item.icdDisplay
    }));

    // Create Patient Resource
    const patientResource = {
      resourceType: "Patient",
      id: patientUuid,
      name: [{
        use: "official",
        given: [patient?.given || "Clinical"],
        family: patient?.family || "User"
      }],
      gender: patient?.gender || "unknown"
    };

    // Create Condition Resource
    const conditionResource = {
      resourceType: "Condition",
      id: conditionUuid,
      subject: { reference: `Patient/${patientUuid}` },
      code: {
        coding: [
          {
            system: `http://namaste-fhir/CodeSystem/namaste-${system}`,
            code: concept.code,
            display: concept.display
          },
          ...icdCodes.map(icd => ({
            system: "http://id.who.int/icd/release/11/26",
            code: icd.code,
            display: icd.display
          }))
        ],
        text: `${concept.display} / ${icdCodes.map(icd => icd.display).join(', ')}`
      }
    };

    // Create Collection Bundle
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          fullUrl: `http://example.org/fhir/Patient/${patientUuid}`,
          resource: patientResource
        },
        {
          fullUrl: `http://example.org/fhir/Condition/${conditionUuid}`,
          resource: conditionResource
        }
      ]
    };

    res.json(bundle);

  } catch (e) {
    res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [{
        severity: "error",
        code: "exception",
        details: { text: e.message }
      }],
    });
  }
});

// ---------------- TRANSACTION BUNDLE ENDPOINT ----------------
router.post("/transaction", async (req, res) => {
  res.type("application/fhir+json");
  const { system, code, patient } = req.body || {};
  
  if (!system || !code) {
    return res.status(400).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", details: { text: "Missing system or code" } }],
    });
  }

  try {
    const patientUuid = uuidv4();
    const conditionUuid = uuidv4();

    // Get concept data
    const conceptData = await col()
      .aggregate([
        { $match: { id: `namaste-${system}` } },
        { $unwind: "$concept" },
        { $match: { "concept.code": code } },
        { $project: { _id: 0, concept: 1 } }
      ])
      .toArray();

    const concept = conceptData[0]?.concept;
    
    if (!concept) {
      return res.status(404).json({
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", details: { text: "Concept not found" } }],
      });
    }

    // Get ICD mappings
    const sourceUrl = `https://yourgithubusername.github.io/namaste-fhir/CodeSystem/namaste-${system}`;
    const conceptMapData = await conceptMapCol()
      .aggregate([
        { $match: { resourceType: "ConceptMap", "group.source": sourceUrl } },
        { $unwind: "$group" },
        { $unwind: "$group.element" },
        { $match: { "group.element.code": code } },
        { $unwind: "$group.element.target" },
        {
          $project: {
            _id: 0,
            icdCode: "$group.element.target.code",
            icdDisplay: "$group.element.target.display"
          }
        }
      ])
      .toArray();

    const icdCodes = conceptMapData.map(item => ({
      code: item.icdCode,
      display: item.icdDisplay
    }));

    // Create Patient Resource
    const patientResource = {
      resourceType: "Patient",
      id: patientUuid,
      name: [{
        use: "official",
        given: [patient?.given || "Clinical"],
        family: patient?.family || "User"
      }],
      gender: patient?.gender || "unknown"
    };

    // Create Condition Resource
    const conditionResource = {
      resourceType: "Condition",
      id: conditionUuid,
      subject: { reference: `urn:uuid:${patientUuid}` },
      code: {
        coding: [
          {
            system: `http://namaste-fhir/CodeSystem/namaste-${system}`,
            code: concept.code,
            display: concept.display
          },
          ...icdCodes.map(icd => ({
            system: "http://id.who.int/icd/release/11/26",
            code: icd.code,
            display: icd.display
          }))
        ],
        text: `${concept.display} / ${icdCodes.map(icd => icd.display).join(', ')}`
      }
    };

    // Create Transaction Bundle
    const bundle = {
      resourceType: "Bundle",
      type: "transaction",
      entry: [
        {
          fullUrl: `urn:uuid:${patientUuid}`,
          resource: patientResource,
          request: {
            method: "POST",
            url: "Patient"
          }
        },
        {
          fullUrl: `urn:uuid:${conditionUuid}`,
          resource: conditionResource,
          request: {
            method: "POST",
            url: "Condition"
          }
        }
      ]
    };

    res.json(bundle);

  } catch (e) {
    res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [{
        severity: "error",
        code: "exception",
        details: { text: e.message }
      }],
    });
  }
});

export default router;