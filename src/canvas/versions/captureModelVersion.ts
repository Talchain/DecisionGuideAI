/**
 * Projection: live canvas graph -> a comparable `ModelVersion`.
 * British English: visualisation, colour, initialise.
 *
 * DERIVED, NOT MIRRORED (CLAUDE.md trap #12)
 * ------------------------------------------
 * The set of captured fields is DERIVED from whatever the node/edge data bag
 * actually carries — every own scalar field is captured — minus a small,
 * explicit denylist of PRESENTATION and EPHEMERAL keys. It is deliberately not
 * a hand-listed allowlist of domain fields.
 *
 * Why: `EdgeDataSchema` alone carries ~30 fields and grows; an allowlist would
 * be a list somebody must remember to update, it would drift silently, and the
 * drift would read as green — a version that simply stopped recording a field
 * the user edits, with nothing anywhere going red. That is the estate's
 * dominant defect class.
 *
 * THE TRADE-OFF, STATED HONESTLY: with a denylist, a newly-added PRESENTATION
 * field that nobody denylists will surface as a visible "change" in the What
 * Changed panel. That is the failure direction we want — a visible, obviously
 * wrong row that gets fixed, rather than a silently omitted user edit. Prefer
 * visible failure over confident wrongness.
 *
 * NEVER FABRICATE, NEVER RE-STAMP
 * -------------------------------
 * Absent stays absent. This module applies NO defaults: not `weight = 0.5`,
 * not `direction = 'positive'`, not a provenance marker. The four edge
 * `*Source` markers (`weightSource`, `beliefExistsSource`, `strengthStdSource`,
 * `directionSource`) are load-bearing honesty markers whose ABSENCE MEANS
 * DEFAULTED (`domain/edgeValueProvenance.ts`); stamping one here would launder
 * a UI default into a claim that somebody set the value. They are copied when
 * present and never invented.
 *
 * NO SCHEMA PARSE ON THE WAY IN. `AnyNodeDataSchema` is a strict discriminated
 * union that STRIPS undeclared keys, and several live renderer fields
 * (`success_threshold`, `goal_threshold_raw`, `goal_threshold_unit`,
 * `threshold_source`, `flagged_as_assumption`) are undeclared. Parsing here
 * would silently destroy user data (`domain/nodes.ts:325-366` documents this;
 * the passthrough variant is `AnyNodeDataImportSchema`). The data bag is read
 * as the open bag it is.
 */

import type { Edge, Node } from '@xyflow/react'
import type { FieldValue, ModelVersion, VersionOrigin, VersionedEdge, VersionedNode } from './types'

/**
 * Presentation, layout and ephemeral keys. Excluded because a change to one is
 * not a change to the user's REASONING — the thing a version records.
 *
 * Scoped to genuine presentation concerns only. When in doubt, leave a field
 * IN: an over-reported change is visible and correctable, an omitted one is
 * silent.
 */
const EXCLUDED_FIELDS: ReadonlySet<string> = new Set([
  // Identity / structure, carried explicitly on the version element instead.
  'id',
  'label',
  'type',
  'kind',
  // Edge geometry and styling.
  'style',
  'curvature',
  'pathType',
  'animated',
  'markerEnd',
  'markerStart',
  'sourceHandle',
  'targetHandle',
  // React Flow interaction state.
  'selected',
  'dragging',
  'hidden',
  'zIndex',
  'width',
  'height',
  'position',
  'positionAbsolute',
  // Bookkeeping that is not user reasoning.
  'schemaVersion',
  'templateId',
])

function isFieldValue(value: unknown): value is FieldValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

/**
 * Collect every own scalar field from a data bag, minus the denylist.
 *
 * `observedState` is the one nested object flattened (one level, dotted keys
 * such as `observedState.value`), because it is the primary carrier of factor
 * VALUES — precisely what a user edits and expects a version to record.
 * Other nested structures (`interventions`, `functionParams`, `causal_claims`,
 * `validation`, the `prior` distribution object) are NOT flattened and NOT
 * captured: they cannot be compared or captioned honestly at field level in
 * this slice, and inventing a rendering for them would be a fabricated claim.
 * DESIGN.md records this as a known, deliberate gap.
 */
function collectFields(bag: Readonly<Record<string, unknown>>): Record<string, FieldValue> {
  const fields: Record<string, FieldValue> = {}

  for (const [key, value] of Object.entries(bag)) {
    if (EXCLUDED_FIELDS.has(key)) continue

    if (isFieldValue(value)) {
      fields[key] = value
      continue
    }

    if (key === 'observedState' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [innerKey, innerValue] of Object.entries(value as Record<string, unknown>)) {
        if (isFieldValue(innerValue)) fields[`observedState.${innerKey}`] = innerValue
      }
    }
  }

  return fields
}

function labelOf(bag: Readonly<Record<string, unknown>>, fallback: string): string {
  const label = bag.label
  return typeof label === 'string' && label.length > 0 ? label : fallback
}

/**
 * Project a live canvas node into its versioned form.
 *
 * `kind` prefers the node's data `kind` (the backend classification) and falls
 * back to the React Flow `type`, matching how the canvas itself resolves a
 * node's taxonomy on ingest (`applyDraftResult.mapDraftNodeToCanvas`).
 */
export function captureNode(node: Node): VersionedNode {
  const bag = (node.data ?? {}) as Record<string, unknown>
  const kind = typeof bag.kind === 'string' ? bag.kind : (node.type ?? 'unknown')

  return {
    id: node.id,
    kind,
    label: labelOf(bag, node.id),
    fields: collectFields(bag),
  }
}

/** Project a live canvas edge into its versioned form. */
export function captureEdge(edge: Edge): VersionedEdge {
  const bag = (edge.data ?? {}) as Record<string, unknown>
  const label = bag.label

  return {
    id: edge.id,
    from: edge.source,
    to: edge.target,
    label: typeof label === 'string' ? label : undefined,
    fields: collectFields(bag),
  }
}

export interface CaptureOptions {
  name: string
  origin: VersionOrigin
  /** Unix ms. Injected so capture stays pure and testable. */
  createdAt: number
  /** Version id. Injected for the same reason. */
  id: string
  /**
   * Opaque analysis graph hash, ONLY when the caller already holds one from an
   * analysis fact.
   *
   * ⚠ NOT WIRED IN THIS SLICE, deliberately. There is no `graphHash` field on
   * `useCanvasStore`, and the two places a hash is actually held are both
   * unavailable to this lane: the compare-tab snapshot store (mid-retirement,
   * out of bounds) and local run history (whose header forbids backing a "what
   * changed" surface off it). Rather than compute one — which would mean
   * choosing between two same-named `generateGraphHash` twins, seeded and
   * seedless, that produce mutually incomparable values — the parameter is
   * accepted and left unsupplied. A version simply carries no hash today.
   * DESIGN.md states the precise ask that would make this stampable.
   */
  graphHash?: string
}

/**
 * Capture the current canvas graph as a `ModelVersion`.
 *
 * Pure: takes the graph and the metadata, returns a value. It does not read
 * the store, generate ids, or read the clock — callers supply those, so this
 * is fully testable and cannot drift with ambient state.
 */
export function captureModelVersion(
  nodes: readonly Node[],
  edges: readonly Edge[],
  options: CaptureOptions,
): ModelVersion {
  return {
    id: options.id,
    name: options.name,
    createdAt: options.createdAt,
    origin: options.origin,
    ...(options.graphHash === undefined ? {} : { graphHash: options.graphHash }),
    nodes: nodes.map(captureNode),
    edges: edges.map(captureEdge),
  }
}
