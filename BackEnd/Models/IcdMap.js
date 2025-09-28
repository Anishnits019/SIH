import mongoose from 'mongoose';

const IcdMapSchema = new mongoose.Schema(
  {
    namasteCode: { type: String, required: true, unique: true },
    icd11Tm2Code: { type: String },
    icd11MmsCode: { type: String },
    equivalence: { type: String, enum: ['equivalent','broader','narrower','related'], default: 'related' },
    notes: { type: String },
    confidence: { type: Number, min: 0, max: 1, default: 0.9 }
  },
  { timestamps: true }
);
const IcdMap = mongoose.model('IcdMap', IcdMapSchema);
export default IcdMap;
