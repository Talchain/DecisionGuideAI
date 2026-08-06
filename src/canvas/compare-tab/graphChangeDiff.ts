/**
 * Canonical graph change classification for the Compare tab (ROADMAP 2.578).
 *
 * ⚠ WHY THIS MODULE EXISTS — the defect it removes.
 *
 * Compare rendered TWO claims about the same edit from TWO unrelated inputs, and
 * on 2026-08-05 an independent simulated-user review caught them contradicting
 * each other: after a link-strength edit `+0.50 → +0.80`, one card said BOTH
 * `• Rerun (no edits)` AND `Structure changed — comparison is directional only`.
 *
 *  · "Rerun (no edits)" came from `deriveEditSummary`, reading the persisted
 *    SCENARIO EVENT LOG. That log cannot see an in-session direct edit on the
 *    deployed build: `direct_edit` events are appended only under
 *    `isJourneyTabEnabled()` (absent from netlify.toml ⇒ false), the append is
 *    best-effort with a swallowed rejection, and the snapshot factory reads
 *    `_hydratedEvents`, which is written ONCE at scenario load and never
 *    refreshed. Three independent reasons, each alone sufficient.
 *  · "Structure changed" came from comparing `generateGraphHash`, which hashes
 *    edge `weight`/`confidence`/`belief` — a CONTENT hash. A value-only edit
 *    flips it, and the flip was being read as a STRUCTURE claim.
 *
 * Meanwhile **Staleness and Undo got the same edit right**, because both are
 * driven by the synchronous store edit chokepoint (`updateEdge` →
 * `pushToHistory` for Undo, → `invalidateAnalysisReady` for Staleness). They read
 * the GRAPH; Compare read a report ABOUT the graph that is never written.
 *
 * ⚠ THIS IS DELIBERATELY NOT A NEW DIFFER. The field list is NOT invented here:
 * it is `STALE_NODE_FIELDS` / `STALE_EDGE_FIELDS`, derived from the ratified
 * `analyticalNodeFields` registry — the SAME list, obtained the SAME way, that
 * `hasAnalyticalNodeChange` / `hasAnalyticalEdgeChange` use to decide an edit is
 * analysis-affecting, i.e. the list STALENESS ITSELF consumes. Comparison uses
 * that module's `deepEqual` for the same reason it does: structured values must
 * compare by content, so a re-normalised object with identical content is not a
 * change. Consequence, and the point of the whole exercise: **Compare and
 * Staleness cannot disagree about what counts as an edit**, and a field added to
 * the registry reaches both automatically (CLAUDE.md trap 12 — derive, never
 * mirror).
 *
 * IDENTITY. Elements are keyed by their own `id`, because that is the identity
 * the editor mutates (`updateEdge(id, …)`) and the identity the user sees
 * selected. `getEdgeKey` ("source->target") is NOT used as the key: it is a
 * dedup key, and two parallel edges between the same pair would collide into
 * one row and report a diff between two different relationships.
 */
import type { Node, Edge } from '@xyflow/react'
import {
  ANALYTICAL_NODE_DATA_FIELDS,
  ANALYTICAL_EDGE_FIELDS,
  deepEqual,
} from '../domain/analyticalChange'

// ---------------------------------------------------------------------------
// The projection
// ---------------------------------------------------------------------------

export interface ProjectedElement {
  /** The element's own id — the identity the editor mutates. */
  id: string
  /** Human label for display. Never used for matching. */
  label: string
  /** ReactFlow `type` (node kind). Part of identity for nodes: a kind change is structural. */
  type: string
  /** For edges only — endpoints. A re-pointed edge is a structural change. */
  source?: string
  target?: string
  /** Analysis-affecting `data.*` values, keyed by field name. */
  fields: Record<string, unknown>
}

export interface GraphProjection {
  nodes: ProjectedElement[]
  edges: ProjectedElement[]
}

function projectFields(
  data: Record<string, unknown> | undefined,
  fieldNames: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of fieldNames) {
    if (data && field in data) out[field] = data[field]
  }
  return out
}

/**
 * A canonical, comparable projection of the graph a run was computed over.
 *
 * Sorted by id so the projection is stable regardless of store ordering — two
 * runs over the same model must project identically or every rerun would read
 * as a change.
 */
export function buildGraphProjection(nodes: Node[], edges: Edge[]): GraphProjection {
  const projectedNodes = nodes.map((n) => {
    const data = n.data as Record<string, unknown> | undefined
    return {
      id: n.id,
      label: typeof data?.label === 'string' ? data.label : n.id,
      type: n.type ?? '',
      fields: projectFields(data, ANALYTICAL_NODE_DATA_FIELDS),
    }
  })

  const projectedEdges = edges.map((e) => {
    const data = e.data as Record<string, unknown> | undefined
    return {
      id: e.id,
      label: typeof data?.label === 'string' ? data.label : `${e.source} → ${e.target}`,
      type: e.type ?? '',
      source: e.source,
      target: e.target,
      fields: projectFields(data, ANALYTICAL_EDGE_FIELDS),
    }
  })

  const byId = (a: ProjectedElement, b: ProjectedElement) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  return {
    nodes: [...projectedNodes].sort(byId),
    edges: [...projectedEdges].sort(byId),
  }
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

export type ElementKind = 'node' | 'edge'

/** One analysis-affecting field that changed value, by element identity. */
export interface GraphFieldChange {
  element: ElementKind
  id: string
  label: string
  field: string
  before: unknown
  after: unknown
}

/** One element that entered or left the graph. */
export interface GraphMembershipChange {
  element: ElementKind
  id: string
  label: string
  op: 'added' | 'removed'
}

/**
 * `not_comparable`         — nothing licenses ANY claim: cross-regime, or no
 *                            comparable signal at either end. NOT a synonym for
 *                            "unchanged".
 * `unchanged`              — identical membership and identical analysis-affecting values.
 * `value_only`             — same membership, at least one value differs.
 * `structural`             — membership, endpoints or node kind differ.
 * `uncharacterised_change` — SOMETHING changed but we cannot say what.
 *
 * ⚠ `uncharacterised_change` exists so the persisted-run path does not have to
 * choose between two false statements. Those runs carry no graph, only a
 * CONTENT hash (the UI's `generateGraphHash`, CEE's `aag_v1`). A same-regime
 * inequality there is real evidence that the model moved — but it is NOT
 * evidence about the model's SHAPE, which is precisely the inference that
 * produced "Structure changed" for a `+0.50 → +0.80` value edit. Collapsing this
 * into `structural` re-introduces that defect; collapsing it into
 * `not_comparable` throws away a true signal. It is its own answer.
 */
export type GraphChangeKind =
  | 'not_comparable'
  | 'unchanged'
  | 'value_only'
  | 'structural'
  | 'uncharacterised_change'

export interface GraphChangeVerdict {
  kind: GraphChangeKind
  fieldChanges: GraphFieldChange[]
  membershipChanges: GraphMembershipChange[]
}

export const NOT_COMPARABLE_VERDICT: GraphChangeVerdict = {
  kind: 'not_comparable',
  fieldChanges: [],
  membershipChanges: [],
}

/** Something changed; no graph is available to say what. */
export const UNCHARACTERISED_CHANGE_VERDICT: GraphChangeVerdict = {
  kind: 'uncharacterised_change',
  fieldChanges: [],
  membershipChanges: [],
}

/** A shape change proven by counts alone — the elements involved are unknown. */
export const UNDETAILED_STRUCTURAL_VERDICT: GraphChangeVerdict = {
  kind: 'structural',
  fieldChanges: [],
  membershipChanges: [],
}

function indexById(elements: ProjectedElement[]): Map<string, ProjectedElement> {
  const map = new Map<string, ProjectedElement>()
  for (const el of elements) map.set(el.id, el)
  return map
}

function diffKind(
  kind: ElementKind,
  from: ProjectedElement[],
  to: ProjectedElement[],
  fieldChanges: GraphFieldChange[],
  membershipChanges: GraphMembershipChange[],
): { structural: boolean } {
  const fromById = indexById(from)
  const toById = indexById(to)
  let structural = false

  for (const el of to) {
    const prev = fromById.get(el.id)
    if (!prev) {
      membershipChanges.push({ element: kind, id: el.id, label: el.label, op: 'added' })
      structural = true
      continue
    }
    // A kind change, or an edge re-pointed to different endpoints, is a change
    // to the model's SHAPE — not a value edit.
    if (prev.type !== el.type || prev.source !== el.source || prev.target !== el.target) {
      structural = true
    }
    const fieldNames = new Set([...Object.keys(prev.fields), ...Object.keys(el.fields)])
    for (const field of [...fieldNames].sort()) {
      if (!deepEqual(prev.fields[field], el.fields[field])) {
        fieldChanges.push({
          element: kind,
          id: el.id,
          label: el.label,
          field,
          before: prev.fields[field],
          after: el.fields[field],
        })
      }
    }
  }

  for (const el of from) {
    if (!toById.has(el.id)) {
      membershipChanges.push({ element: kind, id: el.id, label: el.label, op: 'removed' })
      structural = true
    }
  }

  return { structural }
}

/**
 * The ONE classifier. Every label on the Compare surface reads this verdict, so
 * two labels on one screen cannot disagree — they have one input by construction.
 */
export function classifyGraphProjections(
  from: GraphProjection | null,
  to: GraphProjection | null,
): GraphChangeVerdict {
  if (from == null || to == null) return NOT_COMPARABLE_VERDICT

  const fieldChanges: GraphFieldChange[] = []
  const membershipChanges: GraphMembershipChange[] = []

  const nodeResult = diffKind('node', from.nodes, to.nodes, fieldChanges, membershipChanges)
  const edgeResult = diffKind('edge', from.edges, to.edges, fieldChanges, membershipChanges)

  if (nodeResult.structural || edgeResult.structural) {
    return { kind: 'structural', fieldChanges, membershipChanges }
  }
  if (fieldChanges.length > 0) {
    return { kind: 'value_only', fieldChanges, membershipChanges }
  }
  return { kind: 'unchanged', fieldChanges: [], membershipChanges: [] }
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** Field names as a user would read them. Unknown fields fall back to the raw name. */
const FIELD_LABELS: Record<string, string> = {
  weight: 'strength',
  direction: 'direction',
  strengthStd: 'uncertainty',
  confidence: 'confidence',
  beliefExists: 'likelihood it exists',
  beliefStrength: 'belief strength',
  belief: 'belief',
  exists_probability: 'likelihood it exists',
  probability: 'probability',
  impact: 'impact',
  observedState: 'observed value',
}

export function fieldDisplayLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

/**
 * The one no-edit sentence, defined once and imported by both the producer
 * (`deriveEditSummary`) and the consumer (`buildTransition`), so the consumer's
 * "is this the fabricated no-edit claim?" test cannot drift from the producer's
 * wording (CLAUDE.md trap 12).
 */
export const NO_EDITS_SUMMARY = 'Rerun (no edits)'

/** Shown when nothing licenses ANY claim about what changed. */
export const UNCHARACTERISED_SUMMARY = 'Changes to the model could not be characterised'

/** Shown when the model provably moved but no graph survives to say how. */
export const UNCHARACTERISED_CHANGE_SUMMARY =
  'The model changed between these runs — the details were not recorded for this run'

/**
 * A value as a user would read it. `undefined` (the field was absent at that end)
 * renders as an em dash — absence is shown as absence, never as a fabricated 0.
 */
export function formatChangeValue(value: unknown): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return JSON.stringify(value)
}
