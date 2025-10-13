import type { PlcImportData, PlcNode, PlcEdge } from './schema'

export type PlcImport = PlcImportData
export type ValidateOk = { ok: true; data: PlcImport }
export type ValidateErr = { ok: false; errors: string[] }
export type ValidateResult = ValidateOk | ValidateErr

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'

export function validatePlcImportText(text: string): ValidateResult {
  if (typeof text !== 'string') return { ok: false, errors: ['(root) input must be a string'] }
  if (text.length > 1_000_000) return { ok: false, errors: ['(root) payload too large (>1MB)'] }
  try {
    const normalized = text.replace(/\r\n?/g, '\n').trim()
    const parsed = JSON.parse(normalized)
    return validatePlcImport(parsed)
  } catch {
    return { ok: false, errors: ['(root) invalid JSON'] }
  }
}

export function validatePlcImport(input: unknown): ValidateResult {
  const errors: string[] = []
  const add = (m: string) => errors.push(m)
  if (!isObj(input)) return { ok: false, errors: ['(root) must be an object'] }

  const o = input as any
  const nodesRaw = o.nodes
  const edgesRaw = o.edges

  if (!Array.isArray(nodesRaw)) add('/nodes must be an array')
  if (!Array.isArray(edgesRaw)) add('/edges must be an array')
  if (errors.length) return { ok: false, errors }

  const nodesCap = 5000
  const edgesCap = 10000
  if (nodesRaw.length > nodesCap || edgesRaw.length > edgesCap) {
    return { ok: false, errors: [`(root) too many items: nodes>${nodesCap} or edges>${edgesCap}`] }
  }

  const idSet = new Set<string>()
  const nodes: PlcNode[] = []
  for (let i = 0; i < nodesRaw.length; i++) {
    const n = nodesRaw[i]
    if (!isObj(n)) { add(`/nodes/${i} must be an object`); continue }
    const id = (n as any).id
    const x = (n as any).x
    const y = (n as any).y
    const label = (n as any).label
    if (typeof id !== 'string' || id.trim() === '') add(`/nodes/${i}/id must be a non-empty string`)
    else if (idSet.has(id)) add(`/nodes/${i}/id duplicate: "${id}"`)
    else idSet.add(id)
    if (typeof x !== 'number' || !Number.isFinite(x)) add(`/nodes/${i}/x must be a finite number`)
    if (typeof y !== 'number' || !Number.isFinite(y)) add(`/nodes/${i}/y must be a finite number`)
    if (label != null && typeof label !== 'string') add(`/nodes/${i}/label must be string if provided`)
    nodes.push({ id: id as any, x: x as any, y: y as any, label: label as any })
  }

  const edges: PlcEdge[] = []
  const missingRefs: string[] = []
  for (let i = 0; i < edgesRaw.length; i++) {
    const e = edgesRaw[i]
    if (!isObj(e)) { add(`/edges/${i} must be an object`); continue }
    const from = (e as any).from
    const to = (e as any).to
    const label = (e as any).label
    if (typeof from !== 'string' || from.trim() === '') add(`/edges/${i}/from must be a non-empty string`)
    if (typeof to !== 'string' || to.trim() === '') add(`/edges/${i}/to must be a non-empty string`)
    if (label != null && typeof label !== 'string') add(`/edges/${i}/label must be string if provided`)
    if (typeof from === 'string' && !idSet.has(from)) missingRefs.push(`/edges/${i}/from references missing id "${from}"`)
    if (typeof to === 'string' && !idSet.has(to)) missingRefs.push(`/edges/${i}/to references missing id "${to}"`)
    edges.push({ from: from as any, to: to as any, label: label as any })
  }

  if (missingRefs.length) missingRefs.forEach(add)

  if (errors.length) return { ok: false, errors }
  return { ok: true, data: { nodes, edges } }
}
