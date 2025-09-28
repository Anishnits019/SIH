import dotenv from 'dotenv';
dotenv.config();
import { connectDB } from './db.js';
import NamasteTerm from '../Models/NamasteTerm.js';
import IcdMap from '../Models/IcdMap.js';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  await connectDB();
  const terms = JSON.parse(await fs.readFile(path.join(__dirname, 'namaste.sample.json'), 'utf-8'));
  const maps  = JSON.parse(await fs.readFile(path.join(__dirname, 'icdmap.sample.json'), 'utf-8'));
  for (const t of terms) await NamasteTerm.updateOne({ code: t.code }, { $set: t }, { upsert: true });
  for (const m of maps)  await IcdMap.updateOne({ namasteCode: m.namasteCode }, { $set: m }, { upsert: true });
  console.log('✅ Seed complete'); process.exit(0);
}
run().catch(e => { console.error('Seed failed:', e); process.exit(1); });
