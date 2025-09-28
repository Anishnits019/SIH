import mongoose from 'mongoose';

const NamasteTermSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, required: true },
    system: { type: String, enum: ['ayurveda', 'siddha', 'unani'], required: true },
    display: { type: String, required: true },
    definition: { type: String },
    synonyms: { type: [String], default: [] },
    status: { type: String, default: 'active' },
    version: { type: String, default: 'v0' }
  },
  { timestamps: true }
);
NamasteTermSchema.index({ display: 'text', synonyms: 'text' });
const NamasteTerm = mongoose.model('NamasteTerm', NamasteTermSchema);
export default NamasteTerm;
