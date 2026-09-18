/**
 * Graph Display Calculations for Decision Graph Display v2
 * British English: visualisation, colour
 *
 * Pure functions for calculating visual properties:
 * - Edge importance (thickness scaling)
 * - Risk severity banding
 * - Existence certainty (line style)
 */

import type { RiskImpact } from '../domain/nodes'
import { EDGE_VALUE_BAND_CUTS, type EdgeValueDisplay } from '../domain/edgeValueProvenance'
import { getCanvasStrengthBand, type CanvasStrengthBandId } from '../domain/vocabulary'

/**
 * Edge importance formula from Decision Graph Display v2 spec
 *
 * importance = belief × |strength.mean| × goal_sensitivity(v)
 *
 * Where:
 * - belief = edge.exists_probability
 * - strength.mean = edge.strength.mean
 * - goal_sensitivity(node_id) = factor_sensitivity[node_id].elasticity
 *
 * @param belief - Edge exists_probability (0-1), defaults to 1.0 if undefined
 * @param strength - Edge strength.mean, defaults to 1.0 if undefined
 * @param goalSensitivity - Factor elasticity from factor_sensitivity[], defaults to 1.0 for non-factor edges
 * @returns Importance score (unbounded, will be scaled for visual thickness)
 */
export function calculateEdgeImportance(
  belief: number | undefined,
  strength: number | undefined,
  goalSensitivity: number | undefined
): number {
  const beliefValue = belief ?? 1.0
  const strengthValue = Math.abs(strength ?? 0.5) // Aligned with DEFAULT_EDGE_DATA.weight
  // Issue #2 fix: Use 1.0 fallback for non-factor edges
  const sensitivityValue = goalSensitivity ?? 1.0

  return beliefValue * strengthValue * sensitivityValue
}

/**
 * Map importance score to stroke width
 * Scales importance to visual thickness (1-8px range)
 *
 * @param importance - Raw importance score from calculateEdgeImportance
 * @param maxImportance - Maximum importance in the graph for normalization
 * @returns Stroke width in pixels (1-8px)
 */
export function importanceToStrokeWidth(
  importance: number,
  maxImportance: number
): number {
  if (maxImportance === 0) return 2 // Default if no importance data

  const normalized = importance / maxImportance
  const minWidth = 1
  const maxWidth = 8

  return minWidth + normalized * (maxWidth - minWidth)
}

/**
 * Risk severity banding from Decision Graph Display v2 spec
 *
 * score = impact_weight[impact] × probability
 *
 * Thresholds:
 * - <0.5: Low (yellow)
 * - 0.5-1.5: Medium (orange)
 * - 1.5-3: High (red-orange)
 * - >3: Critical (red)
 *
 * @param probability - Risk probability (0-1), optional
 * @param impact - Risk impact level, optional
 * @returns Severity band or null if inputs missing
 */
export function calculateRiskSeverity(
  probability: number | undefined,
  impact: RiskImpact | undefined
): 'low' | 'medium' | 'high' | 'critical' | null {
  if (probability === undefined || impact === undefined) {
    return null
  }

  const impactWeights: Record<RiskImpact, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }

  const score = impactWeights[impact] * probability

  if (score < 0.5) return 'low'
  if (score < 1.5) return 'medium'
  if (score < 3) return 'high'
  return 'critical'
}

/**
 * ⭐⭐ THE EXISTENCE DASH — AND WHY IT TAKES A RESOLVED DISPLAY, NOT A NUMBER.
 *
 * This took `existsProbability: number | undefined` and returned solid for
 * `undefined` or `>= 0.7`. Two branches, and NEITHER could express "unset".
 *
 * `USER_EDGE_DEFAULTS.beliefExists` is `0.8` and carries NO source stamp, so a
 * link the user had merely DRAWN arrived here as the number `0.8`, cleared the
 * threshold, and drew SOLID — while `CanvasLegendPopover` told the reader
 * "Solid connection: established". The board therefore asserted that a
 * relationship nobody had assessed was ESTABLISHED. That is the defect
 * `EdgePanel.thresholdColor(v: number)` had one channel over, and it is worse
 * here: a line style is read PRE-ATTENTIVELY, so a reader absorbs the claim
 * without ever deciding to believe it.
 *
 * Taking `EdgeValueDisplay` is the fix, and it is the fix `computeDirectionStroke`
 * and `resolveEdgeSignedStrengthDisplay` already made on their own channels:
 * there is no argument to this function that means "0.8, source unknown".
 * DESIGN_SYSTEM.md states the rule it obeys (RULED 2026-09-08) — "⛔ The unset
 * state is decided by PROVENANCE, never by a value … Any future rule here must
 * key on whether anyone SUPPLIED the value — never on the value itself, which
 * always has a default."
 *
 * ⚠ WHY UNSET GETS NO MARK OF ITS OWN, having asked the question properly.
 * The obvious move is a third dash. Every position in this channel is already
 * spent, and each reuse would state something nobody said:
 *   · `'6,4'`        — "someone stated a likelihood below the threshold".
 *   · dotted `'2 3'` — `styleToDashArray`'s third case, and NOT free: dotted
 *                      already means LOW in this codebase's confidence
 *                      vocabulary (`ConfidenceBadge.low` draws a dotted border;
 *                      DESIGN_SYSTEM v5's confidence table pins `Low` to
 *                      `border-dotted`). An unset edge drawn dotted reads "low".
 *   · the contested dash — reserved for a live, divergence-scaled dispute.
 * `UNSET_EDGE_STROKE_WIDTH` below reached the same verdict about dash from the
 * STRENGTH side ("dash is already spent three times over"). Re-derived here for
 * the EXISTENCE axis it holds again, on the dotted evidence above — which that
 * entry did not have, because it never had cause to ask whether dotted was free.
 *
 * And minting a FOURTH pattern is refused on Paul's 17 Aug 2026 ruling, which
 * bites hardest exactly here: "reserve exception styling for genuinely
 * exceptional/contested states". On a fresh or AI-drafted board essentially
 * every edge is unset, so ANY mark for unset IS the default mark — and the
 * graph reads as alarming when nothing is wrong.
 *
 * So the honest treatment is SILENCE on this channel, and it is not the same
 * thing as the old behaviour even though the pixels agree: a dash is a mark
 * ADDED to a line, and an unmarked line asserts nothing — UNLESS a legend says
 * it does. The legend did. `CanvasLegendPopover.CONNECTION_ROWS` is corrected in
 * the same change, and that is the half that removes the false claim.
 *
 * ⚠ THE ASYMMETRY WITH WIDTH, since the two look like the same problem: EVERY
 * width is a claim (weak/moderate/strong), so an unset strength had nowhere to
 * stand and needed `UNSET_EDGE_STROKE_WIDTH` minted for it. Solid is not a
 * claim; it is the absence of a mark. The channels differ, so the remedies do.
 *
 * The unset state stays VISIBLE on the two channels DESIGN_SYSTEM.md already
 * ruled own it: a freshly drawn edge draws grey (`computeDirectionStroke`'s
 * neutral, because `weight` is unstamped too) at `UNSET_EDGE_STROKE_WIDTH`, and
 * the legend teaches both rows. "New states must reuse this vocabulary, not
 * invent a third treatment."
 */
export type ExistenceDash =
  /**
   * Nobody supplied a likelihood. This channel has NOTHING to say — and that is
   * a DECISION, which is why it is a named member here and a named rule in
   * `EDGE_DASH_RULES`, not an `undefined` that a later reader would mistake for
   * a fallthrough.
   */
  | { readonly kind: 'unset' }
  /** Somebody stated one. `dash` is `undefined` when it cleared the threshold. */
  | { readonly kind: 'stated'; readonly dash: string | undefined }

/**
 * The dash a STATED sub-threshold likelihood draws. Named so the legend can
 * consume it instead of restating it — `CanvasLegendPopover`'s connection key
 * carried its own `'3 2'` swatch under a caption describing this channel, so
 * the key taught a dash the canvas has never drawn (trap 12).
 */
export const EXISTENCE_UNCERTAIN_DASH = '6,4'

/**
 * Cut at `EDGE_VALUE_BAND_CUTS.high`, imported rather than restated: the same
 * 0.7 lives in `edgeValueBand` and in the panel, and it was a hand-copied
 * literal here. The boundary at exactly 0.7 is solid, as before.
 *
 * ⚠⚠ THIS FUNCTION COLLAPSES TWO POPULATIONS INTO SOLID, AND THE LEGEND'S
 * CAPTION IS A CLAIM ABOUT THEIR UNION. `{kind:'unset'}` (nobody stated a
 * likelihood) and `{kind:'stated', dash: undefined}` (somebody stated one in
 * [0.7, 1.0]) are DIFFERENT DECISIONS that paint IDENTICAL PIXELS. The first
 * repair of the key captioned all of it *"no doubt recorded"*, which is false
 * across the whole stated-high band — an edge CEE stamps at
 * `exists_probability: 0.75` has a **recorded 25% doubt** and draws solid.
 *
 * ⛔ DO NOT "FIX" THAT BY MOVING OR REMOVING THE CUT. Raising it dashes most of
 * an AI-drafted board (Paul's 17 Aug ruling, quoted in the header above);
 * removing it deletes the only honest use of the channel. **The union is the
 * thing the caption must describe**, and `CanvasLegendPopover.CONNECTION_ROWS`
 * now does — *"no doubt recorded, or only a small one"*. Any change to this
 * cut, or to the `kind` members, is a change to that sentence's truth
 * conditions: re-derive the caption in the same commit.
 */
export function resolveExistenceDash(display: EdgeValueDisplay): ExistenceDash {
  if (!display.show) return { kind: 'unset' }
  return {
    kind: 'stated',
    dash: display.value >= EDGE_VALUE_BAND_CUTS.high ? undefined : EXISTENCE_UNCERTAIN_DASH,
  }
}

/**
 * ⛔ THE THRESHOLD LIST THAT USED TO SIT HERE IS DELETED, NOT UPDATED.
 * It read *"Graph v1.1 Task 7 wireframe v4 thresholds: |mean| >= 0.7 → 3px,
 * >= 0.4 → 2px, < 0.4 → 1.5px"* and had been wrong since 14 Sep 2026, when the
 * widths moved to 2/3/4 — a hand-maintained mirror of the function three lines
 * below it, in the file whose own comments ban exactly that (trap 12).
 * Re-typing it in the four-rung form would only re-arm it. The cuts live in
 * `CANVAS_STRENGTH_BANDS`, the widths in the object below, and `Math.abs` is still
 * called internally, so a signed mean may be passed directly.
 */
/**
 * The widths a MEASURED strength can draw at, one per band. Named so the legend
 * can be derived from them instead of restating them — `CanvasLegendPopover`'s
 * thickness key used to carry its own `1.5 / 2 / 3` literals under a comment
 * saying they "mirror weightMagnitudeToStrokeWidth()", which is the
 * hand-maintained mirror CLAUDE.md trap 12 exists to abolish.
 */
/**
 * ⭐⭐ 1.5/2/3 -> 2/3/4 (14 Sep 2026), AND THE REASON IS THE ZOOM THE PRODUCT
 * ITSELF CHOOSES, not taste.
 *
 * MEASURED on the served build `b7c8c74e` (1680x1050, own model, isolated
 * context, settled camera transform read rather than derived): the graph is
 * height-bound, so the fit clamps onto `LABEL_LEGIBLE_ZOOM` and the settled
 * scale was **0.5000**. At that scale these three bands drew at **0.75px / 1px /
 * 1.5px**, and the DOM carried only **two distinct stroke widths across 14
 * edges**. The founder's report was *"why are all the connectors the same
 * width"*. They were 0.25px apart, which is the same thing to an eye.
 *
 * The ladder including the unset floor became `1 / 2 / 3 / 4` — and on
 * 18 Sep 2026, when the fourth band arrived, `1 / 2 / 3 / 4 / 5`. At the fit
 * zoom it renders `0.5 / 1 / 1.5 / 2 / 2.5` CSS px — **1 to 5 device pixels on
 * a 2x display**, a whole device pixel between every rung, unchanged by the
 * added rung. `strokeBandsAreLegibleAtFitZoom.spec.ts` pins the PROPERTY
 * (separable at `LABEL_LEGIBLE_ZOOM`, threshold and zoom both IMPORTED), not
 * these numbers — so they may move again as long as the channel still carries
 * information, and it re-derived across this change without an edit. A snapshot
 * of the old triple would have been green throughout the defect.
 *
 * ⚠ `UNSET_EDGE_STROKE_WIDTH` stays 1 and stays STRICTLY below the thinnest
 * measured band — the 8 Sep 2026 invariant below is untouched, and widening the
 * bands strengthened it: unset was 0.5px from the thinnest measured rung, and
 * is now 1px from it.
 */
/**
 * ⭐⭐⭐ FOUR RUNGS, NOT THREE, AND THE REASON IS THE LEGEND (18 Sep 2026).
 *
 * WIDTH answers *"how thick is this line"* and `getStrengthLabel` answers
 * *"what word is this magnitude entitled to"*. Trap 21 says two authorities
 * answering different questions must be named apart, not aligned — so the
 * reconciliation needed an argument, and here it is: **`CanvasLegendPopover`'s
 * thickness key is the JOIN.** A legend exists to assert *this thickness means
 * this word*. That assertion is only well-formed when the two ladders have the
 * same rungs, and ours did not: the thinnest rung was drawn for every
 * `|mean| < 0.40`, which spans BOTH *Slight* and *Moderate*, so the key had to
 * invent a fourth word — **"Weak effect"**, printed nowhere else in the
 * product — to name a thickness that is not one band.
 *
 * ⚠ AND THE COLLISION IS THE ONE THIS FILE HAS ALREADY PAID FOR ONCE. The
 * `UNSET_EDGE_STROKE_WIDTH` note below widened the floor on the grounds that
 * *"width is the channel the canvas explicitly TEACHES as strength"*, so an
 * unset strength must not draw as a stated weak one. The identical argument
 * applies between *Slight* and *Moderate*: two DIFFERENT stated findings,
 * pixel-identical on the channel the legend teaches. Same defect, one rung
 * along. `metricVocabulary.ts` measured the consequence and rowed it as an open
 * gap: across the 24 starter magnitudes (0.18–0.65) only TWO widths were
 * distinguishable. With this rung there are THREE.
 *
 * ⚠ THE CUTS ARE NOT HERE. They are `CANVAS_STRENGTH_BANDS` (`domain/vocabulary.ts`)
 * and `weightMagnitudeToStrokeWidth` reads them through `getCanvasStrengthBand`. This
 * object maps BAND ID → WIDTH and nothing else; `satisfies` makes a band added
 * to the vocabulary without a width a COMPILE ERROR rather than a silent gap
 * (trap 12: the mirror must fail loud, never assume-good).
 *
 * WIDTHS. The ladder including the unset floor is `1 / 2 / 3 / 4 / 5`, which at
 * the fit zoom the product itself picks (`LABEL_LEGIBLE_ZOOM` = 0.5) renders
 * `0.5 / 1 / 1.5 / 2 / 2.5` CSS px — one whole device pixel between every rung
 * on a 2x display, the same separation the three-rung ladder had.
 * `strokeBandsAreLegibleAtFitZoom.spec.ts` pins that PROPERTY with both terms
 * imported, so it re-derives rather than needing an edit here.
 */
export const EDGE_STROKE_WIDTH_BANDS = {
  slight: 2,
  moderate: 3,
  strong: 4,
  veryStrong: 5,
} as const satisfies Record<CanvasStrengthBandId, number>

/**
 * The thinnest width a MEASUREMENT can produce, DERIVED from the bands above.
 * Adding a band automatically moves this; it is never hand-listed.
 */
export const MEASURED_EDGE_STROKE_WIDTH_FLOOR = Math.min(
  ...Object.values(EDGE_STROKE_WIDTH_BANDS),
)

/**
 * The width an edge draws at when NOBODY HAS SET ITS STRENGTH.
 *
 * ⭐ STRICTLY BELOW EVERY MEASURED BAND — and it was not, until 8 Sep 2026.
 *
 * This constant was `1.5`, *"equal to the thinnest measured band on purpose"*,
 * on the reasoning that the floor "cannot be read as 'this influence is
 * strong'". That reasoning is sound about STRONG and silent about WEAK: at 1.5
 * an unset strength was pixel-identical to a stated `|mean| < 0.4`. Width is
 * the channel the canvas explicitly TEACHES as strength — there is a legend key
 * for it — so the one question a team most needs answered at a glance, *where
 * has nobody actually said anything?*, had no answer on that channel.
 *
 * `metricVocabulary.ts` had already measured the collision and declined to fix
 * it from a lane scoped to a card row (*"⛔ DELIBERATELY NOT BUILT … a live
 * product question with Paul"*). Cleared 8 Sep 2026; this is the answer.
 *
 * ⚠ WHY NOT A DASH, THE OBVIOUS CHOICE. Dash is already spent three times over
 * on this canvas — `EDGE_DASH_RULES` (`edges/edgePresentation.ts`) carries
 * `contested`, `existence_certainty` and `visual_props`, and ghost/suggestion
 * edges dash too. Ambiguity is the smaller half of the problem: `resolveEdgeDash`
 * returns the FIRST rule that matches, so a `strength_unset` rule would be
 * INVISIBLE on exactly the edges most in question (an unset edge that is also
 * contested, or whose `exists_probability < 0.7`, already dashes for another
 * reason) — and placing it higher would delete a live dispute signal. There is
 * no position in that array where the rule is both visible and safe. Opacity is
 * explicitly refused as a data channel (`StyledEdge.tsx`, P2.9: *"two channels
 * for one variable is exactly the encoding overload the audit flags"*), colour
 * belongs to polarity (rule A), and the drop-shadow already carries two signals
 * that can both apply at once. Width is where strength lives, and the defect was
 * inside width — so it is fixed in width.
 *
 * Callers reach this via the provenance gate (`resolveEdgeSignedStrengthDisplay`),
 * never by passing a fabricated number into `weightMagnitudeToStrokeWidth` below
 * — that function takes a `number` and so, by construction, cannot tell a
 * measurement from a default.
 */
export const UNSET_EDGE_STROKE_WIDTH = 1

/**
 * ⚠ THE CUTS ARE DERIVED, NEVER RESTATED. This function used to carry its own
 * `>= 0.7` / `>= 0.4` chain beside the four-cut table in `domain/vocabulary.ts`
 * — two hand-kept ladders over one number, agreeing on the day they were
 * written (trap 12). It now asks `getCanvasStrengthBand` and looks the width up by
 * band id, so a cut can only move in the contract's table and the picture
 * follows the words by construction.
 */
export function weightMagnitudeToStrokeWidth(signedMean: number): number {
  return EDGE_STROKE_WIDTH_BANDS[getCanvasStrengthBand(Math.abs(signedMean)).id]
}

/**
 * ⭐ THE UNCERTAINTY BAND — how wide the ribbon around an edge is drawn.
 *
 * WHY A NEW MARK AND NOT A NEW MEANING ON THE LINE
 * -----------------------------------------------
 * Every channel the line itself owns is already spent, and this module and
 * `edges/edgePresentation.ts` between them say so explicitly: WIDTH is
 * strength (`EDGE_STROKE_WIDTH_BANDS` above, and the legend teaches it),
 * COLOUR is polarity (`EDGE_STROKE_RULES` rule A), DASH is spent three times
 * over (`EDGE_DASH_RULES` carries `contested`, `existence_certainty` and
 * `visual_props`, and `resolveEdgeDash` returns the FIRST match — so a fourth
 * rule is invisible on exactly the edges most in question), and OPACITY is
 * refused outright as a data channel (`StyledEdge.tsx` P2.9: *"two channels for
 * one variable is exactly the encoding overload the audit flags"*).
 *
 * So `strengthStd` had nowhere to go, and went nowhere: it is carried on the
 * wire, stored, USER-EDITABLE (`useInspectorMutations.ts:791`) and rendered in
 * the side panel (`EdgeInspector.tsx:511`, `EdgePanel.tsx:253`) — while the
 * graph, the surface the whole product is named for, never read it. A team
 * could not see which of its causal claims were firm and which were guesses
 * without opening an edge one at a time.
 *
 * The band is a SEPARATE ELEMENT drawn behind the line, not a fourth meaning
 * loaded onto it. That is why it does not violate the P2.9 refusal: the refusal
 * is against giving ONE variable two channels, and this gives a variable with
 * ZERO channels its first. It borrows the statistical-chart idiom a reader
 * already knows — a confidence ribbon around a trend line, where spread means
 * doubt — so it needs no legend entry to be guessed correctly.
 *
 * ⚠ WHAT IT DELIBERATELY CANNOT DO. The half-width FLOORS at
 * `UNCERTAINTY_BAND_MIN_HALF_WIDTH`, so every stated uncertainty draws a
 * visible ribbon however tight it is. Measured consequence, stated rather than
 * hidden: every `strengthStd` below
 * `UNCERTAINTY_BAND_MIN_HALF_WIDTH / UNCERTAINTY_BAND_SCALE` renders at the same
 * floor and is NOT separable from its neighbours, and the 79-edge census puts
 * the observed spread at 0.01–0.22, so that cut sits inside the live range
 * rather than below it. That is the deliberate trade — the alternative is a
 * sub-pixel ribbon, which makes "tight uncertainty" pixel-identical to "nobody
 * said", and this codebase has already paid once for exactly that collision (see
 * `UNSET_EDGE_STROKE_WIDTH` above, where an unset strength rendered identically
 * to a stated weak one). PRESENCE of the band answers *did anyone say?*; WIDTH
 * answers *how much?*, and only above the floor.
 *
 * ⚠⚠ THE NUMBER THAT USED TO SIT ON THAT LINE IS DELETED, NOT UPDATED. It read
 * *"every edge below std ≈ 0.042"* and matched the constants on NEITHER side of
 * this change: with the 2/3/4 ladder on `staging` the floor is 3 and the cut is
 * 3/48 = 0.0625; with the ladder below it is 3.5 and the cut is 3.5/48 ≈ 0.0729.
 * A literal beside a derived constant is the hand-maintained mirror trap 12
 * bans, and re-typing it in the five-rung form would only re-arm it — the
 * expression above cannot drift, because it IS the two constants.
 *
 * ⛔⛔ AND THE FIVE-RUNG STROKE LADDER MOVED THIS FLOOR — a consequence on a
 * channel the strength-vocabulary work does not otherwise touch, established at
 * the bytes and stated here rather than left to be discovered (18 Sep 2026).
 * A fifth rung raises the thickest line from 4 to 5, so the derivation raises
 * the floor from 3 to 3.5 and the band of INDISTINGUISHABLE spreads widens from
 * `std < 0.0625` to `std < 0.0729` — one sixth wider, inside the census range,
 * on the one channel that tells an assessed edge from an unassessed one.
 *
 * ⛔ THE FLOOR IS NOT RESTORED TO 3, and the reason is the invariant rather than
 * inertia. A `veryStrong` line is 5 wide, i.e. 2.5 either side of the path; a
 * floor of 3 leaves the ribbon HALF a graph unit clear of it, at which point the
 * ribbon stops reading as spread AROUND the line and starts reading as the line
 * having got fatter — the precise confusion this floor exists to prevent, and
 * the same collision `UNSET_EDGE_STROKE_WIDTH` was widened to remove one channel
 * along. Pinning the floor at 3 would also make it a LITERAL again, which is
 * what went wrong here in the first place. ⚠ What was defective was leaving the
 * consequence unstated, not the arithmetic: `uncertaintyBandProvenance.spec.ts`
 * now pins the clearance as EXACTLY one graph unit, so a literal re-pinned here
 * REDs instead of quietly halving it.
 */
export const UNCERTAINTY_BAND_SCALE = 48

/**
 * The floor, DERIVED from the stroke ladder rather than chosen: one graph unit
 * clear of the thickest line the width channel can draw, so the ribbon is
 * always readable AS a ribbon and never mistaken for the line having got
 * fatter. Moving `EDGE_STROKE_WIDTH_BANDS` moves this with it.
 */
export const UNCERTAINTY_BAND_MIN_HALF_WIDTH =
  Math.max(...Object.values(EDGE_STROKE_WIDTH_BANDS)) / 2 + 1

/**
 * The ceiling. A `strengthStd` is declared OPEN in `EDGE_VALUE_DOMAINS` — the
 * read gate does not bound it — so without this one pathological value paints
 * a band across the whole board and hides the model. Clamping is a display
 * decision and is NOT silent: the band stops widening, the number in the
 * inspector does not.
 */
export const UNCERTAINTY_BAND_MAX_HALF_WIDTH = 14

/**
 * Half the width of the uncertainty ribbon, in graph units — or `null` when
 * there is no ribbon to draw.
 *
 * ⭐ TAKES THE PROVENANCE UNION, NEVER A `number`. `USER_EDGE_DEFAULTS` writes
 * `strengthStd: 0.15` with no source stamp, so every user-drawn edge carries a
 * fabricated uncertainty — the schema's own docblock records that
 * `KeyRelationships` once rendered it as a "Moderate confidence" dot. A
 * signature taking `number` would let a caller reach a ribbon by reading
 * `edge.data.strengthStd` directly, and that ribbon would be a claim nobody
 * made. There is no argument that can be constructed here meaning "0.15,
 * source unknown" — the same property `edgeValueBand` was built for and
 * `weightMagnitudeToStrokeWidth` above lacks.
 */
export function uncertaintyBandHalfWidth(display: EdgeValueDisplay): number | null {
  if (!display.show) return null
  // A standard deviation is a spread; a negative one is not a tighter spread,
  // it is a value out of its own definition. `EDGE_VALUE_DOMAINS.strengthStd`
  // is declared open, so the gate above will not have caught it.
  if (display.value < 0) return null
  return Math.min(
    UNCERTAINTY_BAND_MAX_HALF_WIDTH,
    Math.max(UNCERTAINTY_BAND_MIN_HALF_WIDTH, display.value * UNCERTAINTY_BAND_SCALE),
  )
}

/**
 * Get risk severity color classes for visual heat display
 * Returns Tailwind classes for background and border
 *
 * @param severity - Severity band from calculateRiskSeverity
 * @returns Object with bg and border color classes
 */
export function getRiskSeverityColors(
  severity: 'low' | 'medium' | 'high' | 'critical' | null
): { bg: string; border: string; text: string } {
  switch (severity) {
    case 'low':
      return {
        bg: 'bg-yellow-100',
        border: 'border-yellow-400',
        text: 'text-yellow-900',
      }
    case 'medium':
      return {
        bg: 'bg-orange-100',
        border: 'border-orange-400',
        text: 'text-orange-900',
      }
    case 'high':
      return {
        bg: 'bg-panel',
        border: 'border-danger',
        text: 'text-danger',
      }
    case 'critical':
      return {
        bg: 'bg-panel',
        border: 'border-danger',
        text: 'text-danger',
      }
    default:
      return {
        bg: 'bg-gray-100',
        border: 'border-gray-300',
        text: 'text-gray-700',
      }
  }
}

/**
 * Get controllability border style class
 * P1 Hotfix: 'unknown' now returns solid (same as default) — we don't visually
 * distinguish unknown because we have no information to display
 *
 * - solid: controllable (directly intervened)
 * - dashed: partial (downstream of intervention)
 * - solid: unknown (no data — don't claim anything)
 *
 * @param controllability - Factor controllability level
 * @returns Tailwind border style class
 */
export function getControllabilityBorderStyle(
  controllability: Controllability | undefined
): string {
  switch (controllability) {
    case 'controllable':
      return 'border-solid'
    case 'observable':
      return 'border-dashed' // Known baseline, not changed by options
    case 'external':
      return 'border-dotted' // Outside user control (market, regulations)
    case 'partial':
      return 'border-dashed' // Legacy: indirectly affected by interventions
    case 'unknown':
      return 'border-solid' // P1 Hotfix: Don't visually distinguish unknown
    default:
      return 'border-solid' // Default
  }
}

/**
 * Controllability/category type for factor nodes
 * CEE V12.4: Now supports explicit category field from CEE
 * - controllable: Options directly set this factor (solid border)
 * - observable: Known baseline, not changed by options (dashed border)
 * - external: Outside user control - market, regulations (dotted border)
 * - partial: Legacy - indirectly affected by interventions (dashed border)
 * - unknown: No controllability data available (solid border, no visual distinction)
 */
export type Controllability = 'controllable' | 'observable' | 'external' | 'partial' | 'unknown'

/**
 * CEE factor category values (maps to Controllability)
 */
export type FactorCategory = 'controllable' | 'observable' | 'external'

/**
 * Option with interventions for controllability derivation
 */
interface OptionWithInterventions {
  id: string
  interventions?: Record<string, number | { value: number }>
}

/**
 * Edge for controllability derivation
 */
interface EdgeForControllability {
  source: string
  target: string
}

/**
 * Build reachability set using BFS from intervention targets
 * P1 Hotfix: Multi-hop traversal — all nodes reachable from interventions are 'partial'
 *
 * @param directlyControlled - Set of factor IDs directly targeted by interventions
 * @param edges - Canvas edges for graph traversal
 * @returns Set of all node IDs reachable from intervention targets (excluding directly controlled)
 */
function buildReachableSet(
  directlyControlled: Set<string>,
  edges: EdgeForControllability[] | undefined
): Set<string> {
  const reachable = new Set<string>()

  if (!edges || edges.length === 0) {
    return reachable
  }

  // Build adjacency list for BFS (source -> targets)
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, [])
    }
    adjacency.get(edge.source)!.push(edge.target)
  }

  // BFS from all directly controlled nodes
  const queue = [...directlyControlled]
  const visited = new Set<string>(directlyControlled)

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = adjacency.get(current) || []

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
        // Only add to reachable if not directly controlled
        if (!directlyControlled.has(neighbor)) {
          reachable.add(neighbor)
        }
      }
    }
  }

  return reachable
}

/**
 * Derive controllability from graph structure
 * P1 Hotfix: Multi-hop BFS traversal for partial controllability
 *
 * Logic:
 * 1. Factor has option intervention targeting it? → controllable (solid border)
 * 2. Factor is reachable from any controllable factor via BFS? → partial (dashed border)
 * 3. Otherwise → unknown (solid border, default — we don't claim anything)
 *
 * @param nodeId - The factor node ID to check
 * @param options - CEE analysis options with interventions
 * @param edges - Canvas edges for graph traversal
 * @returns Controllability level
 */
/**
 * Format a numeric value for display
 * Task 4: Better value display formatting
 * UI Polish: Percentage formatting fix
 *
 * Rules:
 * - Max 2 decimal places for non-currency values
 * - Thousands separator (comma) for large numbers
 * - Handles negative numbers correctly
 * - Returns original value if not a valid number
 * - Percentage: If unit is '%' and value is in [0,1], multiply by 100 and append '%'
 *
 * @param value - The numeric value to format
 * @param unit - Optional unit (if 'currency' or starts with '$', uses locale currency formatting)
 * @param label - Optional label to help detect 0-1 scale (e.g., "proportion", "fraction")
 * @returns Formatted string (includes unit suffix for %)
 */
export function formatDisplayValue(
  value: number | undefined | null,
  unit?: string,
  label?: string
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '—'
  }

  // Check if currency unit
  const isCurrency = unit === 'currency' || unit?.startsWith('$') || unit?.startsWith('£') || unit?.startsWith('€')

  if (isCurrency) {
    // Use locale currency formatting with 2 decimals
    const formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    // P1 Fix: Strip .00 for whole numbers (e.g., £100,000.00 → £100,000)
    return formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted
  }

  // UI Polish Task 1: Handle percentage formatting
  // If unit is '%' and value appears to be in 0-1 scale, multiply by 100
  if (unit === '%') {
    // Value in [-1,1] range → assume 0-1 scale, multiply by 100
    // |value| > 1 → assume already a percentage, don't multiply
    // Fix: Handle negative values (e.g., -0.2 → -20%)
    const isZeroOneScale = Math.abs(value) <= 1
    const displayValue = isZeroOneScale ? Math.round(value * 100) : Math.round(value)
    return `${displayValue}%`
  }

  // Non-currency: max 2 decimal places, thousands separator
  // Check if the value needs decimal places
  const hasDecimals = value % 1 !== 0

  if (hasDecimals) {
    // Round to max 2 decimal places
    const rounded = Math.round(value * 100) / 100
    return rounded.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }

  // Integer: just add thousands separator
  return value.toLocaleString('en-US')
}

/**
 * UI Polish Task 4: Strip technical annotations from labels
 * Removes common technical suffixes that shouldn't be user-facing.
 *
 * @param label - The raw label string
 * @returns Cleaned label without technical annotations
 */
export function cleanDisplayLabel(label: string | undefined): string {
  if (!label) return ''

  // Strip common technical annotations
  return label
    .replace(/\s*\(higher\s*=\s*worse\)/gi, '')
    .replace(/\s*\(lower\s*=\s*worse\)/gi, '')
    .replace(/\s*\(higher\s*=\s*better\)/gi, '')
    .replace(/\s*\(lower\s*=\s*better\)/gi, '')
    .trim()
}

export function deriveControllability(
  nodeId: string,
  options: OptionWithInterventions[] | undefined,
  edges: EdgeForControllability[] | undefined,
  category?: FactorCategory | string
): Controllability {
  // CEE V12.4: If explicit category is provided, use it directly
  // This takes precedence over BFS derivation
  // P1 Hotfix: Normalize category to handle LLM output inconsistencies
  // (e.g., "External", "external ", "CONTROLLABLE")
  if (category) {
    const normalizedCategory = category.trim().toLowerCase()
    const validCategories: FactorCategory[] = ['controllable', 'observable', 'external']
    if (validCategories.includes(normalizedCategory as FactorCategory)) {
      return normalizedCategory as Controllability
    }
  }

  // Fallback: BFS-based derivation for backward compatibility
  if (!options || options.length === 0) {
    return 'unknown'
  }

  // Step 1: Build set of directly controlled factor IDs (factors targeted by interventions)
  const directlyControlled = new Set<string>()
  for (const option of options) {
    if (option.interventions && typeof option.interventions === 'object') {
      for (const factorId of Object.keys(option.interventions)) {
        directlyControlled.add(factorId)
      }
    }
  }

  // Check if this factor is directly controlled
  if (directlyControlled.has(nodeId)) {
    return 'controllable'
  }

  // Step 2: P1 Hotfix — BFS traversal for multi-hop reachability
  // All factors reachable from intervention targets are 'partial'
  const reachable = buildReachableSet(directlyControlled, edges)
  if (reachable.has(nodeId)) {
    return 'partial'
  }

  // Step 3: Otherwise, unknown — we don't have controllability data
  return 'unknown'
}
