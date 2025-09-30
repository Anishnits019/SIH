// models/ConceptMap.js
import mongoose from "mongoose";
const ConceptMap =
  mongoose.models.ConceptMap ||
  mongoose.model("ConceptMap", new mongoose.Schema({}, {
    strict: false,           // accept any fields (FHIR)
    collection: "conceptmaps"
  }));
export default ConceptMap;
