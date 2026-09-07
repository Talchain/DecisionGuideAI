/**
 * edgePresentation — THE single authority for a causal edge's stroke colour,
 * dash pattern and direction mark.
 *
 * (The direction mark joined on 7 Sep 2026; its own derivation is at
 * `EDGE_DIRECTION_MARKER_RULES` near the foot of this file. It follows the same
 * three rules below — an ordered array, a named rule returned, the order
 * asserted in a spec.)
 *
 * WHY THIS MODULE EXISTS (measured defect, deployed staging bundle, 17 Aug 2026)
 * -----------------------------------------------------------------------------
 * StyledEdge resolved both channels with two ordered early-return chains written
 * inline in a `style` prop. The order was never stated anywhere, so it was not a
 * decision anyone could review — it was the sequence the branches happened to be
 * added in. Two consequences shipped:
 *
 *   1. `isContested` returned BEFORE the polarity stroke was ever evaluated, so
 *      a contested edge rendered warning-orange UNCONDITIONALLY and its polarity
 *      was unreachable. Read the producer's own enum (`src/types/validation.ts`):
 *      `contested` means "two independent AI passes disagree on this edge's
 *      PARAMETERS", and of the five `ContestedReason` members only `sign_flip`
 *      is a disagreement about the DIRECTION. For the other four —
 *      `strength_band_change`, `confidence_band_change`,
 *      `existence_boundary_crossing`, `raw_magnitude` — both passes AGREE on the
 *      sign, and the orange deleted a fact nobody was contesting.
 *   2. The pre-run "needs attention" dash was gated on `!isResultsMode`, an
 *      APP-GLOBAL (`results.status === 'complete'`). The identical edge, with
 *      identical data, therefore restyled when an analysis completed. Paul
 *      witnessed exactly this: edges reading red/green and then flipping to
 *      orange-dotted after interacting with the Analysis tab.
 *
 * PAUL'S RULING (17 Aug 2026), which this module implements:
 *   "orange must NOT universally mean 'unvetted'; reserve exception styling for
 *    genuinely exceptional/contested states."
 * On a fresh AI-drafted model essentially every edge is unconfirmed, so an
 * exception treatment applied to "unconfirmed" IS the default treatment, and the
 * graph reads as alarming when nothing is actually wrong.
 *
 * THE THREE RULES THIS MODULE ENCODES
 * -----------------------------------
 *  A. COLOUR IS POLARITY'S CHANNEL. Nothing overwrites the polarity stroke
 *     except a state that makes the polarity itself untrustworthy or that
 *     requires the user to act on this specific edge. This is the same treatment
 *     R6 already gave the fragility marker in StyledEdge (moved onto a
 *     drop-shadow so it "composes with the green/red direction stroke instead of
 *     replacing it").
 *  B. AN EDGE'S RESTING APPEARANCE IS A FUNCTION OF THE EDGE. No resting channel
 *     may read an app phase. Interaction states (hover, selection, highlight,
 *     lens) are transient and explicitly user-driven; analysis COMPLETION is
 *     not, and may not restyle a graph the user did not change.
 *  C. THE PRECEDENCE IS DATA. `EDGE_STROKE_RULES` / `EDGE_DASH_RULES` are ordered
 *     arrays, each resolver returns the NAMED rule that fired, and the ordering
 *     is asserted in `edgePresentation.spec.ts`. A future reordering is a diff on
 *     a list, not an invisible consequence of where a branch was pasted.
 *
 * Every resolver returns `{ value, rule }`. Tests bind to `rule` — the identity
 * of the decision — rather than to a colour string another rule could also
 * produce (CLAUDE.md trap 19: an assertion must bind to its object by identity,
 * never by a value predicate another object could satisfy).
 */

import type { ValidationMetadata } from '../../types/validation'
import { MAX_LABEL_COUNTER_SCALE } from '../utils/zoomLegibility'

// ── Colour constants ────────────────────────────────────────────────────────

/** Structural (decision→option, option→factor) edges: fixed grey, always. */
export const STRUCTURAL_EDGE_COLOUR = '#B8B8B8'

/**
 * The exception hue. Reserved — see `resolveEdgeStroke` — for the two states
 * that earn it. `needsUserInput` gets it at full strength; a direction actually
 * in dispute gets the 70% mix, because "we cannot show you a direction" is a
 * quieter claim than "please resolve this".
 */
const WARNING_FULL = 'var(--semantic-warning)'
const WARNING_MIXED = 'color-mix(in srgb, var(--semantic-warning) 70%, transparent)'

// ── State ───────────────────────────────────────────────────────────────────

/**
 * The contested facts this module needs, already reduced from
 * `ValidationMetadata`. Kept as a named type so the reduction
 * (`readContestedState`) is separately testable from the precedence.
 */
export interface ContestedState {
  /**
   * A live, unresolved contest. Mirrors StyledEdge's long-standing gate:
   * status contested AND the user has not acted AND a divergence was actually
   * supplied (an absent divergence is not silently inferred).
   */
  readonly isContested: boolean
  /**
   * Pass 2 asked for the user's input on THIS edge. A genuine user-flagged
   * state, and the strongest claim on the exception hue.
   */
  readonly needsUserInput: boolean
  /**
   * The passes disagree about the SIGN (`contested_reasons` includes
   * `sign_flip`). Only then is the polarity itself untrustworthy.
   *
   * ⚠ FAILS QUIET, DELIBERATELY. When `contested_reasons` is absent or not an
   * array we CANNOT establish that the direction is disputed, so this is false
   * and the polarity stroke survives. Painting orange there would assert "we
   * disagree about this edge's direction" on no evidence (P5), and would delete
   * a direction that IS grounded in the edge's own provenance-gated field. The
   * contest is still shown — the dash below fires for every contested edge.
   */
  readonly directionDisputed: boolean
  /** Divergence-scaled dash, or null when not contested. */
  readonly dash: string | null
}

export const NOT_CONTESTED: ContestedState = {
  isContested: false,
  needsUserInput: false,
  directionDisputed: false,
  dash: null,
}

/** The `ContestedReason` that puts the SIGN in dispute. */
export const DIRECTION_DISPUTING_REASON = 'sign_flip'

/**
 * Reduce a wire `validation` object to the four facts the precedence needs.
 *
 * Takes `unknown` on purpose: `validation` crosses the CEE→UI boundary through
 * `overlayEdge`, which has no `DEFAULT_EDGE_DATA` entry for it and therefore
 * applies whatever the wire supplied without a runtime validator. Narrow here
 * rather than trusting the declared type (P1: the defect lives one seam past
 * the guard).
 */
export function readContestedState(validation: unknown): ContestedState {
  if (validation === null || typeof validation !== 'object') return NOT_CONTESTED
  const v = validation as Partial<ValidationMetadata>

  const divergence = v.max_divergence
  const isContested =
    v.status === 'contested' &&
    v.user_action === 'pending' &&
    typeof divergence === 'number' &&
    Number.isFinite(divergence)
  if (!isContested) return NOT_CONTESTED

  const needsUserInput = v.pass2?.needs_user_input === true
  const reasons = v.contested_reasons
  const directionDisputed =
    Array.isArray(reasons) && reasons.includes(DIRECTION_DISPUTING_REASON)

  // Dash: gap scales with divergence (0→1 maps to 4→8px); needs_user_input gets
  // a tighter gap for a stronger signal. Unchanged from the original branch —
  // this module moves WHERE the decision is made, not what the contested dash
  // looks like.
  const d = divergence as number
  const gap = needsUserInput ? 3 : Math.round(4 + d * 4)
  const dashWidth = Number((1.5 + d * 1.5).toFixed(1))

  return { isContested, needsUserInput, directionDisputed, dash: `${dashWidth} ${gap}` }
}

/** Everything the two resolvers may read. Nothing else is in scope. */
export interface EdgePresentationState {
  readonly isStructural: boolean
  /** Active lens, or 'full' for the default (no-lens) view. */
  readonly lensMode: string
  /**
   * Causal-lens parameters, or null when the lens has none for this edge.
   *
   * ⚠ THE OBJECT'S PRESENCE AND ITS `direction` ARE TWO DIFFERENT FACTS and must
   * not be collapsed (CLAUDE.md trap 21). `CausalLensEdgeParams.direction` is
   * `null` when nobody STATED a direction, and the causal lens still paints
   * those edges — in its neutral body colour, which is its way of refusing to
   * claim a sign. Flattening this to a bare direction would silently drop that
   * edge out of the lens branch entirely and repaint it with default-view
   * polarity, which is the opposite of what the lens is for.
   */
  readonly causalParams: { readonly direction: 'positive' | 'negative' | null } | null
  /** Evidence-lens classification, when that lens is active. */
  readonly evidenceClass: string | null
  readonly contested: ContestedState
  readonly isHighlighted: boolean
  /**
   * The polarity colour from `computeDirectionStroke`. ALWAYS a string — that
   * function returns its neutral grey rather than null for every no-verdict
   * case, so there is no "no polarity" hole for another rule to fill.
   */
  readonly polarityStroke: string
  /** Dash from `existenceCertaintyToLineStyle`, or null/undefined when unset. */
  readonly existenceDash: string | null | undefined
  /** Dash from the legacy visual-props map. Last resort. */
  readonly visualPropsDash: string | undefined
}

// ── Stroke ──────────────────────────────────────────────────────────────────

/**
 * Stroke precedence, highest first. THE ORDER IS THE CONTRACT — asserted in
 * `edgePresentation.spec.ts` against this exact array.
 */
export const EDGE_STROKE_RULES = [
  /** Structural scaffolding recedes; never carries a data claim. */
  'structural',
  /** Causal lens: an explicit alternative encoding with its own key. */
  'lens_causal',
  /** Evidence lens: ditto. */
  'lens_evidence',
  /** Pass 2 asked the user to act on THIS edge. Exception hue, full strength. */
  'contested_needs_user_input',
  /** The passes disagree about the SIGN — no honest polarity to show. */
  'contested_direction_disputed',
  /** Transient interaction highlight. */
  'highlighted',
  /**
   * The default, and the point of the whole module: polarity, including the
   * neutral grey that `computeDirectionStroke` returns for every unset or
   * unstated value. A quiet graph is the resting state.
   */
  'polarity',
] as const

export type EdgeStrokeRule = (typeof EDGE_STROKE_RULES)[number]

export interface EdgeStrokeDecision {
  readonly value: string
  readonly rule: EdgeStrokeRule
}

export function resolveEdgeStroke(state: EdgePresentationState): EdgeStrokeDecision {
  if (state.isStructural) {
    return { value: STRUCTURAL_EDGE_COLOUR, rule: 'structural' }
  }

  if (state.lensMode === 'causal' && state.causalParams !== null) {
    return {
      value:
        state.causalParams.direction === 'negative'
          ? 'var(--semantic-danger, #ef4444)'
          : 'var(--text-body, #3F3F3E)',
      rule: 'lens_causal',
    }
  }

  if (state.lensMode === 'evidence' && state.evidenceClass !== null) {
    switch (state.evidenceClass) {
      case 'evidence':
        return { value: 'var(--semantic-success, #22c55e)', rule: 'lens_evidence' }
      case 'assumed':
        return { value: 'var(--semantic-warning, #eab308)', rule: 'lens_evidence' }
      case 'unknown':
        return { value: 'var(--semantic-danger, #ef4444)', rule: 'lens_evidence' }
    }
    // An unrecognised class is not a claim we can paint; fall through.
  }

  // ── The exception hue, and the only two states that earn it ───────────────
  //
  // Both are narrower than `status === 'contested'`, which is the whole point:
  // "contested" is a common outcome of a two-pass review and cannot carry an
  // alarm colour without becoming the default. Contest is still ALWAYS visible
  // — `resolveEdgeDash` fires the divergence-scaled dash for every contested
  // edge, composing with whatever colour wins here.
  if (state.contested.isContested && state.contested.needsUserInput) {
    return { value: WARNING_FULL, rule: 'contested_needs_user_input' }
  }
  if (state.contested.isContested && state.contested.directionDisputed) {
    return { value: WARNING_MIXED, rule: 'contested_direction_disputed' }
  }

  if (state.isHighlighted) {
    return { value: 'var(--semantic-info)', rule: 'highlighted' }
  }

  return { value: state.polarityStroke, rule: 'polarity' }
}

// ── Dash ────────────────────────────────────────────────────────────────────

/**
 * Dash precedence, highest first.
 *
 * ⚠ `pre_run_incomplete` IS DELIBERATELY ABSENT. StyledEdge used to dash every
 * edge with no confidence value while `results.status !== 'complete'`, with the
 * comment "needs attention". Two defects in one branch: on a fresh AI draft that
 * is EVERY edge, so the attention marker marked nothing (Paul's ruling above);
 * and its `!isResultsMode` term is an app phase, so completing an analysis
 * restyled edges the user had not touched (rule B in the module header). Missing
 * confidence is the ordinary state of drafted structure, not an exception, and
 * genuine uncertainty already has a channel — `existence_certainty` below, which
 * reads a value the producer actually stated.
 */
export const EDGE_DASH_RULES = [
  /** Structural scaffolding is always solid. */
  'structural',
  /**
   * Every contested edge, whatever colour won above. This is the composing
   * channel that keeps the contest visible once orange stops being automatic.
   */
  'contested',
  /** exists_probability below the certainty threshold — a stated value. */
  'existence_certainty',
  /** Legacy visual-props map. */
  'visual_props',
] as const

export type EdgeDashRule = (typeof EDGE_DASH_RULES)[number]

export interface EdgeDashDecision {
  readonly value: string | undefined
  readonly rule: EdgeDashRule
}

export function resolveEdgeDash(state: EdgePresentationState): EdgeDashDecision {
  if (state.isStructural) return { value: undefined, rule: 'structural' }
  if (state.contested.isContested && state.contested.dash !== null) {
    return { value: state.contested.dash, rule: 'contested' }
  }
  if (state.existenceDash !== null && state.existenceDash !== undefined) {
    return { value: state.existenceDash, rule: 'existence_certainty' }
  }
  return { value: state.visualPropsDash, rule: 'visual_props' }
}

// ── Direction of causation ──────────────────────────────────────────────────

/**
 * THE MARK THAT SAYS WHICH WAY THE CAUSATION RUNS.
 *
 * Measured on deployed staging, 7 Sep 2026: 39 edges on the board, `marker-end`
 * and `marker-start` empty on all 39. On a causal-reasoning canvas the direction
 * of causation is the most basic thing the picture has to state, and it had no
 * dedicated channel at all — the reader inferred it from layout.
 *
 * Two arrowheads WERE painted into `ReactFlowGraph`'s `<defs>` and referenced by
 * nothing (a repo-wide sweep: 2 hits for `arrowhead-(default|selected)`, both
 * definitions, against a contrast control of 18 for `edge-influence-label` in
 * the same run). They are NOT reused, and the reason is colour, derived at the
 * token bytes rather than assumed:
 *
 *   `arrowhead-default`  → `var(--surface-border)` → `--border-default`
 *                        → `238 230 216` = #EEE6D8, the pale cream StyledEdge's
 *                          own leader-line note calls *"very nearly the
 *                          background"* on the canvas ground. An arrowhead in it
 *                          is the invisible-leader defect of 31 Aug, again.
 *   `arrowhead-selected` → `var(--info)` = `rgb(39 122 157)`, keyed on SELECTION
 *                          — which is not a colour rule in `EDGE_STROKE_RULES`
 *                          at all; selection changes stroke WIDTH.
 *
 * Neither is among the seven values `resolveEdgeStroke` can return, so both are
 * deleted with this change rather than left as a decoy for the next lane.
 *
 * ⚠ WHAT THIS MARK IS NOT. It states DIRECTION OF CAUSATION (source causes
 * target). It does not state SIGN. Polarity's channel is the `+`/`−` glyph and
 * the polarity stroke — and the glyph, not the hue, is the load-bearing half:
 * the shipped green/rose pair separates by ΔE2000 11.7 under deuteranopia (vs
 * 28.3 for the green/red it replaced). The arrow must never displace or
 * duplicate it. Two facts, two channels.
 *
 * ⚠⚠ AND THE NAMING TRAP IN THIS VERY MODULE. `ContestedState.directionDisputed`
 * is TRUE when `contested_reasons` includes `sign_flip` — that is a dispute
 * about the SIGN, not about which node causes which. It is deliberately NOT
 * consulted below. Suppressing the arrowhead on it would withhold a fact nobody
 * is contesting, on the strength of a shared word. (CLAUDE.md trap 21: write
 * down the question each thing answers before reconciling two that look alike.)
 */
export const EDGE_DIRECTION_MARKER_RULES = [
  /**
   * Structural scaffolding (decision→option, option→factor) asserts MEMBERSHIP,
   * not causation — "this option belongs to this decision". The module header
   * already rules that structural edges "never carry a data claim", and an
   * arrowhead is a data claim. One mark, one meaning.
   */
  'structural',
  /**
   * `edge_type` says the relationship has no single direction. In causal-graph
   * notation `A <-> B` asserts an unobserved COMMON CAUSE — it is a refusal to
   * say that A causes B — so a one-way arrowhead would state exactly the thing
   * the type denies.
   *
   * Not hypothetical: `edge_type` is a bare `z.string().optional()`,
   * `turnRequestShape.spec.ts` pins that `bidirected` survives the wire, and
   * `StyledEdge.structural.spec.tsx` pins that it keeps full causal styling.
   */
  'non_directional_type',
  /**
   * The default. A causal edge is a directed claim by construction — source
   * causes target — whether or not its sign, strength or existence is known.
   */
  'causal',
] as const

export type EdgeDirectionMarkerRule = (typeof EDGE_DIRECTION_MARKER_RULES)[number]

/**
 * `edge_type` values that deny a single direction of causation.
 *
 * Kept as an exported list so the spec iterates THIS array rather than a
 * hand-copied one: a value added here is covered by the suite the moment it is
 * added, and cannot drift out of test (CLAUDE.md trap 12).
 */
export const NON_DIRECTIONAL_EDGE_TYPES = [
  'bidirected',
  'undirected',
  'confounder',
] as const

/**
 * Narrows an `edge_type` off the wire. Takes `unknown` on purpose, for the same
 * reason `readContestedState` does: `edge_type` crosses the CEE→UI boundary as a
 * bare optional string with no runtime validator, so the guard belongs here
 * rather than in a declared type nobody enforces.
 */
export function isNonDirectionalEdgeType(edgeType: unknown): boolean {
  if (typeof edgeType !== 'string') return false
  const normalised = edgeType.trim().toLowerCase()
  return (NON_DIRECTIONAL_EDGE_TYPES as readonly string[]).includes(normalised)
}

/** Everything the direction-marker rule may read. Nothing else is in scope. */
export interface EdgeDirectionMarkerState {
  readonly isStructural: boolean
  /** Raw `data.edge_type`, unnarrowed — see `isNonDirectionalEdgeType`. */
  readonly edgeType: unknown
}

export interface EdgeDirectionMarkerDecision {
  readonly show: boolean
  readonly rule: EdgeDirectionMarkerRule
}

/**
 * Returns the NAMED rule that fired, not just the boolean — because `false` is
 * returned by two different rules here and they mean different things. Tests
 * bind to `rule`, exactly as they do for the stroke and dash resolvers above
 * (CLAUDE.md trap 19).
 */
export function resolveEdgeDirectionMarker(
  state: EdgeDirectionMarkerState,
): EdgeDirectionMarkerDecision {
  if (state.isStructural) return { show: false, rule: 'structural' }
  if (isNonDirectionalEdgeType(state.edgeType)) {
    return { show: false, rule: 'non_directional_type' }
  }
  return { show: true, rule: 'causal' }
}

// ── Arrowhead geometry ──────────────────────────────────────────────────────

/**
 * ⭐⭐ THE MARK'S SCREEN SIZE AT THE ZOOM THE CANVAS ACTUALLY PARKS AT.
 *
 * A marker's geometry is USER SPACE, multiplied by the viewport transform before
 * it reaches a pixel — and `vector-effect: non-scaling-stroke`, the mechanism
 * the edge STROKE uses for exactly this problem, DOES NOT REACH IT: that governs
 * stroke rendering, and an arrowhead is a filled polygon. So the dead `<defs>`
 * markers' 6 units would have rendered at 3px at the 0.50 auto-fit floor the
 * product parks a fresh model at — an arrow added to fix a legibility gap, too
 * small to see at the only zoom the product chooses for the user.
 *
 * THE ANSWER IS THIS CODEBASE'S OWN, TAKEN FOR ITS OWN STATED REASON. Node
 * GEOMETRY faces the identical trade and `zoomLegibility.ts` resolves it:
 * *"the settle zoom IS the worst case, and the worst case is a CONSTANT rather
 * than a number that has to be tracked at runtime."* So the size is sized for
 * the BOUND — `MAX_LABEL_COUNTER_SCALE`, imported, not restated — and is a
 * compile-time constant.
 *
 * WHY THAT MATTERS BEYOND TIDINESS: no edge subscribes to zoom. A per-edge
 * `useStore(s => s.transform[2])` would re-render every edge on every wheel
 * frame — precisely the cost `CanvasLabelScaleSync` was built to avoid
 * (*"would re-render every node and every edge on every zoom tick"*). Sizing for
 * the bound buys the legibility with zero added render pressure.
 *
 * THE TRADE, STATED: past 1:1 the mark grows with the canvas, like node geometry
 * and unlike the stroke width. `zoomLegibility.ts` already rules that
 * magnification past 1:1 "is then the user's own deliberate choice". Below the
 * legibility floor it shrinks with everything else, which is the honest LOD
 * rendering — structure without detail.
 */
export const EDGE_ARROWHEAD_BASE_PX = 8

/** Flow-space size of the arrowhead. Derived from the single zoom authority. */
export const EDGE_ARROWHEAD_FLOW_SIZE = EDGE_ARROWHEAD_BASE_PX * MAX_LABEL_COUNTER_SCALE

/**
 * The rendered size, in CSS px, of the arrowhead at a given viewport zoom.
 *
 * Exported for the same reason `renderedLabelPx` is: jsdom has no layout, so a
 * DOM assertion proves an attribute is present and proves nothing about size on
 * screen. Specs assert this arithmetic instead, and say so.
 */
export function renderedArrowheadPx(zoom: number): number {
  return EDGE_ARROWHEAD_FLOW_SIZE * zoom
}

/**
 * The marker id for an edge.
 *
 * INJECTIVE ON PURPOSE. A sanitiser that mapped every unsafe character to `_`
 * would be fragment-safe and would collide `a b` with `a_b` — two edges sharing
 * one marker, so one edge's arrowhead silently takes the other's colour.
 * `encodeURIComponent` is injective; the extra pass escapes the five characters
 * it leaves alone that `url(#…)` or a CSS selector would choke on, and cannot
 * collide with its output because a literal `%` is already `%25`.
 */
export function edgeArrowheadMarkerId(edgeId: string): string {
  const escaped = encodeURIComponent(edgeId).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `edge-direction-${escaped}`
}
