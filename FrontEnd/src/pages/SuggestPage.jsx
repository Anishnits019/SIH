import { useEffect, useMemo, useState } from 'react'
import { suggest, expandAy } from '../lib/api.js'
import JsonCard from '../components/JsonCard.jsx'
import CodeChip from '../components/CodeChip.jsx'

export default function SuggestPage() {
  const [q, setQ] = useState('ama')
  const [scope, setScope] = useState(['ayurveda'])
  const [results, setResults] = useState([])
  const [expand, setExpand] = useState(null)

  const scopeCsv = useMemo(() => scope.join(','), [scope])

  async function runSuggest() {
    if (!q) return
    const rows = await suggest(q, scopeCsv)
    setResults(rows)
  }

  async function runExpand() {
    const data = await expandAy(q)
    setExpand(data)
  }

  useEffect(() => { runSuggest() }, [])

  function toggleScope(s) {
    setScope(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card">
        <h3 className="font-semibold text-gray-800">Suggest (Auto-complete)</h3>
        <p className="text-sm text-gray-600 mb-3">Search NAMASTE terms by text and system.</p>
        <div className="flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} className="input" placeholder="Type e.g. ama, sandhi…" />
          <button onClick={runSuggest} className="btn btn-primary">Search</button>
        </div>
        <div className="mt-3 flex gap-2 items-center">
          <label className="text-sm text-gray-600">Scope:</label>
          {['ayurveda','siddha','unani'].map(s => (
            <button key={s} onClick={() => toggleScope(s)}
              className={'btn ' + (scope.includes(s) ? 'bg-blue-600 text-white border-blue-600' : '')}>
              {s}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2 max-h-72 overflow-auto">
          {results.map(r => (
            <div key={r.code} className="flex items-center justify-between p-2 rounded-xl border hover:bg-gray-50">
              <div className="space-y-1">
                <div className="font-medium">{r.display}</div>
                <div className="text-xs text-gray-500">{r.synonyms?.join(', ')}</div>
              </div>
              <CodeChip system={r.system} code={r.code} display={r.display} />
            </div>
          ))}
          {results.length === 0 && <div className="text-sm text-gray-500">No results (did you run <code>npm run seed</code>?).</div>}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-800">FHIR ValueSet $expand (Ayurveda)</h3>
        <p className="text-sm text-gray-600 mb-3">Same idea but in FHIR format.</p>
        <div className="flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} className="input" />
          <button onClick={runExpand} className="btn btn-primary">Expand</button>
        </div>
        <div className="mt-3">
          <JsonCard title="Expand result" data={expand} />
        </div>
      </div>
    </div>
  )
}
