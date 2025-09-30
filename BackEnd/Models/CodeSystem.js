import mongoose from "mongoose";

const ConceptSchema = new mongoose.Schema(
  {
    system: { type: String, required: true },       // e.g. "namaste-siddha"
    code:   { type: String, required: true },       // e.g. "SI-0002"
    display:{ type: String, required: true },       // label
    definition: String,
    designation: [{ value: String, language: String }],

    // normalized fields for fast starts-with search
    displayKey: { type: String, index: true },
    english:    { type: String, default: "" },
    englishKey: { type: String, index: true }
  },
  { timestamps: true }
);

ConceptSchema.index({ system: 1, code: 1 }, { unique: true });

function norm(s = "") {
  return s.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
ConceptSchema.pre("save", function (next) {
  this.displayKey = norm(this.display);
  this.englishKey = norm(this.english || "");
  next();
});

export default mongoose.model("Concept", ConceptSchema);
