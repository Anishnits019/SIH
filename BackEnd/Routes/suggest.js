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


// ---------------- COLLECTION BUNDLE ENDPOINT ----------------
// ---------------- COMPREHENSIVE COLLECTION BUNDLE ----------------
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
    // Generate UUIDs for all resources
    const patientUuid = uuidv4();
    const practitionerUuid = uuidv4();
    const conditionUuid = uuidv4();
    const observationUuid = uuidv4();
    const medicationUuid = uuidv4();
    const serviceRequestUuid = uuidv4();
    const allergyUuid = uuidv4();
    const encounterUuid = uuidv4();

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

    // 1. PATIENT RESOURCE
    const patientResource = {
      resourceType: "Patient",
      id: patientUuid,
      identifier: patient?.abha ? [{
        system: "https://abha.gov.in",
        value: patient.abha
      }] : undefined,
      name: [{
        use: "official",
        given: [patient?.given || "Clinical"],
        family: patient?.family || "User"
      }],
      gender: patient?.gender || "unknown",
      birthDate: patient?.birthDate || undefined
    };

    // Add age extension if age provided
    if (patient?.age) {
      patientResource.extension = [{
        url: "http://hl7.org/fhir/StructureDefinition/patient-age",
        valueAge: {
          value: patient.age,
          unit: "years",
          system: "http://unitsofmeasure.org",
          code: "a"
        }
      }];
    }

    // 2. PRACTITIONER RESOURCE (Doctor)
    const practitionerResource = {
      resourceType: "Practitioner",
      id: practitionerUuid,
      identifier: [{
        system: "http://hospital.org/practitioner",
        value: "drayush"
      }],
      name: [{
        use: "official",
        given: ["Ayush"],
        family: "Kumar",
        prefix: ["Dr."]
      }],
      qualification: [{
        code: {
          coding: [{
            system: "http://snomed.info/sct",
            code: "408443003",
            display: "Ayurvedic medicine"
          }]
        }
      }]
    };

    // 3. CONDITION RESOURCE (Diagnosis)
    const conditionCoding = [
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
    ];

    // Add TM2 code if available
    if (concept.tm2Code) {
      conditionCoding.push({
        system: "http://example.org/CodeSystem/tm2",
        code: concept.tm2Code,
        display: `TM2: ${concept.tm2Code}`
      });
    }

    // Add MMS code if available
    if (concept.mmsCode) {
      conditionCoding.push({
        system: "http://example.org/CodeSystem/mms",
        code: concept.mmsCode,
        display: `MMS: ${concept.mmsCode}`
      });
    }

    const conditionResource = {
      resourceType: "Condition",
      id: conditionUuid,
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
          display: "Active"
        }]
      },
      verificationStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "confirmed",
          display: "Confirmed"
        }]
      },
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-category",
          code: "encounter-diagnosis",
          display: "Encounter Diagnosis"
        }]
      }],
      subject: { reference: `Patient/${patientUuid}` },
      encounter: { reference: `Encounter/${encounterUuid}` },
      asserter: { reference: `Practitioner/${practitionerUuid}` },
      code: {
        coding: conditionCoding,
        text: `${concept.display}${icdCodes.length > 0 ? ` | ICD: ${icdCodes.map(icd => icd.display).join(', ')}` : ''}`
      }
    };

    // 4. OBSERVATION RESOURCE (Lab Tests)
    const observationResource = {
      resourceType: "Observation",
      id: observationUuid,
      status: "final",
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "laboratory",
          display: "Laboratory"
        }]
      }],
      code: {
        coding: [{
          system: "http://loinc.org",
          code: "26474-7",
          display: "Laboratory studies"
        }]
      },
      subject: { reference: `Patient/${patientUuid}` },
      encounter: { reference: `Encounter/${encounterUuid}` },
      performer: [{ reference: `Practitioner/${practitionerUuid}` }],
      note: [{
        text: "Laboratory tests to be determined based on clinical assessment"
      }]
    };

    // 5. MEDICATION RESOURCE
    const medicationResource = {
      resourceType: "Medication",
      id: medicationUuid,
      code: {
        coding: [{
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          code: "410942007",
          display: "Drug treatment"
        }]
      },
      status: "active"
    };

    // 6. SERVICE REQUEST (Lab Test Orders)
    const serviceRequestResource = {
      resourceType: "ServiceRequest",
      id: serviceRequestUuid,
      status: "active",
      intent: "order",
      category: [{
        coding: [{
          system: "http://snomed.info/sct",
          code: "108252007",
          display: "Laboratory procedure"
        }]
      }],
      code: {
        coding: [{
          system: "http://loinc.org",
          code: "26474-7",
          display: "Laboratory studies"
        }]
      },
      subject: { reference: `Patient/${patientUuid}` },
      encounter: { reference: `Encounter/${encounterUuid}` },
      requester: { reference: `Practitioner/${practitionerUuid}` },
      note: [{
        text: "Specific laboratory tests to be ordered based on diagnostic findings"
      }]
    };

    // 7. ALLERGY INTOLERANCE
    const allergyResource = {
      resourceType: "AllergyIntolerance",
      id: allergyUuid,
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
          code: "active",
          display: "Active"
        }]
      },
      verificationStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
          code: "unconfirmed",
          display: "Unconfirmed"
        }]
      },
      type: "allergy",
      category: ["medication"],
      criticality: "unable-to-assess",
      patient: { reference: `Patient/${patientUuid}` },
      note: [{
        text: "No known allergies reported"
      }]
    };

    // 8. ENCOUNTER RESOURCE
    const encounterResource = {
      resourceType: "Encounter",
      id: encounterUuid,
      status: "finished",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
        display: "ambulatory"
      },
      type: [{
        coding: [{
          system: "http://snomed.info/sct",
          code: "185317003",
          display: "Encounter for check up"
        }]
      }],
      subject: { reference: `Patient/${patientUuid}` },
      participant: [{
        individual: { reference: `Practitioner/${practitionerUuid}` }
      }],
      period: {
        start: new Date().toISOString()
      }
    };

    // Build bundle entries dynamically
    const bundleEntries = [
      {
        fullUrl: `http://example.org/fhir/Patient/${patientUuid}`,
        resource: patientResource
      },
      {
        fullUrl: `http://example.org/fhir/Practitioner/${practitionerUuid}`,
        resource: practitionerResource
      },
      {
        fullUrl: `http://example.org/fhir/Encounter/${encounterUuid}`,
        resource: encounterResource
      },
      {
        fullUrl: `http://example.org/fhir/Condition/${conditionUuid}`,
        resource: conditionResource
      },
      {
        fullUrl: `http://example.org/fhir/Observation/${observationUuid}`,
        resource: observationResource
      },
      {
        fullUrl: `http://example.org/fhir/Medication/${medicationUuid}`,
        resource: medicationResource
      },
      {
        fullUrl: `http://example.org/fhir/ServiceRequest/${serviceRequestUuid}`,
        resource: serviceRequestResource
      },
      {
        fullUrl: `http://example.org/fhir/AllergyIntolerance/${allergyUuid}`,
        resource: allergyResource
      }
    ];

    // Create Collection Bundle
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: bundleEntries
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

// ---------------- COMPREHENSIVE TRANSACTION BUNDLE ----------------
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
    // Generate UUIDs for all resources
    const patientUuid = uuidv4();
    const practitionerUuid = uuidv4();
    const conditionUuid = uuidv4();
    const observationUuid = uuidv4();
    const medicationUuid = uuidv4();
    const serviceRequestUuid = uuidv4();
    const allergyUuid = uuidv4();
    const encounterUuid = uuidv4();

    // Get concept data and ICD mappings
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

    // 1. PATIENT RESOURCE
    const patientResource = {
      resourceType: "Patient",
      id: patientUuid,
      identifier: patient?.abha ? [{
        system: "https://abha.gov.in",
        value: patient.abha
      }] : undefined,
      name: [{
        use: "official",
        given: [patient?.given || "Clinical"],
        family: patient?.family || "User"
      }],
      gender: patient?.gender || "unknown",
      birthDate: patient?.birthDate || undefined
    };

    if (patient?.age) {
      patientResource.extension = [{
        url: "http://hl7.org/fhir/StructureDefinition/patient-age",
        valueAge: {
          value: patient.age,
          unit: "years",
          system: "http://unitsofmeasure.org",
          code: "a"
        }
      }];
    }

    // 2. PRACTITIONER RESOURCE
    const practitionerResource = {
      resourceType: "Practitioner",
      id: practitionerUuid,
      identifier: [{
        system: "http://hospital.org/practitioner",
        value: "drayush"
      }],
      name: [{
        use: "official",
        given: ["Ayush"],
        family: "Kumar",
        prefix: ["Dr."]
      }],
      qualification: [{
        code: {
          coding: [{
            system: "http://snomed.info/sct",
            code: "408443003",
            display: "Ayurvedic medicine"
          }]
        }
      }]
    };

    // 3. ENCOUNTER RESOURCE
    const encounterResource = {
      resourceType: "Encounter",
      id: encounterUuid,
      status: "finished",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
        display: "ambulatory"
      },
      type: [{
        coding: [{
          system: "http://snomed.info/sct",
          code: "185317003",
          display: "Encounter for check up"
        }]
      }],
      subject: { reference: `urn:uuid:${patientUuid}` },
      participant: [{
        individual: { reference: `urn:uuid:${practitionerUuid}` },
        type: [{
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
            code: "PPRF",
            display: "Primary Performer"
          }]
        }]
      }],
      period: {
        start: new Date().toISOString(),
        end: new Date().toISOString()
      }
    };

    // 4. CONDITION RESOURCE
    const conditionCoding = [
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
    ];

    if (concept.tm2Code) {
      conditionCoding.push({
        system: "http://example.org/CodeSystem/tm2",
        code: concept.tm2Code,
        display: `TM2: ${concept.tm2Code}`
      });
    }

    if (concept.mmsCode) {
      conditionCoding.push({
        system: "http://example.org/CodeSystem/mms",
        code: concept.mmsCode,
        display: `MMS: ${concept.mmsCode}`
      });
    }

    const conditionResource = {
      resourceType: "Condition",
      id: conditionUuid,
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
          display: "Active"
        }]
      },
      verificationStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "confirmed",
          display: "Confirmed"
        }]
      },
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-category",
          code: "encounter-diagnosis",
          display: "Encounter Diagnosis"
        }]
      }],
      subject: { reference: `urn:uuid:${patientUuid}` },
      encounter: { reference: `urn:uuid:${encounterUuid}` },
      asserter: { reference: `urn:uuid:${practitionerUuid}` },
      code: {
        coding: conditionCoding,
        text: `${concept.display}${icdCodes.length > 0 ? ` | ICD: ${icdCodes.map(icd => icd.display).join(', ')}` : ''}`
      }
    };

    // 5. OBSERVATION RESOURCE
    const observationResource = {
      resourceType: "Observation",
      id: observationUuid,
      status: "final",
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "laboratory",
          display: "Laboratory"
        }]
      }],
      code: {
        coding: [{
          system: "http://loinc.org",
          code: "26474-7",
          display: "Laboratory studies"
        }]
      },
      subject: { reference: `urn:uuid:${patientUuid}` },
      encounter: { reference: `urn:uuid:${encounterUuid}` },
      performer: [{ reference: `urn:uuid:${practitionerUuid}` }],
      note: [{
        text: "Laboratory tests to be determined based on clinical assessment"
      }]
    };

    // 6. MEDICATION RESOURCE
    const medicationResource = {
      resourceType: "Medication",
      id: medicationUuid,
      code: {
        coding: [{
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          code: "410942007",
          display: "Drug treatment"
        }]
      },
      status: "active"
    };

    // 7. SERVICE REQUEST RESOURCE
    const serviceRequestResource = {
      resourceType: "ServiceRequest",
      id: serviceRequestUuid,
      status: "active",
      intent: "order",
      category: [{
        coding: [{
          system: "http://snomed.info/sct",
          code: "108252007",
          display: "Laboratory procedure"
        }]
      }],
      code: {
        coding: [{
          system: "http://loinc.org",
          code: "26474-7",
          display: "Laboratory studies"
        }]
      },
      subject: { reference: `urn:uuid:${patientUuid}` },
      encounter: { reference: `urn:uuid:${encounterUuid}` },
      requester: { reference: `urn:uuid:${practitionerUuid}` },
      note: [{
        text: "Specific laboratory tests to be ordered based on diagnostic findings"
      }]
    };

    // 8. ALLERGY INTOLERANCE RESOURCE
    const allergyResource = {
      resourceType: "AllergyIntolerance",
      id: allergyUuid,
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
          code: "active",
          display: "Active"
        }]
      },
      verificationStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
          code: "unconfirmed",
          display: "Unconfirmed"
        }]
      },
      type: "allergy",
      category: ["medication"],
      criticality: "unable-to-assess",
      patient: { reference: `urn:uuid:${patientUuid}` },
      note: [{
        text: "No known allergies reported"
      }]
    };

    // Create Transaction Bundle with POST requests
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
          fullUrl: `urn:uuid:${practitionerUuid}`,
          resource: practitionerResource,
          request: {
            method: "POST",
            url: "Practitioner"
          }
        },
        {
          fullUrl: `urn:uuid:${encounterUuid}`,
          resource: encounterResource,
          request: {
            method: "POST",
            url: "Encounter"
          }
        },
        {
          fullUrl: `urn:uuid:${conditionUuid}`,
          resource: conditionResource,
          request: {
            method: "POST",
            url: "Condition"
          }
        },
        {
          fullUrl: `urn:uuid:${observationUuid}`,
          resource: observationResource,
          request: {
            method: "POST",
            url: "Observation"
          }
        },
        {
          fullUrl: `urn:uuid:${medicationUuid}`,
          resource: medicationResource,
          request: {
            method: "POST",
            url: "Medication"
          }
        },
        {
          fullUrl: `urn:uuid:${serviceRequestUuid}`,
          resource: serviceRequestResource,
          request: {
            method: "POST",
            url: "ServiceRequest"
          }
        },
        {
          fullUrl: `urn:uuid:${allergyUuid}`,
          resource: allergyResource,
          request: {
            method: "POST",
            url: "AllergyIntolerance"
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