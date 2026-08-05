/**
 * ROADMAP 2.467 — CANVAS → CEE WIRE, for the registration seam only.
 *
 * The canvas and CEE do not speak the same graph. A ReactFlow node is
 * `{ id, type, position, data: { label, kind, type, … } }`; a CEE node is
 * `{ id, kind, label, … }`. A canvas edge is `{ source, target, data }`; a CEE
 * edge is `{ from, to, strength, … }`. `scenarios.graph` carries no layout, so
 * positions are dropped here rather than sent and ignored.
 *
 * ── WHY THIS IS A SECOND PROJECTION, AND WHY THAT IS THE RIGHT CALL ────────
 * `useConversation.ts` carries an inline canvas→CEE mapper of its own. It is
 * NOT reused, deliberately: that one builds the legacy `graph_state` field, and
 * the LIVE V5 turn path sends no graph at all (`buildPayload.ts` — measured
 * zero `graph_state`/`graph:` hits, ROADMAP 2.506). Coupling a new live seam to
 * a legacy producer would make one path's coercions the other's contract. The
 * duplication is real and is rowed for consolidation; it is not pretended away.
 *
 * ── DIVERGENCE IS REFUSED, NOT COERCED (2.467c rider) ──────────────────────
 * A canvas node carries THREE kind spellings: `data.kind`, `data.type`, and the
 * top-level `node.type` (ReactFlow's renderer key). The UI's own snapshot
 * normaliser writes `data.kind` and `data.type` to the SAME canonical value, so
 * a file where they DISAGREE is a hand-edited or third-party file that says two
 * things about the same node. The legacy turn mapper coerces an unrecognised
 * kind to `'factor'`. This one must not: a registration REPLACES the server's
 * model, and quietly relabelling a node during a replace is how the screen and
 * the server end up describing different graphs — the exact defect 2.467 exists
 * to close. Disagreement is refused and named; ABSENCE is resolved, because a
 * node with only one spelling is unambiguous about what it means.
 *
 * CEE re-runs an equivalent refusal at the write seam
 * (`normaliseGraphNodeKindField`). That is not a mirror of this: the two answer
 * different obligations — this one refuses to SEND an ambiguous graph, CEE's
 * refuses to STORE one from any caller, including callers that are not this UI.
 */
import type { Edge, Node } from '@xyflow/react'

/** The kinds CEE's node schema accepts. Mirrored deliberately — see the note. */
const CEE_VALID_KINDS = new Set([
  'decision',
  'event',
  'outcome',
  'goal',
  'option',
  'factor',
  'risk',
  'action',
])

/**
 * ReactFlow internals and canvas-only fields that must never reach
 * `scenarios.graph`. `label`/`kind`/`type` are listed because they are emitted
 * EXPLICITLY above the passthrough, not because they are unwanted.
 */
const CANVAS_ONLY_NODE_KEYS = new Set([
  'selected',
  'dragging',
  'measured',
  'resizing',
  'position',
  'positionAbsolute',
  'draggable',
  'selectable',
  'deletable',
  'connectable',
  'focusable',
  'parentId',
  'extent',
  'expandParent',
  'ariaLabel',
  'zIndex',
  'hidden',
  'label',
  'kind',
  'type',
  '_baseline_snapshot',
])

export interface RegistrationGraph {
  readonly nodes: ReadonlyArray<Record<string, unknown>>
  readonly edges: ReadonlyArray<Record<string, unknown>>
}

export type BuildRegistrationGraphResult =
  | { readonly ok: true; readonly graph: RegistrationGraph }
  | {
      readonly ok: false
      readonly reason: 'divergent_node_kind' | 'unresolvable_node_kind' | 'empty_graph'
      /** Node ids the caller can name to the user. Capped. */
      readonly nodeIds: readonly string[]
    }

const MAX_REPORTED_NODE_IDS = 10

function readKindCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/**
 * Project the canvas into the graph CEE will persist.
 *
 * Pure. Never throws. Returns a refusal rather than a best guess whenever the
 * canvas cannot be projected without inventing something.
 */
export function buildRegistrationGraph(
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
): BuildRegistrationGraphResult {
  if (nodes.length === 0) {
    return { ok: false, reason: 'empty_graph', nodeIds: [] }
  }

  const divergent: string[] = []
  const unresolvable: string[] = []
  const wireNodes: Array<Record<string, unknown>> = []

  for (const node of nodes) {
    const data = (node.data ?? {}) as Record<string, unknown>
    const dataKind = readKindCandidate(data.kind)
    const dataType = readKindCandidate(data.type)
    const rfType = readKindCandidate(node.type)

    // The two SEMANTIC spellings disagreeing is the ambiguity. `node.type` is
    // ReactFlow's renderer key and is a fallback, never a third opinion to
    // arbitrate — it is only consulted when neither semantic spelling exists.
    if (dataKind !== null && dataType !== null && dataKind !== dataType) {
      divergent.push(node.id)
      continue
    }

    const resolved = dataKind ?? dataType ?? rfType
    if (resolved === null || !CEE_VALID_KINDS.has(resolved)) {
      // No coercion to 'factor' here — see the header. A node CEE cannot type
      // is a node whose analysis meaning we would be inventing.
      unresolvable.push(node.id)
      continue
    }

    const out: Record<string, unknown> = {
      id: node.id,
      kind: resolved,
      label: readKindCandidate(data.label) ?? node.id,
    }
    for (const [key, value] of Object.entries(data)) {
      if (CANVAS_ONLY_NODE_KEYS.has(key) || value === undefined) continue
      // CEE spells the observed-value bundle `observed_state`.
      if (key === 'observedState') {
        out.observed_state = value
        continue
      }
      out[key] = value
    }
    wireNodes.push(out)
  }

  if (divergent.length > 0) {
    return {
      ok: false,
      reason: 'divergent_node_kind',
      nodeIds: divergent.slice(0, MAX_REPORTED_NODE_IDS),
    }
  }
  if (unresolvable.length > 0) {
    return {
      ok: false,
      reason: 'unresolvable_node_kind',
      nodeIds: unresolvable.slice(0, MAX_REPORTED_NODE_IDS),
    }
  }

  const wireEdges = edges.map((edge) => {
    const data = (edge.data ?? {}) as Record<string, unknown>
    const weightValue = data.weight
    const directionValue = data.direction
    const strengthStdValue = data.strengthStd
    // Canvas weight [0,2] + direction → the signed mean CEE expects, clamped
    // to [-1,+1] (UI-SEM-035).
    const weight = typeof weightValue === 'number' ? Math.max(0, Math.min(weightValue, 2)) : 0.5
    const direction = directionValue === 'negative' ? -1 : 1
    const mean = Math.max(-1, Math.min(1, direction * weight))
    const std = typeof strengthStdValue === 'number' ? Math.max(0, strengthStdValue) : undefined
    const rawExistsProb = data.beliefExists ?? data.confidence ?? data.belief
    const existsProbability = typeof rawExistsProb === 'number' ? clamp01(rawExistsProb) : undefined
    const effectDirection =
      directionValue === 'positive' || directionValue === 'negative' ? directionValue : undefined

    return {
      from: edge.source,
      to: edge.target,
      strength: { mean, ...(std !== undefined ? { std } : {}) },
      ...(existsProbability !== undefined ? { exists_probability: existsProbability } : {}),
      ...(effectDirection ? { effect_direction: effectDirection } : {}),
      edge_type: typeof data.edge_type === 'string' ? data.edge_type : 'directed',
    } satisfies Record<string, unknown>
  })

  return { ok: true, graph: { nodes: wireNodes, edges: wireEdges } }
}
