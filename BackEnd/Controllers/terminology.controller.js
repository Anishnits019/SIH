import NamasteTerm from '../Models/NamasteTerm.js';
import IcdMap from '../Models/IcdMap.js';

export function health(req, res) { res.json({ status: 'ok' }); }

export async function suggest(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });

  const scopes = (req.query.scope || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const filter = {
    ...(scopes.length ? { system: { $in: scopes } } : {}),
    $or: [
      { display: new RegExp(q, 'i') },
      { synonyms: { $elemMatch: { $regex: q, $options: 'i' } } }
    ]
  };

  const hits = await NamasteTerm
    .find(filter, { code: 1, system: 1, display: 1, synonyms: 1 })
    .limit(20).lean();

  res.json({ results: hits });
}

export async function fhirExpandAy(req, res) {
  const filterText = (req.query.filter || '').trim();
  const hits = await NamasteTerm
    .find(
      { system: 'ayurveda', $or: [
        { display: new RegExp(filterText, 'i') },
        { synonyms: { $elemMatch: { $regex: filterText, $options: 'i' } } }
      ]},
      { code: 1, display: 1 }
    ).limit(20).lean();

  res.json({
    resourceType: 'ValueSet',
    expansion: {
      total: hits.length,
      contains: hits.map(h => ({
        system: 'https://your.domain/fhir/CodeSystem/namaste',
        code: h.code,
        display: h.display
      }))
    }
  });
}

export async function translateFhir(req, res) {
  let code = null;
  if (req.body?.parameter?.length) {
    const params = req.body.parameter;
    code = params.find(p => p.name === 'code')?.valueCode || null;
  }
  if (!code && typeof req.body?.code === 'string') code = req.body.code;

  if (!code) {
    return res.json({ resourceType: 'Parameters', parameter: [{ name: 'result', valueBoolean: false }] });
  }

  const m = await IcdMap.findOne({ namasteCode: code }).lean();
  if (!m) return res.json({ resourceType: 'Parameters', parameter: [{ name: 'result', valueBoolean: false }] });

  const out = { resourceType: 'Parameters', parameter: [{ name: 'result', valueBoolean: true }] };
  if (m.icd11Tm2Code) {
    out.parameter.push({
      name: 'match',
      part: [
        { name: 'equivalence', valueCode: m.equivalence || 'related' },
        { name: 'concept', valueCoding: { system: 'http://id.who.int/icd/release/11/tm2', code: m.icd11Tm2Code } }
      ]
    });
  }
  if (m.icd11MmsCode) {
    out.parameter.push({
      name: 'match',
      part: [
        { name: 'equivalence', valueCode: m.equivalence || 'related' },
        { name: 'concept', valueCoding: { system: 'http://id.who.int/icd/release/11/mms', code: m.icd11MmsCode } }
      ]
    });
  }
  res.json(out);
}

function hasDoubleCoding(condition) {
  try {
    const systems = new Set((condition.code?.coding || []).map(c => c.system || ''));
    const hasNamaste = Array.from(systems).some(s => s.includes('namaste'));
    const hasIcd = Array.from(systems).some(s => s.includes('/icd/'));
    return hasNamaste && hasIcd;
  } catch { return false; }
}

export async function ingestBundle(req, res) {
  const bundle = req.body || {};
  if (bundle.resourceType !== 'Bundle') {
    return res.status(400).json({ error: 'resourceType must be Bundle' });
  }
  const errors = [];
  let ok = 0;
  for (const e of (bundle.entry || [])) {
    const r = e.resource || {};
    if (r.resourceType === 'Condition') {
      if (!hasDoubleCoding(r)) errors.push(`Condition/${r.id || 'new'} missing NAMASTE+ICD coding`);
      else ok += 1;
    }
  }
  res.json({ acceptedConditions: ok, errors });
}
