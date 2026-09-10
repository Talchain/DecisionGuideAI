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
import {
  resolveEdgeSignedStrengthDisplay,
  resolveEdgeValueDisplay,
  resolveEdgeDirectionDisplay,
} from './edgeValueProvenance'
import { getEdgeLabel, type EdgeLabelMode } from './edgeLabels'

/** What the estate already calls a node with no label. Not re-invented here. */
export const UNTITLED_NODE_NAME = 'Untitled'

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
}: EdgeAccessibleNameInput): string {
  const base = `Connection from ${nameOrUntitled(sourceLabel)} to ${nameOrUntitled(targetLabel)}`
  const said = typeof description === 'string' ? description.trim() : ''
  return said.length > 0 ? `${base}. ${said}` : base
}

/* ------------------------------------------------------------------------- */


/** The minimum an edge must expose to be named. Structural, not React Flow's type. */
export interface NameableEdge {
  id: string
  source: string
  target: string
  data?: unknown
  ariaLabel?: string
}

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
 */
export function withEdgeAccessibleNames<E extends NameableEdge>(
  edges: readonly E[],
  nodeLabelById: ReadonlyMap<string, string>,
  mode: EdgeLabelMode,
): E[] {
  return edges.map(edge => {
    if (typeof edge.ariaLabel === 'string' && edge.ariaLabel.trim().length > 0) return edge
    return {
      ...edge,
      ariaLabel: buildEdgeAccessibleName({
        // Bound by the edge's OWN endpoint ids — never by position or order.
        sourceLabel: nodeLabelById.get(edge.source),
        targetLabel: nodeLabelById.get(edge.target),
        description: describeEdgeForSpeech(edge.data, mode),
      }),
    }
  })
}
