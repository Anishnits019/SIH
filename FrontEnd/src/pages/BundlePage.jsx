import { useMemo, useState } from 'react'
import { ingestBundle } from '../lib/api.js'
import { makeBundle, makeCondition } from '../lib/fhir.js'
import JsonCard from '../components/JsonCard.jsx'

export default function BundlePage() {
  const [rows, setRows] = useState([
    { id: 'c1', namaste: { code: 'AY-1234', display: 'Amavata' }, icd: { code: 'TM2-5678' } }
  ])
  const [response, setResponse] = useState(null)

  const bundle = useMemo(() => {
    const conditions = rows.map(r => makeCondition(r))
    return makeBundle(conditions)
  }, [rows])

  function addRow() {
    setRows(prev => [...prev, { id: `c${prev.length+1}`, namaste: { code: '', display: '' }, icd: { code: '' } }])
  }

  function updateRow(i, field, value) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  async function send() {
    const data = await ingestBundle(bundle)
    setResponse(data)
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card">
        <h3 className="font-semibold text-gray-800">Build Condition(s) with dual coding</h3>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.id} className="p-3 rounded-xl border">
              <div className="text-sm text-gray-500 mb-2">Condition ID: {r.id}</div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="NAMASTE code e.g. AY-1234"
                  value={r.namaste.code} onChange={e => updateRow(i, 'namaste', { ...r.namaste, code: e.target.value })} />
                <input className="input" placeholder="NAMASTE display (optional)"
                  value={r.namaste.display} onChange={e => updateRow(i, 'namaste', { ...r.namaste, display: e.target.value })} />
                <input className="input" placeholder="ICD-11 TM2 code e.g. TM2-5678"
                  value={r.icd.code} onChange={e => updateRow(i, 'icd', { ...r.icd, code: e.target.value })} />
                <input className="input" placeholder="ICD display (optional)"
                  value={r.icd.display || ''} onChange={e => updateRow(i, 'icd', { ...r.icd, display: e.target.value })} />
              </div>
            </div>
          ))}
          <button className="btn" onClick={addRow}>+ Add Condition</button>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary" onClick={send}>Send to /ingest/bundle</button>
        </div>
      </div>

      <div className="space-y-4">
        <JsonCard title="Bundle Preview" data={bundle} />
        <JsonCard title="Server Response" data={response} />
      </div>
    </div>
  )
}
