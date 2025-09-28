import axios from 'axios'
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'TOKEN1234'
export const http = axios.create({ baseURL: API_BASE, headers: { 'Authorization': `Bearer ${API_TOKEN}` } })
export async function health(){ const {data}=await http.get('/health'); return data }
export async function suggest(q,scopeCsv){ const {data}=await http.get('/suggest',{params:{q,scope:scopeCsv}}); return data.results||[] }
export async function expandAy(filter){ const {data}=await http.get('/fhir/ValueSet/namaste-ay/expand-test',{params:{filter}}); return data }
export async function translate(code){ const {data}=await http.post('/fhir/ConceptMap/translate-test',{code}); return data }
export async function ingestBundle(bundle){ const {data}=await http.post('/ingest/bundle', bundle); return data }
