/**
 * ⭐⭐ HOW FIRM IS THIS FACTOR'S NUMBER — the card's own spread channel.
 *
 * THE QUESTION THIS ANSWERS, AND THE ONE IT DOES NOT
 * --------------------------------------------------
 * A factor card shows a point value (`-60%`, `£40,000`, `Moderate`) and, until
 * this module, nothing at all about how firm that number is. A reader could not
 * tell a measurement from a guess without opening the inspector one node at a
 * time — which is the same complaint `uncertaintyBandHalfWidth` was built to
 * answer for EDGES, one object along.
 *
 * ⛔ IT IS NOT THE EDGE RIBBON, AND IT MUST NOT BE COLLAPSED INTO ONE.
 * The edge ribbon is sourced from `edge.data.strengthStd` and answers *"how
 * firm is the STRENGTH OF THIS LINK?"*. This is sourced from
 * `node.data.observedState.std` and answers *"how firm is THIS FACTOR'S OWN
 * OBSERVED VALUE?"*. Two different quantities on two different objects; they
 * are neighbours, not synonyms (CLAUDE.md trap 21 — naming them apart is the
 * fix, reconciling them is the defect).
 *
 * ⛔ NOR DOES IT ANSWER "WHO SAID THIS". `NodeProvenanceMark` already carries
 * authorship on this same card. Deliberately left to it: one question, one
 * element.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ THE GATE, AND WHY EACH ARM IS NECESSARY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The defect class this lane exists to prevent is a UI default rendered as a
 * fact — the edge panel printing "80%" for a link nobody had characterised. So
 * the union below makes an unstated band UNREPRESENTABLE: `show: true` cannot
 * be constructed without both a spread and a classified author, exactly as
 * `resolveEdgeValueDisplay` does for edge numbers.
 *
 * **1. `absent` — there is no σ here.** Nothing to draw. Measured, and this is
 * the common case: across all five shipped starter drafts,
 * `nodes[].observed_state.std` appears **0 times in 20 observed-state-bearing
 * nodes**, while `edges[].strength.std` appears **163 times** (that asymmetry is
 * precisely why the edge got its ribbon first and the card did not).
 *
 * **2. `no_spread` — σ ≤ 0 is not a statement of firmness.** ⭐ THIS ARM IS A
 * MEASUREMENT, NOT A TIDINESS RULE, and without it this module would ship the
 * exact defect it was written to prevent. In the one real staging capture in
 * this repo that carries node-level σ
 * (`src/test/fixtures/golden-path-staging-2026-04-05.json`), **three of the four
 * σ-bearing records are `std: 0`** — and each sits beside `value: 0`,
 * `raw_value: 0`, `cap: 0`, i.e. a placeholder observed-state record with no
 * observation in it. A floor-width band on those would tell a reader that
 * somebody had stated a very tight spread for a factor nobody had measured at
 * all. (The edge ribbon FLOORS at a minimum width instead, so every stated σ
 * draws. That is right for edges, where σ arrives populated 163 times and a zero
 * does not occur; it would be wrong here.) A negative σ is likewise not a
 * tighter spread but a value outside its own definition.
 *
 * **3. `unattributed` — nobody classified is on the record.**
 * `classifyValueProvenance` returns `null` for any literal the estate's
 * producers are not known to write, and a `null` author means we do not speak
 * the record's numbers.
 *
 * ⚠ A KNOWN AND DELIBERATE GAP, STATED RATHER THAN HIDDEN. `observedState.source`
 * attributes the VALUE, and `setObservedStd` (`useInspectorMutations.ts:541`)
 * merges σ through `setObservedField` WITHOUT touching `source`. So a user who
 * types a σ onto a record that carries no recognised source gets NO band, and a
 * user who types a σ onto a CEE-sourced record gets a band whose record is still
 * stamped `cee_inference`. **That is why `kind` below is returned for the
 * tooltip's hedged wording and is NOT rendered as an authorship claim about σ
 * itself.** Both failure directions here are UNDER-disclosure — a spread that
 * was stated going unshown — never an over-claim, which is the direction
 * `edgeValueProvenance` also chose and for the same reason. Closing it properly
 * needs a write-side `std` stamp (the edge's `strengthStdSource` pattern), which
 * is a producer change and out of this lane's scope.
 *
 * ⚠ THE FABRICATED σ EXISTS, AND IT IS NOT IN SCOPE HERE — VERIFIED, NOT ASSUMED.
 * `src/adapters/plot/v2/adapter.ts:936-946` derives a `computedStd` from the
 * value/baseline delta whenever CEE supplied none. That number is built inside
 * `transformNodeToV2`, which returns a fresh `V2Node` for the PLoT request
 * payload and never writes back to `node.data` — so it cannot reach
 * `observedState.std` and cannot reach this gate. If that ever changes, this
 * module starts drawing confidence intervals nobody stated.
 */
import { classifyValueProvenance, type ValueProvenanceKind } from '../../domain/valueProvenance'
import { unwrapInterventionValue } from '../../utils/labelUtils'

/**
 * A factor's stated observation spread, or a named reason there is none.
 *
 * ⭐ `show: true` REQUIRES BOTH `std` AND `kind`. There is no value a caller can
 * construct here meaning "σ 0.15, author unknown" — the property that makes the
 * fabrication unrepresentable rather than merely unlikely.
 */
export type FactorFirmnessDisplay =
  | {
      show: false
      /**
       * `absent`       — no σ on this node at all.
       * `no_spread`    — σ ≤ 0; a placeholder, not a stated firmness.
       * `unattributed` — σ is present but the record names no classified author.
       */
      reason: 'absent' | 'no_spread' | 'unattributed'
    }
  | { show: true; std: number; kind: ValueProvenanceKind }

/**
 * Resolve a factor node's firmness for display — THE read-side gate.
 *
 * Reads σ through `unwrapInterventionValue`, the same defensive numeric unwrap
 * the inspector's σ field uses (`FactorControllableEditor.tsx:73`), so the card
 * and the editor can never disagree about whether a legacy `{ value: n }` shape
 * is a number.
 */
export function resolveFactorFirmnessDisplay(
  data: Record<string, unknown> | undefined | null,
): FactorFirmnessDisplay {
  if (!data) return { show: false, reason: 'absent' }

  const observed = data.observedState as Record<string, unknown> | undefined
  if (!observed || typeof observed !== 'object') return { show: false, reason: 'absent' }

  const std = unwrapInterventionValue(observed.std).value
  if (std == null || !Number.isFinite(std)) return { show: false, reason: 'absent' }

  // ⛔ Checked BEFORE provenance: a stamped zero is still not a spread, and the
  // stamp is what would license the band to speak.
  if (std <= 0) return { show: false, reason: 'no_spread' }

  const provenance = classifyValueProvenance(
    typeof observed.source === 'string' ? observed.source : null,
  )
  if (provenance === null) return { show: false, reason: 'unattributed' }

  return { show: true, std, kind: provenance.kind }
}

/**
 * ⭐ THE CARD'S OWN SCALE — NOT the edge's, and the duplication is the point.
 *
 * `UNCERTAINTY_BAND_SCALE` / `UNCERTAINTY_BAND_MIN_HALF_WIDTH` in
 * `graphDisplayCalculations.ts` are in SVG GRAPH UNITS and the floor there is
 * DERIVED FROM THE EDGE STROKE LADDER (`max(EDGE_STROKE_WIDTH_BANDS) / 2 + 1`)
 * so a ribbon is never mistaken for the line having got fatter. There is no
 * stroke ladder on a card and these are CSS pixels measured against text, so
 * importing those constants would be borrowing a number whose derivation does
 * not hold here. Two coordinate systems, two scales — this is NOT the
 * hand-maintained mirror of trap 12, because there is no single truth being
 * copied; the shared thing is the IDIOM, and idioms do not drift.
 */
export const FIRMNESS_BAND_MIN_W_PX = 10
/**
 * The ceiling. `observedState.std` has no declared domain, so without this one
 * pathological σ paints a bar the full width of the card. Bounded well inside
 * the card's inner width (`NODE_CARD_MAX_W` 336 − `NODE_CARD_PADDING_X` 24), so
 * the band can never be the thing that decides the card's width.
 */
export const FIRMNESS_BAND_MAX_W_PX = 64
/** σ is on the factor's normalised 0–1 scale; 0.2 → 32px, 0.4 → the ceiling. */
export const FIRMNESS_BAND_SCALE_PX = 160

/**
 * The band's width in CSS pixels, or `null` when there is no band to draw.
 *
 * ⭐ TAKES THE UNION, NEVER A `number` — so a future caller cannot reach a width
 * by reading `observedState.std` directly and land a bar that nobody stated.
 *
 * ⚠ WHAT IT DELIBERATELY CANNOT DO, stated rather than hidden: the width FLOORS
 * at `FIRMNESS_BAND_MIN_W_PX`, so every σ below ≈0.06 renders at the same width
 * and those factors are not separable from each other. That is the deliberate
 * trade — a sub-pixel band would make "a very firm number" pixel-identical to
 * "nobody said", which is the collision this whole lane exists to prevent.
 * PRESENCE answers *did anyone state a spread?*; WIDTH answers *how much?*, and
 * only above the floor.
 */
export function firmnessBandWidthPx(display: FactorFirmnessDisplay): number | null {
  if (!display.show) return null
  return Math.min(
    FIRMNESS_BAND_MAX_W_PX,
    Math.max(FIRMNESS_BAND_MIN_W_PX, display.std * FIRMNESS_BAND_SCALE_PX),
  )
}

/**
 * The band's accessible name and tooltip text.
 *
 * ⛔ IT NAMES σ AND REFUSES TO NAME σ'S AUTHOR. The record's `source` attributes
 * the VALUE and σ is independently editable (see the gap note in the header), so
 * "AI estimate" beside a σ the user typed would be a false attribution — the
 * precise untruth `panel` was split from `edited` to avoid. The hedge
 * ("recorded with …") is therefore load-bearing, not vagueness: it states where
 * the OBSERVATION came from, which is true, and claims nothing about who fixed
 * its spread.
 */
export function firmnessBandDescription(display: FactorFirmnessDisplay): string | null {
  if (!display.show) return null
  // ⚠ σ, NOT "±". A standard deviation is not an interval, and "± 0.2" invites a
  // reader to take it as one — a stronger claim than the producer made. The
  // symbol is stated and the band is explained instead.
  const rounded =
    display.std < 0.01 ? display.std.toPrecision(1) : String(Math.round(display.std * 100) / 100)
  return `Spread: σ ${rounded} on this factor's normalised 0–1 scale. The observation it belongs to ${FIRMNESS_SOURCE_PHRASE[display.kind]}. A wider band means a less firm number.`
}

/**
 * How each author reads INSIDE the sentence above. Total over
 * `ValueProvenanceKind`, so a new kind is a type error here rather than a silent
 * fallback — the same rule `VALUE_PROVENANCE_LABEL` follows.
 *
 * ⚠ Lower-case sentence fragments, NOT the `VALUE_PROVENANCE_LABEL` strings.
 * Those are standalone labels ("AI estimate", "Set by you") and reusing them
 * mid-sentence would read as an authorship claim about the spread, which is the
 * one thing this copy must not make.
 */
const FIRMNESS_SOURCE_PHRASE: Readonly<Record<ValueProvenanceKind, string>> = Object.freeze({
  brief: 'was taken from your brief',
  ai: "is Olumi's own estimate",
  confirmed: 'is a value you confirmed',
  edited: 'is a value you set',
  assumption: 'is a value you recorded as an assumption',
  human: 'is a value you set',
  panel: 'came from your panel',
})
