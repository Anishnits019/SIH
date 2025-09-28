import { useState } from 'react'
import { translate } from '../lib/api.js'
import JsonCard from '../components/JsonCard.jsx'

export default function TranslatePage() {
  const [code, setCode] = useState('AY-1234')
  const [result, setResult] = useState(null)

  async function run() {
    const data = await translate(code)
    setResult(data)
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card">
        <h3 className="font-semibold text-gray-800">Translate NAMASTE → ICD-11</h3>
        <p className="text-sm text-gray-600 mb-3">Uses ConceptMap translate.</p>
        <div className="flex gap-2">
          <input value={code} onChange={e => setCode(e.target.value)} className="input" />
          <button onClick={run} className="btn btn-primary">Translate</button>
        </div>
        <div className="mt-3 text-sm text-gray-500">
          Try <code>AY-1234</code> or <code>AY-2233</code> (from seed).
        </div>
      </div>
      <JsonCard title="Translate result" data={result} />
    </div>
  )
}
