export function makeCondition({ id, namaste, icd }) {
  return {
    resourceType: 'Condition',
    id,
    code: {
      coding: [
        { system: 'https://your.domain/fhir/CodeSystem/namaste', code: namaste.code, display: namaste.display },
        { system: 'http://id.who.int/icd/release/11/tm2', code: icd.code, display: icd.display || 'TM2 term' }
      ]
    }
  }
}
export function makeBundle(resources){
  return { resourceType:'Bundle', type:'collection', entry: resources.map(r=>({resource:r})) }
}
