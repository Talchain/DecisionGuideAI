// Local mirror of src/canvas/conversation/utils/applyPatch.ts — simplified for
// Node eval use. No React Flow, no zustand, no layout. Preserves op order,
// endpoint resolution (source ?? from, target ?? to), and cascade edge removal.

import crypto from 'node:crypto'

const OP_ORDER = {
  add_node: 0,
  add_edge: 1,
  update_node: 2,
  update_edge: 3,
  remove_edge: 4,
  remove_node: 5,
}

export function sortOps(ops) {
  return [...ops].sort((a, b) => (OP_ORDER[a.op] ?? 99) - (OP_ORDER[b.op] ?? 99))
}

export function emptyGraph() {
  return { nodes: [], edges: [] }
}

export function cloneGraph(g) {
  return {
    nodes: g.nodes.map((n) => ({ ...n, data: { ...n.data } })),
    edges: g.edges.map((e) => ({ ...e, data: { ...e.data } })),
  }
}

// Normalise a block's type identifier. CEE wraps blocks as
// `{ block_type, data: {...} }` on the wire; the UI flattens to `{ type, ...data }`.
export function blockType(b) {
  if (!b || typeof b !== 'object') return null
  if (typeof b.type === 'string') return b.type
  if (typeof b.block_type === 'string') return b.block_type
  return null
}

// Mirror of src/canvas/conversation/useConversation.ts:normalisePatchOp.
// CEE V2 ops are `{ op, path: "/nodes/<id>", value: {...} }`; UI legacy is
// `{ op, target_id, data }`. Normalise both into the legacy shape.
function normaliseOp(raw) {
  if (!raw || typeof raw !== 'object') return raw
  if (typeof raw.target_id === 'string') return raw
  if ('value' in raw || 'path' in raw) {
    const value = (raw.value != null && typeof raw.value === 'object') ? raw.value : {}
    const path = typeof raw.path === 'string' ? raw.path : ''
    const pathTail = path.split('/').pop() ?? ''
    const targetId = typeof value.id === 'string' ? value.id : pathTail
    return { op: raw.op, target_id: targetId, data: value }
  }
  return raw
}

// Extract all graph_patch operations from a block list, in arrival order.
// Handles both CEE wire format (block_type + data.operations) and UI-adapted
// format (type + operations), including V2 ops ({op, path, value}).
export function collectPatchOps(blocks) {
  const ops = []
  for (const b of blocks ?? []) {
    if (!b || blockType(b) !== 'graph_patch') continue
    // Ops may live at b.operations (flat) or b.data.operations (wrapped).
    const rawOps = Array.isArray(b.operations)
      ? b.operations
      : Array.isArray(b.data?.operations)
        ? b.data.operations
        : []
    for (const op of rawOps) ops.push(normaliseOp(op))
  }
  return ops
}

function buildNode(op) {
  const d = op.data ?? {}
  const kind = d.kind ?? d.type ?? 'unknown'
  const { kind: _k, type: _t, observed_state, ...rest } = d
  return {
    id: op.target_id,
    kind,
    data: {
      ...rest,
      label: d.label ?? 'Untitled',
      kind,
      ...(observed_state ? { observedState: observed_state } : {}),
    },
  }
}

function buildEdge(op) {
  const d = op.data ?? {}
  const source = d.source ?? d.from ?? ''
  const target = d.target ?? d.to ?? ''
  return { id: op.target_id, source, target, data: { ...d } }
}

// Apply a sorted op stream to a graph. Returns new graph + metadata about what changed.
export function applyOps(graphIn, ops) {
  const graph = cloneGraph(graphIn)
  const sorted = sortOps(ops)

  const newNodeIds = []
  const newEdgeIds = []
  const removedNodeIds = []
  const removedEdgeIds = []
  const skipped = []

  for (const op of sorted) {
    if (!op.target_id) {
      skipped.push({ op: op.op, reason: 'missing_target_id' })
      continue
    }
    switch (op.op) {
      case 'add_node': {
        if (!op.data) { skipped.push({ op: op.op, id: op.target_id, reason: 'no_data' }); break }
        graph.nodes.push(buildNode(op))
        newNodeIds.push(op.target_id)
        break
      }
      case 'add_edge': {
        if (!op.data) { skipped.push({ op: op.op, id: op.target_id, reason: 'no_data' }); break }
        const e = buildEdge(op)
        if (!e.source || !e.target) {
          skipped.push({ op: op.op, id: op.target_id, reason: 'missing_endpoints' })
          break
        }
        graph.edges.push(e)
        newEdgeIds.push(op.target_id)
        break
      }
      case 'update_node': {
        const n = graph.nodes.find((x) => x.id === op.target_id)
        if (!n) { skipped.push({ op: op.op, id: op.target_id, reason: 'node_not_found' }); break }
        const upd = { ...(op.data ?? {}) }
        if ('observed_state' in upd) { upd.observedState = upd.observed_state; delete upd.observed_state }
        n.data = { ...n.data, ...upd }
        break
      }
      case 'update_edge': {
        const e = graph.edges.find((x) => x.id === op.target_id)
        if (!e) { skipped.push({ op: op.op, id: op.target_id, reason: 'edge_not_found' }); break }
        const upd = { ...(op.data ?? {}) }
        const newSource = upd.source ?? upd.from
        const newTarget = upd.target ?? upd.to
        if (typeof newSource === 'string' && newSource) e.source = newSource
        if (typeof newTarget === 'string' && newTarget) e.target = newTarget
        delete upd.source; delete upd.from; delete upd.target; delete upd.to
        e.data = { ...e.data, ...upd }
        break
      }
      case 'remove_node': {
        const before = graph.nodes.length
        graph.nodes = graph.nodes.filter((n) => n.id !== op.target_id)
        if (graph.nodes.length !== before) removedNodeIds.push(op.target_id)
        // cascade
        const castOut = graph.edges.filter((e) => e.source === op.target_id || e.target === op.target_id)
        for (const e of castOut) removedEdgeIds.push(e.id)
        graph.edges = graph.edges.filter((e) => e.source !== op.target_id && e.target !== op.target_id)
        break
      }
      case 'remove_edge': {
        const before = graph.edges.length
        graph.edges = graph.edges.filter((e) => e.id !== op.target_id)
        if (graph.edges.length !== before) removedEdgeIds.push(op.target_id)
        break
      }
      default:
        skipped.push({ op: op.op, reason: 'unknown_op' })
    }
  }

  return { graph, newNodeIds, newEdgeIds, removedNodeIds, removedEdgeIds, skipped }
}

// Canonical JSON + short hash used to seed analysis_state.meta.response_hash.
export function canonicalHash(value, length = 16) {
  const json = canonicalJson(value)
  const h = crypto.createHash('sha256').update(json).digest('hex')
  return h.slice(0, length)
}

function canonicalJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']'
  const keys = Object.keys(v).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(v[k])).join(',') + '}'
}

export function newUuid() {
  return crypto.randomUUID()
}

// Trim conversation_history to MAX_HISTORY_PAIRS = 5 user+assistant turns (10 entries).
export function pushHistory(history, role, content) {
  const next = [...history, { role, content: content ?? '' }]
  // MAX 5 pairs = 10 messages
  if (next.length > 10) return next.slice(next.length - 10)
  return next
}

// Convert our local graph ({id, kind, data}) into the CEE wire shape for
// graph_state.nodes / graph_state.edges on turn requests. Mirrors the UI
// transform in src/canvas/conversation/useConversation.ts:1460-1501.

const RF_NODE_BLOCKLIST = new Set([
  'selected', 'dragging', 'measured', 'resizing',
  'position', 'positionAbsolute', 'draggable', 'selectable',
  'deletable', 'connectable', 'focusable', 'parentId', 'extent',
  'expandParent', 'ariaLabel', 'zIndex', 'hidden',
  'label', 'kind', 'type', 'uncertainty', 'interventions',
  '_baseline_snapshot',
])
const CEE_VALID_KINDS = new Set([
  'decision', 'event', 'outcome', 'goal', 'option', 'factor', 'risk', 'action',
])

function clamp01(v) { return Math.max(0, Math.min(1, v)) }

export function buildCeeGraphState(graph) {
  const nodes = (graph?.nodes ?? []).map((n) => {
    const d = n.data ?? {}
    const rawKind = d.kind ?? n.kind ?? 'factor'
    const out = {
      id: n.id,
      kind: CEE_VALID_KINDS.has(rawKind) ? rawKind : 'factor',
      label: d.label ?? n.id,
    }
    for (const [k, v] of Object.entries(d)) {
      if (RF_NODE_BLOCKLIST.has(k) || v === undefined) continue
      if (k === 'observedState') { out.observed_state = v; continue }
      out[k] = v
    }
    return out
  })

  const edges = (graph?.edges ?? []).map((e) => {
    const d = e.data ?? {}
    const weightValue = d.weight
    const dirValue = d.direction
    const weight = typeof weightValue === 'number' ? Math.max(0, Math.min(weightValue, 2.0)) : 0.5
    const direction = dirValue === 'negative' ? -1 : 1
    // Prefer an already-signed strength.mean if CEE gave us one.
    let mean
    if (d.strength && typeof d.strength.mean === 'number') mean = d.strength.mean
    else if (typeof d.strength_mean === 'number') mean = d.strength_mean
    else mean = direction * weight
    mean = Math.max(-1, Math.min(1, mean))
    const std = typeof d.strengthStd === 'number'
      ? Math.max(0, d.strengthStd)
      : (d.strength && typeof d.strength.std === 'number' ? Math.max(0, d.strength.std) : undefined)
    const rawExistsProb = d.beliefExists ?? d.confidence ?? d.belief ?? d.exists_probability
    const existsProb = typeof rawExistsProb === 'number' ? clamp01(rawExistsProb) : undefined
    const rawEffectDir = d.effect_direction ?? (dirValue === 'negative' ? 'negative' : dirValue === 'positive' ? 'positive' : undefined)
    const effectDir = rawEffectDir === 'positive' || rawEffectDir === 'negative' ? rawEffectDir : undefined
    const edgeType = typeof d.edge_type === 'string' ? d.edge_type : 'directed'
    return {
      from: e.source,
      to: e.target,
      strength: { mean, ...(std !== undefined ? { std } : {}) },
      ...(existsProb !== undefined ? { exists_probability: existsProb } : {}),
      ...(effectDir ? { effect_direction: effectDir } : {}),
      edge_type: edgeType,
    }
  })

  return { nodes, edges }
}

// Normalise stage_indicator which may be a plain string or { stage, ... }.
export function normaliseStage(stage) {
  if (!stage) return null
  if (typeof stage === 'string') return stage
  if (typeof stage === 'object' && typeof stage.stage === 'string') return stage.stage
  return null
}
