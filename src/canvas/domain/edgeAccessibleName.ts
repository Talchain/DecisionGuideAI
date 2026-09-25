/**
 * edgeAccessibleName — what a connection is CALLED on the assistive channel.
 *
 * ## The defect this closes, measured on the deployed build
 *
 * React Flow names every edge for itself when the edge object carries no
 * `ariaLabel`: `Edge from ${source} to ${target}` — and those are our internal
 * node ids. Measured on staging bundle `e5a62322` with a live model:
 * **21 of 21 connections announced raw hex**, e.g.
 * *"Edge from 2891dabb to c12af5de"*. The contrast control in the same probe:
 * node cards announce prose (*"option node: Outsource Overflow to a
 * Third-Party Logistics Provider"*), so the surface can plainly carry it — the
 * edges simply never supplied one.
 *
 * A screen-reader user could therefore hear the whole causal structure of their
 * own model as pairs of hex strings. The shared visual model is supposed to be
 * a living representation of the team's reasoning; for that user it was a list
 * of identifiers.
 *
 * ## ⚠ WHY THE RICH NAME `StyledEdge` ALREADY BUILDS DID NOT SAVE US
 *
 * `StyledEdge` composes a careful accessible name from `edgeDescription`, and
 * its own header records the rule that forced it: *"`aria-label` REPLACES
 * descendant text"*. That name is real. It is also **on an inner element that
 * only exists while the edge's label is visible** — labels are decluttered away
 * at low zoom — so the same probe found `edgesWithInnerAria: 0` while all 21
 * outer groups carried the hex default. The careful work was there; nothing
 * carried it to the element assistive technology actually names.
 *
 * So this is not a second naming vocabulary competing with that one. It puts a
 * name on the OUTER group, which is the element React Flow names, and it builds
 * it from **the same `getEdgeLabel` call** `StyledEdge` paints with, so the two
 * channels cannot drift into saying different things.
 *
 * ## ⛔ WHAT IT REFUSES TO INVENT
 *
 * The description is passed in already resolved. This module never reaches for
 * a default: an edge whose strength or likelihood nobody set contributes no
 * clause at all, because `getEdgeLabel`'s inputs are provenance-gated upstream
 * (`edgeValueProvenance.ts`) and a fabricated "Raises 50%" spoken to someone who
 * cannot see the canvas is exactly as false as one drawn on it — and harder to
 * challenge, because there is nothing on screen to contradict it.
 *
 * A node whose label is missing is named `Untitled`, matching
 * `useNodeConnections` and `usePreAnalysisInbound` rather than minting a third
 * word for the same absence.
 */
import type { Edge } from '@xyflow/react'
import {
  resolveEdgeSignedStrengthDisplay,
  resolveEdgeValueDisplay,
  resolveEdgeDirectionDisplay,
} from './edgeValueProvenance'
import { getEdgeLabel, type EdgeLabelMode } from './edgeLabels'
import { edgeDoubleClickAffordance } from '../edges/edgeAffordance'
import { isStructuralEdge } from './edgeUtils'
import type { EdgeData } from './edges'

/** What the estate already calls a node with no label. Not re-invented here. */
export const UNTITLED_NODE_NAME = 'Untitled'

/**
 * A14 — a structural link (decision→option organisational wiring, or the
 * canonical structural strength signature `isStructuralEdge` also detects) is
 * not a causal claim, so it carries no strength word, no confidence badge and
 * no strength-setting gesture, on EITHER channel. This is the spoken half of
 * the same fact `StyledEdge`'s own `structuralTooltip` shows a sighted user.
 * Not imported from there: `StyledEdge` derives its own local structural
 * flag from `edge_type`/node-kind inference for its visual sub-type text,
 * where this module uses the one shared `isStructuralEdge` predicate —
 * matching the audit's instruction, not a second vocabulary for the same
 * fact.
 */
export const STRUCTURAL_EDGE_ACCESSIBLE_DESCRIPTION = 'Structural link (not analysed)'

export interface EdgeAccessibleNameInput {
  /** The source node's visible label, or `null`/absent when it has none. */
  sourceLabel?: string | null
  /** The target node's visible label, or `null`/absent when it has none. */
  targetLabel?: string | null
  /**
   * The edge's own painted description (`getEdgeLabel(...).label`), or empty
   * when this edge says nothing. NEVER synthesised in this module.
   */
  description?: string | null
  /**
   * What a double-click on this edge actually does, from
   * `edgeDoubleClickAffordance`. Absent or empty adds no clause.
   *
   * ⛔ IT IS PASSED IN, RESOLVED, for the same reason `description` is: this
   * module never decides whether an edit can land. The one derivation lives
   * beside the predicate the panel fences on, and both channels CALL it.
   */
  affordance?: string | null
}

function nameOrUntitled(label: string | null | undefined): string {
  const trimmed = typeof label === 'string' ? label.trim() : ''
  return trimmed.length > 0 ? trimmed : UNTITLED_NODE_NAME
}

/**
 * ⭐ THE ONE SENTENCE A CONNECTION ANSWERS TO.
 *
 * "Connection from X to Y" — the product's own word for an edge (the inspector
 * heading is *Connections*, the unset affordance says *"open this connection to
 * estimate it"*), so the assistive channel does not teach a fourth noun for a
 * thing the UI already names twice.
 *
 * Direction is kept explicit ("from … to …") because on a causal graph it is
 * the load-bearing half: a sighted user reads it off the arrowhead, and that is
 * precisely the cue this channel cannot carry.
 */
export function buildEdgeAccessibleName({
  sourceLabel,
  targetLabel,
  description,
  affordance,
}: EdgeAccessibleNameInput): string {
  const base = `Connection from ${nameOrUntitled(sourceLabel)} to ${nameOrUntitled(targetLabel)}`
  const said = typeof description === 'string' ? description.trim() : ''
  const offered = typeof affordance === 'string' ? affordance.trim() : ''
  // Clauses in the order a listener needs them: WHAT it is, WHAT it says, and
  // only then what can be done about it. The affordance last because it is the
  // only clause that is about the interface rather than about the model.
  return [base, said, offered].filter(c => c.length > 0).join('. ')
}

/* ------------------------------------------------------------------------- */


/** The minimum an edge must expose to be named. Structural, not React Flow's type. */
export interface NameableEdge {
  id: string
  source: string
  target: string
  data?: unknown
  ariaLabel?: string
  /**
   * ROW 35 (contract §01: "edges focusable … role=button"). Read at the
   * INSTALLED `@xyflow/react@12.10.2` runtime bytes (`dist/esm/index.mjs`,
   * `EdgeWrapper`): `role: edge.ariaRole ?? (isFocusable ? 'group' : 'img')`
   * — the wrapper already honours a caller-supplied role, it just never
   * received one, so every focusable edge announced the generic `group`.
   * ⚠ The pinned package's own `.d.ts` (`@xyflow/system@0.0.76`,
   * `types/edges.d.ts`) does not YET declare this field even though the
   * compiled runtime reads it — verified by running the fixture in
   * `edgeAccessibleName.spec.ts` against the installed bytes, not assumed
   * from the type file.
   */
  ariaRole?: string
}

/**
 * ROW 35's role word, named once so the seam and its test read the same
 * literal rather than two authors agreeing on "button" independently
 * (CLAUDE.md trap 12).
 */
export const EDGE_ARIA_ROLE = 'button'

/**
 * The description this edge PAINTS, resolved through the same gates the canvas
 * uses. Exported so a test can prove the two channels agree rather than
 * assuming it.
 */
export function describeEdgeForSpeech(data: unknown, mode: EdgeLabelMode): string {
  const d = (data ?? undefined) as Record<string, unknown> | undefined
  const strength = resolveEdgeSignedStrengthDisplay(d)
  const likelihood = resolveEdgeValueDisplay(d, 'beliefExists')
  const direction = resolveEdgeDirectionDisplay(d)
  return getEdgeLabel(strength, likelihood, direction, mode).label
}

/**
 * ⭐⭐ NAME EVERY EDGE — the completeness property, applied at ONE seam.
 *
 * ⚠ THIS IS DELIBERATELY NOT DONE AT THE CONSTRUCTION SITES. `type: 'styled'`
 * edges are built in at least three places (`store.ts` twice,
 * `ReactFlowGraph.tsx`), and naming them there would be a hand-maintained
 * mirror: the next construction site added would silently ship hex again and
 * every test would stay green (CLAUDE.md trap 12). Applied once, at the seam
 * that feeds `<ReactFlow>`, it cannot be forgotten by construction.
 *
 * ⛔ AN EXISTING `ariaLabel` IS NEVER OVERWRITTEN. If a future caller has a
 * better name for a specific edge, this must not silently replace it — a
 * blanket rewrite is how a considered name gets flattened by a generic one.
 *
 * ⛔ AND NEITHER IS AN EXISTING `ariaRole`, for the same reason and checked
 * independently of `ariaLabel` — a caller could supply one without the other.
 */
export function withEdgeAccessibleNames<E extends NameableEdge>(
  edges: readonly E[],
  nodeLabelById: ReadonlyMap<string, string>,
  mode: EdgeLabelMode,
  /**
   * A14 — resolves a node's kind by id, so each edge's structural status can
   * be asked of the one shared `isStructuralEdge` predicate rather than
   * re-derived here. Optional and defaulting to "no kind known" (never
   * structural by the node-kind arm) so existing callers that have not been
   * updated keep their prior behaviour rather than silently changing it.
   */
  getNodeKind: (nodeId: string) => string | undefined = () => undefined,
): E[] {
  return edges.map(edge => {
    const hasOwnAriaLabel = typeof edge.ariaLabel === 'string' && edge.ariaLabel.trim().length > 0
    const hasOwnAriaRole = typeof edge.ariaRole === 'string' && edge.ariaRole.trim().length > 0
    if (hasOwnAriaLabel && hasOwnAriaRole) return edge
    const structural = isStructuralEdge(edge as unknown as Edge<EdgeData>, getNodeKind)
    return {
      ...edge,
      ...(hasOwnAriaLabel ? {} : {
        ariaLabel: buildEdgeAccessibleName({
          // Bound by the edge's OWN endpoint ids — never by position or order.
          sourceLabel: nodeLabelById.get(edge.source),
          targetLabel: nodeLabelById.get(edge.target),
          // A14 — a structural link states what it structurally IS, never a
          // strength word it does not carry.
          description: structural
            ? STRUCTURAL_EDGE_ACCESSIBLE_DESCRIPTION
            : describeEdgeForSpeech(edge.data, mode),
          // ⭐ THE OUTER GROUP IS WHERE THIS HAS TO LAND. `StyledEdge` carries the
          // same sentence, but on an INNER element that exists only while the
          // edge's label renders — the exact asymmetry this module's header was
          // written about. Measured on deployed `7ec3fed2`: 39 connections, 39
          // announcing a strength, 3 rendering a label, and 0 announcing the
          // affordance. Passed through `edgeDoubleClickAffordance` so the spoken
          // word and the hovered word cannot drift apart.
          //
          // A14 — NO GESTURE on a structural link: there is no strength to
          // set, so "Double-click to set its strength" would announce a
          // control that does nothing.
          affordance: structural ? null : edgeDoubleClickAffordance(edge as never),
        }),
      }),
      ...(hasOwnAriaRole ? {} : { ariaRole: EDGE_ARIA_ROLE }),
    }
  })
}
