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
 * ⭐ NARROWED AGAIN — THE LOCKED CONNECTOR GRAMMAR (Experience Design, 23 Sep
 * 2026, which wins over the Canvas Final spec §5 where it refines it):
 *   thickness = relationship magnitude · colour/sign = direction ·
 *   dash = existence certainty ONLY · orange = AI-review SIGN disagreement only ·
 *   fragility = a discreet exception cue, never a line style · no "contested"
 *   without attributable human disagreement.
 * Two rules left this module with it: the `contested` DASH (a review
 * disagreement dashed the line, so a strength-only contest read as "this may
 * not exist") and the `contested_needs_user_input` STROKE (full orange whenever
 * pass 2 asked for input, whatever it disagreed about — the "orange/dotted"
 * treatment Paul saw on staging `4c6ec07b`). Every other review disagreement is
 * shown in the connection's inspector (`EdgeReviewDisagreement`), which is now
 * where `pass2.needs_user_input` is read.
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

import type { CSSProperties } from 'react'
import type { ValidationMetadata } from '../../types/validation'
import type { ExistenceDash } from '../utils/graphDisplayCalculations'
import { MEASURED_EDGE_STROKE_WIDTH_FLOOR } from '../utils/graphDisplayCalculations'
import { glyphCounterScale } from '../utils/zoomLegibility'

// ── Colour constants ────────────────────────────────────────────────────────

/**
 * Structural (decision→option, option→factor) edges: fixed grey, always.
 *
 * contract v3.1 (E11/T07, 24 Sep 2026): the contract's warm structural grey
 * ("quiet and grey"), replacing the cool mid-grey that sat beside warm stone
 * factor borders on every graph. Built from an EXISTING token (DS v5; Paul pt 9
 * "no new colours"; `check-ds-compliance` refuses a new production hex): the
 * muted-ink token at 50%, which composites on the canvas ground to within a
 * few units of the contract's grey. Width 1 and no arrowhead are unchanged
 * (rule `structural` below and `EDGE_DIRECTION_MARKER_RULES`).
 *
 * ⭐ 0.5 → 0.75 (Paul, 30 Sep: "the graph is nearly invisible"). The contract's
 * 1px grey is drawn at 100%; ours is a 1px `non-scaling-stroke` BEZIER, and its
 * anti-aliasing halves the ink. Measured on served `61f5b909` (1440×900, MRR):
 * the darkest pixel of a question→option link was ~40 below the ground, the
 * contract's ~64. At 0.75 the curve reaches the contract's contrast.
 */
export const STRUCTURAL_EDGE_COLOUR = 'rgb(var(--text-light-rgb) / 0.75)'

/**
 * The exception hue, reserved — see `resolveEdgeStroke` — for the ONE state that
 * earns it since 23 Sep 2026: Olumi's two review passes disagree about the SIGN.
 *
 * ⭐ contract v3.1 (E12/T07, 24 Sep 2026; Paul 23 Sep point 9: "AI
 * sign-disagreement = Warning/amber + `±`"): the Warning token itself, SOLID.
 * It was a 70% mix with transparent, which rendered as a pale tint (#FCBC82 on
 * the canvas, 1.46:1) rather than the Warning token, and because the arrowhead
 * reads this same value the dispute line and its head went translucent and
 * muddy wherever they crossed another edge. Exported so the legend's swatch and
 * the arrowhead draw THIS value rather than a hand-typed copy (trap 12).
 */
export const DIRECTION_DISPUTED_STROKE = 'var(--semantic-warning)'

// ── State ───────────────────────────────────────────────────────────────────

/**
 * The contested facts this module needs, already reduced from
 * `ValidationMetadata`. Kept as a named type so the reduction
 * (`readContestedState`) is separately testable from the precedence.
 *
 * ⚠ TWO FACTS, NOT FOUR, SINCE 23 SEP 2026. `needsUserInput` and the
 * divergence-scaled `dash` were deleted WITH the two rules that read them, so no
 * computed-but-unread value is left for a later change to wire back onto the
 * line. The producer's `pass2.needs_user_input` is not thrown away: the
 * inspector reads it (`EdgeReviewDisagreement`'s heading).
 */
export interface ContestedState {
  /**
   * A live, unresolved contest. Mirrors StyledEdge's long-standing gate:
   * status contested AND the user has not acted AND a divergence was actually
   * supplied (an absent divergence is not silently inferred).
   */
  readonly isContested: boolean
  /**
   * The passes disagree about the SIGN (`contested_reasons` includes
   * `sign_flip`). Only then is the polarity itself untrustworthy.
   *
   * ⚠ FAILS QUIET, DELIBERATELY. When `contested_reasons` is absent or not an
   * array we CANNOT establish that the direction is disputed, so this is false
   * and the polarity stroke survives. Painting orange there would assert "we
   * disagree about this edge's direction" on no evidence (P5), and would delete
   * a direction that IS grounded in the edge's own provenance-gated field. The
   * contest is still shown — in the connection's inspector.
   */
  readonly directionDisputed: boolean
}

export const NOT_CONTESTED: ContestedState = {
  isContested: false,
  directionDisputed: false,
}

/** The `ContestedReason` that puts the SIGN in dispute. */
export const DIRECTION_DISPUTING_REASON = 'sign_flip'

/**
 * Reduce a wire `validation` object to the two facts the precedence needs.
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

  const reasons = v.contested_reasons
  const directionDisputed =
    Array.isArray(reasons) && reasons.includes(DIRECTION_DISPUTING_REASON)

  return { isContested, directionDisputed }
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
  /**
   * The existence channel's decision, from `resolveExistenceDash`.
   *
   * ⚠ THIS USED TO BE `existenceDash: string | null | undefined`, and the
   * nullable string was the defect: "nobody stated a likelihood" and "someone
   * stated a high one" both arrived here as the SAME absent value, so this
   * module could not tell them apart even in principle. It now receives the
   * resolved union, and the two answers are separate named rules below.
   */
  readonly existence: ExistenceDash
  /**
   * Dash from the legacy visual-props map (the edge's presentational `style`).
   *
   * ⛔ NEVER READ SINCE Paul 23 Sep contract feedback point 4 ("dash remains
   * existence certainty only"). It used to be the last-resort `visual_props`
   * dash rule, so a stored `style: 'dashed'` could dash a connection whose
   * STATED likelihood was high — a dash with no existence claim behind it.
   * Kept OPTIONAL only so older state builders in specs still type-check;
   * `StyledEdge` no longer passes it.
   */
  readonly visualPropsDash?: string | undefined
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
  /**
   * The passes disagree about the SIGN — no honest polarity to show. The ONE
   * contest rule (23 Sep 2026: "orange = AI review sign disagreement only").
   * `contested_needs_user_input`, which sat above it and painted full orange
   * whatever the passes disagreed about, is deleted.
   */
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
          // contract v3.1 (T16): tokens only, no off-palette fallback hex.
          ? 'var(--semantic-danger)'
          : 'var(--text-body)',
      rule: 'lens_causal',
    }
  }

  if (state.lensMode === 'evidence' && state.evidenceClass !== null) {
    switch (state.evidenceClass) {
      case 'evidence':
        return { value: 'var(--semantic-success)', rule: 'lens_evidence' }
      case 'assumed':
        return { value: 'var(--semantic-warning)', rule: 'lens_evidence' }
      case 'unknown':
        return { value: 'var(--semantic-danger)', rule: 'lens_evidence' }
    }
    // An unrecognised class is not a claim we can paint; fall through.
  }

  // ── The exception hue, and the ONE state that earns it ────────────────────
  //
  // Narrower than `status === 'contested'`, which is the whole point: a
  // disagreement between two review passes is a common outcome and cannot
  // carry an alarm colour without becoming the default. Only a dispute about
  // the SIGN makes the polarity itself untrustworthy, so only that reaches the
  // line. Every other disagreement — including one where pass 2 asked for the
  // person's input — is shown in the connection's inspector, not on the canvas.
  if (state.contested.isContested && state.contested.directionDisputed) {
    return { value: DIRECTION_DISPUTED_STROKE, rule: 'contested_direction_disputed' }
  }

  if (state.isHighlighted) {
    // GAP 1 fix (design-gap audit row 13, contract §03 "Colour and sign =
    // direction"): a selected node's path edges used to recolour to Info
    // blue here, which erases the +/− polarity a red-green dichromat relies
    // on across the WHOLE highlighted path, not just one edge. The contract
    // asks for a soft Info EMPHASIS on a selected path, not a repaint — that
    // is delivered as a separate `filter: drop-shadow` glow in StyledEdge
    // (`EDGE_GLOW.selected`, composed alongside this stroke), so the two
    // channels stay independent and the line keeps stating what it always
    // stated: which direction, by colour and sign.
    return { value: state.polarityStroke, rule: 'highlighted' }
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
  // ⭐ NO `contested` RULE (Experience Design, 23 Sep 2026: "dash = existence
  // certainty only"). It stood here and dashed EVERY contested edge at a
  // divergence-scaled pattern, whatever the passes disagreed about — so a
  // strength-only disagreement, where both passes state a high likelihood,
  // drew as "this connection may not exist". Worse, it OUTRANKED the existence
  // rule below, so on an edge that was both contested and genuinely unlikely
  // the one honest existence mark was replaced by a disagreement mark.
  /**
   * NOBODY SUPPLIED A LIKELIHOOD, so this channel says nothing — and says it
   * by NAME rather than by falling through, because a fallthrough is what let
   * the defect ship. `resolveExistenceDash`'s header carries the derivation for
   * why the honest treatment is an unmarked line and not a third dash.
   *
   * ⚠ IT SITS ABOVE `existence_certainty` BECAUSE PROVENANCE IS ASKED BEFORE
   * VALUE (DESIGN_SYSTEM.md, RULED 2026-09-08). The order is inert between
   * these two — they partition ONE field on its stamp and cannot both match —
   * but stating it in the array is what makes the doctrine reviewable.
   */
  'existence_unset',
  /**
   * A STATED likelihood — dashed below the certainty threshold, solid at or
   * above it. The last rule: nothing below it may dash a line.
   *
   * ⛔ `visual_props` (the legacy `style` map) WAS HERE and is deleted — Paul
   * 23 Sep contract feedback point 4: "Dash remains existence certainty only."
   * A presentational field has no existence claim behind it, so it may not
   * draw one. Measured inert before deletion (no `src/` writer sets `style` to
   * 'dashed'|'dotted'), but the schema still admits it on stored boards.
   */
  'existence_certainty',
] as const

export type EdgeDashRule = (typeof EDGE_DASH_RULES)[number]

export interface EdgeDashDecision {
  readonly value: string | undefined
  readonly rule: EdgeDashRule
}

export function resolveEdgeDash(state: EdgePresentationState): EdgeDashDecision {
  if (state.isStructural) return { value: undefined, rule: 'structural' }
  // `state.contested` is deliberately NOT read here — see `EDGE_DASH_RULES`.
  // Provenance before value. Nobody stated a likelihood, so neither this
  // channel NOR the legacy `style` map (no longer read at all) may mark the edge: `style`
  // is a presentational field with no provenance at all, and letting it paint a
  // certainty mark on an unassessed link is the same defect one layer down.
  // Inert as measured — a sweep of `src/` for `style: 'dashed'|'dotted'` outside
  // tests and fixtures returns zero against a `style: 'solid'` contrast control
  // in the same run — so this closes a hole rather than changing a pixel.
  if (state.existence.kind === 'unset') return { value: undefined, rule: 'existence_unset' }
  // A stated likelihood decides alone: its own dash below the cut, solid above
  // it. `state.visualPropsDash` is deliberately NOT read (Paul 23 Sep contract
  // feedback point 4 — see `EDGE_DASH_RULES`).
  return { value: state.existence.dash, rule: 'existence_certainty' }
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
 * Neither is among the values `resolveEdgeStroke` can return, so both are
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
 * ⭐⭐ THE HEAD SCALES WITH ITS LINE — contract v3.1, side-by-side DIFF item 13
 * (27 Sep 2026).
 *
 * The contract's marker is `viewBox="0 0 6 6"`, `markerWidth="4"`, in SVG's
 * default `markerUnits="strokeWidth"`: the head is FOUR TIMES THE LINE — 8px on
 * a 2px line, 12px on 3px, 16px on 4px, a 1:1 triangle. The mark it replaces was
 * a fixed 12 × 12 `userSpaceOnUse` triangle on every line, so a 1.5px link
 * carried a 12px head and width stopped reading at the arrival.
 *
 * ⚠ THE WIDTH IT READS IS THE RESTING STRENGTH WIDTH, NOT THE PAINTED ONE, and
 * that is why this is not simply `markerUnits="strokeWidth"`. The canvas widens
 * a hovered (+1) or selected (+2) line; the contract never does (it glows). Under
 * `strokeWidth` units the interaction channel would leak into the direction
 * mark. `StyledEdge` passes the strength width and the marker stays in user
 * space.
 *
 * ⭐ AND IT IS COUNTER-SCALED, BECAUSE THE LINE IS. The stroke is
 * `non-scaling-stroke`, so its width is a SCREEN width at every zoom. A head in
 * plain graph units would shrink against its own line as the camera pulls back
 * — 2:1 at the 0.50 landing floor instead of 4:1. So the polygon is scaled by
 * `--canvas-glyph-scale` (`zoomLegibility.ts`: glyphs, marks "and the edge
 * arrowhead keep `rendered === declared` down to the landing floor"), about the
 * TIP, which is the origin of its viewBox. That replaces "size for the bound",
 * which was right at one zoom only (6px at 0.50 and 12px at 1:1, on every line).
 *
 * ⚠ WITNESS, STATED AT ITS RUNG. jsdom proves the attributes and the style are
 * carried; it cannot paint. The mechanism — a CSS `scale(var(…))` on a marker's
 * polygon, `overflow="visible"` on the marker, the var inherited from the
 * `.react-flow` root — was witnessed in Chromium on a static page (27 Sep 2026):
 * var 2 painted the head at twice the size of var-fallback 1, tip fixed on the
 * path end. The product's own heads have not been measured on a served build by
 * this change.
 */
export const EDGE_ARROWHEAD_STROKE_MULTIPLE = 2.5

/**
 * ⭐ THE SMALLEST HEAD, in glyph units (Paul, 1 Oct 2026: "The arrows connecting to the nodes are too big").
 * The 4× rule drew 8 / 12 / 16 / 20px heads on screen, up to 3.3× the pre-27 Sep 6px. At 2.5× the bands give
 * 5 / 7.5 / 10 / 12.5; the floor keeps the thinnest head at the old 6px so direction still reads.
 */
export const EDGE_ARROWHEAD_MIN_PX = 6

/**
 * The head's length AND base, in glyph units (screen px at glyph-scale 1).
 *
 * ⭐ FLOORED AT THE THINNEST MEASURED BAND (code-review F2, 27 Sep 2026). The
 * 4× rule is the contract's, over the contract key's widths (2 / 3 / 4). The
 * product's 1px UNSET floor (`UNSET_EDGE_STROKE_WIDTH` — nobody set a strength,
 * which includes every link a user draws) is not in that key: the contract
 * draws such a link at 2px (`e.width||2`). Applied to 1px the rule gave a 4px
 * head at every zoom — a third of the old 12px at 1:1, and below anything the
 * contract draws. The head therefore reads the width floored at
 * `MEASURED_EDGE_STROKE_WIDTH_FLOOR` (derived from the bands, never a literal):
 * an unset link carries the contract's smallest head, and its 1px LINE still
 * says "not set" on the width channel.
 */
export function edgeArrowheadSize(strokeWidth: number): number {
  return Math.max(
    EDGE_ARROWHEAD_MIN_PX,
    EDGE_ARROWHEAD_STROKE_MULTIPLE * Math.max(strokeWidth, MEASURED_EDGE_STROKE_WIDTH_FLOOR),
  )
}

/**
 * The marker's viewBox: the tip at the origin, the base `size` back along the
 * path. Square and the same size as the marker box, so `preserveAspectRatio`
 * cannot letterbox it, and the counter-scale (transform-origin `0 0`) pivots on
 * the tip, so the point never leaves the path's end.
 */
export function edgeArrowheadViewBox(size: number): string {
  return `${-size} ${-size / 2} ${size} ${size}`
}

export function edgeArrowheadPolygonPoints(size: number): string {
  return `${-size} ${-size / 2}, 0 0, ${-size} ${size / 2}`
}

/** The polygon's counter-scale, about the tip (see the docblock above). */
export const EDGE_ARROWHEAD_COUNTER_SCALE_STYLE: Readonly<CSSProperties> = Object.freeze({
  // The var name is written literally (it is `CANVAS_GLYPH_SCALE_VAR`): the
  // css-var census guard (`tests/ci-guards/css-var-resolution.spec.ts`)
  // resolves literal names and counts every interpolated one as a new site.
  transform: 'scale(var(--canvas-glyph-scale, 1))',
  transformOrigin: '0 0',
  transformBox: 'view-box',
})

/**
 * The rendered size, in CSS px, of the head on a `strokeWidth` line at `zoom`.
 * Exported because jsdom has no layout: specs assert this arithmetic, and say so.
 */
export function renderedArrowheadPx(strokeWidth: number, zoom: number): number {
  return edgeArrowheadSize(strokeWidth) * glyphCounterScale(zoom) * zoom
}

/**
 * The marker id for an edge.
 *
 * ⚠⚠ SAY WHICH COLLISION CLASS THIS GUARDS, because this docblock previously
 * named the one that CANNOT HAPPEN. Corrected 7 Sep 2026 at a re-review.
 *
 * GUARDED — collision WITHIN one mounted canvas, from SANITISATION. A sanitiser
 * that mapped every unsafe character to `_` would be fragment-safe and would
 * collide `a b` with `a_b`: two edges sharing one marker, so one edge's
 * arrowhead silently takes the other's colour. `encodeURIComponent` is
 * injective; the extra pass escapes the five characters it leaves alone that
 * `url(#…)` or a CSS selector would choke on, and cannot collide with its own
 * output because a literal `%` is already `%25`. ⚠ Note that React Flow already
 * guarantees edge ids are unique within one instance, so this guard earns its
 * place against the SANITISER, not against the graph.
 *
 * ⛔ NOT GUARDED, AND MEASURED — the SAME edge id rendered by TWO mounted
 * canvases. `ComparisonCanvasLayout` maps `scenarios` to one `<MiniCanvas>`
 * each; `generateScenarios` filters a shared edge list without re-keying; so an
 * edge common to two scenarios is mounted twice and emits the SAME marker id
 * twice, and `url(#…)` resolves to whichever is first in document order.
 * Measured on a 5-node/5-edge graph: scenarios `["e_d1_o1","e_o1_f1",
 * "e_f1_g1"]` and `["e_d1_o2","e_o2_f1","e_f1_g1"]` share `e_f1_g1`, a
 * factor→goal edge with `direction: positive` — exactly the marked class.
 *
 * ⭐ DOCUMENTED RATHER THAN FIXED, and here is the reasoning, so a later reader
 * can overturn it rather than rediscover it:
 *   (a) NO DIVERGENCE IS DEMONSTRATED. Both `MiniCanvas` instances read the same
 *       global store, so both resolve the same stroke rule and the same colour
 *       today. The defect is invalid DOM and a LATENT divergence.
 *   (b) THE FIX IS UNWITNESSABLE HERE. Namespacing per instance means a
 *       `useId()`-derived id, which stops being computable from the edge id —
 *       and computing it from the edge id is precisely what binds every
 *       assertion in `StyledEdge.directionMark.spec.tsx` to its object by
 *       IDENTITY (CLAUDE.md trap 19). Trading a measured latent defect for an
 *       unmeasured change to the spec's own binding is the wrong trade with no
 *       paint witness in hand.
 *   (c) IT IS HALF OF A LARGER, ALREADY-DOCUMENTED CLASS. `zoomLegibility.ts`
 *       records the NODE-id half of exactly this ("two `<MiniCanvas>` instances
 *       rendering THE SAME graph's node ids, un-re-keyed"), created by xyflow
 *       itself. Closing the edge-marker half alone leaves the node half open
 *       while reading as closed — a half-fix that hides its own remainder.
 * The property that makes the gap honest rather than accidental — that this id
 * is a pure function of the edge id and carries NO canvas-instance component —
 * is pinned in the spec, so namespacing it later is a deliberate act with a red
 * test in front of it, not a silent drift.
 */
export function edgeArrowheadMarkerId(edgeId: string): string {
  const escaped = encodeURIComponent(edgeId).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `edge-direction-${escaped}`
}
