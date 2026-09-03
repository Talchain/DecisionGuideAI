/**
 * CanvasLegendPopover — a compact "How to read this" toolbar disclosure.
 *
 * Presentational only in the sense that matters: it triggers no actions and
 * mutates nothing. Opens on click (keyboard: Enter/Space activates); dismissed
 * via outside-click or Esc. Focus alone does not open it. Every rendered
 * string is brief/amendment-approved (A4) — no Claude-authored copy, and no
 * "node/edge/graph" wording.
 *
 * ⚠ IT IS NO LONGER "reads nothing from the graph", AND THE OLD SENTENCE IS
 * QUOTED BECAUSE IT WAS THE REASON THE NUMBER ROWS COULD LIE. A key that cannot
 * see the phase has to describe every phase at once, and five of its seven
 * number rows described markings that render only after a completed analysis —
 * so a first-time reader, who opens the key PRECISELY BECAUSE they are
 * confused, was told to look for badges that were on no card.
 *
 * It now reads TWO fields — `results.status` and `optionNumbering` × `nodes` —
 * because one axis was not enough and a review proved it: the ordinal badge
 * OUTLIVES the run that minted it, so a status-only gate withheld the row while
 * the numbers were still on the cards. Each row is gated on the predicate ITS
 * OWN CARD uses. See `LegendBoardState` and `METRIC_ROW_VISIBLE`.
 *
 * ⚠ The rule above used to end "if more copy is ever needed here, stop and ask
 * Paul." R6 (Paul, 16 Aug 2026) is that instruction being given: "orange
 * reserved for contested connections only, WITH A LEGEND." The colour and
 * direction rows below are added under that ruling; the vocabulary constraint
 * is unchanged and still enforced by this component's spec. Any FURTHER copy
 * still stops and asks.
 *
 * L-49: the canvas spoke four vocabularies with no key — solid vs dashed, +/-
 * markers, thickness, and colour. The legend explained the first and the third.
 * Worse, it taught up/down ARROWS for direction, which the canvas has never
 * drawn: direction is a line colour plus a + or - marker. Every row here is now
 * derived from what StyledEdge actually paints.
 */
import { useRef, useEffect, useLayoutEffect, useState, useCallback, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { NodeShapeIndicator } from '../nodes/NodeShapeIndicator'
import { typography } from '../../styles/typography'
import toolbarStyles from '../../components/layout/CanvasFloatingToolbar.module.css'
import { DECISION_NODE_LABEL } from '../domain/vocabulary'
import { classifyNodeProvenance } from '../domain/valueProvenance'
import { STRUCTURAL_PROVENANCE_LABEL } from '../domain/nodeProvenanceClaim'
import { VALUE_PROVENANCE_ICON } from '../domain/valueProvenanceIcon'
import { METRIC_LEGEND_ROWS, METRIC_NOUN, METRIC_UNSET, type MetricLegendRow } from '../nodes/shared/metricVocabulary'
import { useCanvasStore } from '../store'

interface LegendRow {
  label: string
  swatch: ReactNode
}

// Shape swatches reuse the same indicators users see on the cards.
const TYPE_ROWS: LegendRow[] = [
  { label: DECISION_NODE_LABEL, swatch: <NodeShapeIndicator nodeKind="decision" size={12} /> },
  { label: 'Option', swatch: <NodeShapeIndicator nodeKind="option" size={12} /> },
  { label: 'Factor', swatch: <NodeShapeIndicator nodeKind="factor" size={12} /> },
  { label: 'Outcome', swatch: <NodeShapeIndicator nodeKind="outcome" size={12} /> },
  { label: 'Risk', swatch: <NodeShapeIndicator nodeKind="risk" size={12} /> },
  { label: 'Goal', swatch: <NodeShapeIndicator nodeKind="goal" size={12} /> },
  {
    label: 'Outside your control',
    // Dashed factor (circle) — mirrors the external-factor border treatment.
    swatch: <span aria-hidden="true" className="inline-block w-3 h-3 rounded-full border-[0.5px] border-dashed border-text-light shrink-0" />,
  },
]

function LineSwatch({ dashed, stroke = 'var(--text-body)', width = 1.5, mark }: {
  dashed?: boolean
  stroke?: string
  width?: number
  /** Optional polarity marker drawn beside the line, as the canvas draws it. */
  mark?: '+' | '−'
}) {
  return (
    <span className="inline-flex items-center gap-0.5" style={{ flexShrink: 0 }}>
      <svg width={mark ? 17 : 24} height={Math.max(width + 2, 8)} aria-hidden="true" style={{ flexShrink: 0 }}>
        <line
          x1={0}
          y1={Math.max(width + 2, 8) / 2}
          x2={mark ? 17 : 24}
          y2={Math.max(width + 2, 8) / 2}
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={dashed ? '3 2' : undefined}
        />
      </svg>
      {mark && (
        <span aria-hidden="true" style={{ color: stroke, fontWeight: 700, fontSize: '11px', lineHeight: 1 }}>
          {mark}
        </span>
      )}
    </span>
  )
}

const CONNECTION_ROWS: LegendRow[] = [
  { label: 'Solid connection: established', swatch: <LineSwatch dashed={false} /> },
  { label: 'Dashed connection: less certain', swatch: <LineSwatch dashed /> },
]

// Direction, as the canvas actually draws it: the line's colour, plus a + or -
// marker beside the label. `--edge-positive` / `--edge-negative` / `--edge-neutral`
// are the same tokens computeDirectionStroke() picks from, so this key cannot
// drift from the connections it describes.
//
// The grey row is the one that matters most and was missing entirely: grey is
// how the canvas says "nobody has stated this yet". Without it a reader has no
// way to tell an honest blank from a weak effect.
const DIRECTION_ROWS: LegendRow[] = [
  { label: 'Raises', swatch: <LineSwatch stroke="var(--edge-positive)" width={2} mark="+" /> },
  { label: 'Lowers', swatch: <LineSwatch stroke="var(--edge-negative)" width={2} mark="−" /> },
  { label: 'Grey: direction not set yet', swatch: <LineSwatch stroke="var(--edge-neutral)" width={2} /> },
]

// Colour, R6. Exactly one meaning is reserved on a connection: orange means the
// two reviews disagreed and it is waiting on the person. Every other orange the
// canvas used to paint on a connection (fragility, assumption flags, who set a
// value) has moved off the hue, so this row is true.
const COLOUR_ROWS: LegendRow[] = [
  {
    label: 'Orange: reviews disagree — your call',
    swatch: <LineSwatch stroke="var(--semantic-warning)" width={2} dashed />,
  },
]

function ThicknessSwatch({ width, stroke = 'var(--text-body)', testId }: {
  width: number
  /** Stroke colour. The "no strength suggested" row NEEDS this: at 1.5px it is
   *  the same width as "Weak effect", so colour is its only discriminator — a
   *  swatch that hard-coded the body colour rendered the two rows
   *  pixel-identical and the row's own caption ("thin and grey") was false
   *  about itself. */
  stroke?: string
  testId?: string
}) {
  // Height grows with the stroke so the thickest sample isn't clipped; the line
  // is inset by the max half-width so its round caps stay inside the 24px swatch.
  const h = Math.max(width + 2, 8)
  return (
    <svg width={24} height={h} aria-hidden="true" style={{ flexShrink: 0 }} data-testid={testId}>
      <line
        x1={4}
        y1={h / 2}
        x2={20}
        y2={h / 2}
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
      />
    </svg>
  )
}

// Thickness = effect strength (weight magnitude), the same meaning in both
// phases (P2.9 — thickness no longer switches to composite importance after a
// run). Stroke widths mirror weightMagnitudeToStrokeWidth() in
// graphDisplayCalculations.ts: |mean| < 0.4 → 1.5, ≥ 0.4 → 2, ≥ 0.7 → 3.
// Folded in from the former standalone EdgeThicknessLegend so the two
// bottom-left legends are now one key.
const THICKNESS_ROWS: LegendRow[] = [
  { label: 'Weak effect', swatch: <ThicknessSwatch width={1.5} testId="legend-thickness-weak" /> },
  { label: 'Moderate effect', swatch: <ThicknessSwatch width={2} /> },
  { label: 'Strong effect', swatch: <ThicknessSwatch width={3} /> },
  // Honesty row: an unset strength draws at the SAME width as a weak effect
  // (UNSET_EDGE_STROKE_WIDTH is 1.5), so without this the key actively teaches
  // the reader to mistake a blank for a finding. Thickness alone cannot tell
  // them apart — the colour does, which is why this swatch MUST carry the grey
  // stroke. It shipped without one for a review cycle and rendered identical to
  // the row above it, i.e. the caption said "grey" beside a body-coloured line.
  //
  // ⛔ THIS ROW USED TO BE LABELLED "Not set yet", AND THAT COLLIDED THE MOMENT
  // THE CARDS STARTED PRINTING THAT EXACT STRING. Two rows in ONE popover, the
  // same opening words, DIFFERENT conditions — and in the state that matters
  // they contradict each other outright:
  //
  //   this row          `resolveEdgeSignedStrengthDisplay(...).show === false`
  //                     — NOBODY SUPPLIED A FIGURE. Floor width, neutral grey
  //                     (`computeDirectionStroke` returns `neutral` on `!show`).
  //   the card's row    `strengthIsHumanSettled(...) === false`
  //                     — nobody has SETTLED it. The producer's figure may well
  //                     be present, in which case the line is drawn at its
  //                     magnitude in a POLARITY colour: thick and green or rose,
  //                     i.e. the exact opposite of "thin and grey".
  //
  // So a reader who took this row as the key to the card's wording was being
  // taught to expect a thin grey line beside every "Not set yet" card, and a
  // drafted board shows them thick coloured ones. The label now names the
  // condition this row ACTUALLY describes; the card's row carries its own
  // disclosure (`metricVocabulary.ts`, `METRIC_UNSET.standalone`).
  {
    label: 'No strength suggested: thin and grey',
    swatch: <ThicknessSwatch width={1.5} stroke="var(--edge-neutral)" testId="legend-thickness-unset" />,
  },
]

/**
 * ⭐⭐ WHERE AN ELEMENT CAME FROM — the key that stops the new card glyphs being
 * a PRIVATE CODE.
 *
 * `NodeProvenanceMark` was three words on every card ("AI estimate" on 9 of 14
 * on a real deployed model); it is now a glyph, per the founder's ruling that
 * copy identical on every card is furniture. Replacing words with pictures is
 * only an improvement if the pictures are legible to someone who has never seen
 * them. This legend is a real toolbar BUTTON, reachable by keyboard and by
 * touch, and it is the surface that makes the swap honest for a reader who
 * cannot hover.
 *
 * ⚠ DERIVED FROM THE PRODUCER, NOT HAND-LISTED. The rows come from the three
 * `CEEProvenance` literals run through `classifyNodeProvenance` — the same
 * authority the card itself uses — so this key CANNOT list a glyph the canvas
 * does not render, or miss one it does. The glyph comes from the same
 * `VALUE_PROVENANCE_ICON` register the card keys, so the two cannot drift.
 *
 * ⚠ IT USES THE **STRUCTURAL** VOCABULARY, DELIBERATELY. A card shows one of two
 * claims for the same glyph — "AI estimate" on a valued factor, "Olumi suggested
 * this" on an option — and a legend must be true of every card that bears the
 * mark. The structural claim is the one that always holds: a value Olumi
 * estimated IS something Olumi suggested. The value claim is a NARROWING of it,
 * so keying the legend to the narrower sentence would make the legend false on
 * the majority of cards.
 */
const PROVENANCE_ROWS: LegendRow[] = (['user_set', 'from_brief', 'ai_inferred'] as const)
  .map((literal) => {
    const kind = classifyNodeProvenance(literal)!.kind
    const Icon = VALUE_PROVENANCE_ICON[kind]
    return {
      label: STRUCTURAL_PROVENANCE_LABEL[kind],
      // Declared at the DS canvas-badge 14px. No counter-scale here: the legend
      // is panel DOM, outside React Flow's transform, so the plain size is the
      // rendered size (this is what the `var(…, 1)` fallback on the card's own
      // class is for).
      swatch: <Icon className="w-3.5 h-3.5 text-text-light shrink-0" aria-hidden="true" />,
    }
  })

/**
 * ⭐⭐ THE NUMBERS — Paul, 31 Aug 2026: "Four different number vocabularies on
 * one screen, none explained… one noun per idea, and a legend where the model
 * is, not in a panel."
 *
 * This popover already explained every VISUAL channel the canvas uses — shape,
 * line style, thickness, direction, colour, provenance glyph — and not one of
 * the numbers printed on the cards. A reader could learn what a dashed line
 * meant and still have no way to find out what `Ahead 47%` counted. The nouns
 * were the more visible half of the defect; this is the half that makes them
 * mean something.
 *
 * ⚠ NO SWATCH, SO NOT `LegendGroup`. Every other row keys a picture to a word.
 * A number's "swatch" IS its word, and rendering the noun into the 24px swatch
 * column would either clip it or force the column wider for every row above.
 * These rows are `noun: gloss` sentences instead — which is also why they read
 * in a slightly different voice from the rows above, and that is deliberate:
 * they answer "what does this count?", not "what am I looking at?".
 *
 * ⚠ DERIVED FROM THE REGISTER. The rows come from `METRIC_LEGEND_ROWS`, the
 * same module the cards read their captions from, so this key cannot explain a
 * word the canvas does not print or miss one it does — and
 * `metricVocabulary.spec.ts` REDs if a noun gains no row. Hand-listing them
 * here would be the mirror the register was introduced to abolish.
 */
/**
 * ⭐⭐⭐ THE ROWS A PRE-RUN READER CANNOT SEE ARE NOT SHOWN TO A PRE-RUN READER.
 *
 * MEASURED ON THE DEPLOYED BUILD `bd18bace`: the row *"1, 2, 3 on an option: the
 * order the options were first laid out in…"* described a marking that was on
 * **none of the four option cards** — established by full leaf enumeration
 * including `sr-only`, at scale 0.355 and again at 2.61 with detail expanded,
 * with a contrast control that DID find a single-digit badge elsewhere on the
 * page. The probe was not blind; the numbers genuinely were not there.
 *
 * ⭐ AND IT WAS NOT ONE ROW. Enumerating all seven rows against their render
 * sites found FIVE in the same state. Derived at each card's own gate:
 *
 *   Ahead   POST-RUN  `OptionNode:1498` `winReadout !== null`, and `winReadout`
 *                     returns null unless `displayMetadata.isResultsMode`
 *                     (`useNodeDisplayMetadata:226`, `resultsStatus ===
 *                     'complete'`). Second site `DecisionNode:764`, gated
 *                     harder still on `deriveDecisionVerdict().hasLeadingOption`.
 *   Chance  POST-RUN  `GoalNode:223` `hasThreshold && isResultsMode &&
 *                     achievementProbability !== null`; the figure is
 *                     `selectGoalProbability(report)`.
 *   Influence POST-RUN `FactorNode:997` `isPostAnalysis && … influencePct != null`.
 *                     ⚠ It is SENSITIVITY OUTPUT, not an authored weight —
 *                     `selectDriverPolicyFeed(report)`. Pre-run the factor card
 *                     renders `EdgePills` instead, which says "Link strength".
 *   #1,#2,#3 POST-RUN `BaseNode:738` `typeof sensitivityRank === 'number'`;
 *                     `sensitivityRank` is null whenever `!isResultsMode || !report`.
 *   1,2,3   POST-RUN  `OptionNode:1459` `stableOptionNumber != null`. The node's
 *                     OWN gate carries no results term — which is why this one
 *                     had to be derived rather than read off the card — but
 *                     `optionNumbering` has exactly ONE writer
 *                     (`store.ts:5010` `registerOptionNumbering`) with exactly
 *                     ONE production call site
 *                     (`useResultsSectionData.ts:3874`), whose ids come from
 *                     `recommendation.allOptions`, which is `[]` under
 *                     `if (!hasCompletedFirstRun || !report)`
 *                     (`useResultsSectionData.ts:1712`). So pre-run the map
 *                     stays `{}` and the badge cannot mount.
 *
 *   Strength PRE-RUN  `RiskNode` / `OutcomeNode` render on `bridgeEdgeData`
 *                     alone — a memo over `state.edges`/`state.nodes` ONLY, no
 *                     report and no status.
 *   Not set  PRE-RUN  the same memo's `strengthIsSettled === false` arm, and
 *              yet     pre-run is where it is MOST on screen: a drafted model
 *                     arrives with every bridge strength unset.
 *   est.     PRE-RUN  `FactorNode:911` `isInferred` (`data.observedState`).
 *                     ⚠ CORRECTED 3 Sep 2026 — this row also named
 *                     `RiskNode:265` / `OutcomeNode:267` `bridgeIsEstimated`.
 *                     That identifier no longer exists: those cards print
 *                     `METRIC_UNSET.standalone` instead of a figure plus a 7px
 *                     marker, so `est.` is now a FACTOR-ONLY marking.
 *                     ⚠⚠ CORRECTED AGAIN, SAME DAY — the sentence that stood
 *                     here said "its row stays always-live for that reason".
 *                     FALSE, and it was false when written: deleting two of
 *                     three producers is a reason to gate the row, not to keep
 *                     it unconditional. The surviving site is gated on
 *                     `isInferred && !isDetailed`, and `isDetailed` is
 *                     BOARD-level (`viewMode === 'expert'`), so in expert view
 *                     the marker renders NOWHERE. The row is now gated on
 *                     `estimateMarkersOnScreen`.
 *
 * ⛔ THE FIX IS WHEN A ROW IS SHOWN — NOT WHEN A NUMBER IS MINTED, AND NOT THE
 * WORDS. Changing ordinal minting is a separate decision with its own
 * consequences (`Option 2` would stop meaning one option), and the glosses in
 * `metricVocabulary.ts` are the merged register — its nouns are correct. This
 * file decides only WHETHER a row is on screen.
 *
 * ⛔ AND NO NEW COPY. This component's contract (top of file) is that every
 * rendered string is brief-approved and "any FURTHER copy still stops and asks".
 * So the alternative fix — rewording the rows to be true in both phases, or
 * adding a "this appears after you run" line — is not available here without
 * Paul. Gating the rows adds zero strings, which is why it is the fix.
 *
 * ⚠ THE CLASSIFICATION IS AN ALLOW-LIST OF THE **PRE-RUN** NOUNS, AND THE
 * DIRECTION IS DELIBERATE. It is the shorter list (2 of 7), and more
 * importantly it FAILS CLOSED: a noun added to the register and forgotten here
 * is treated as post-run, so the worst case is a row withheld from a pre-run
 * reader — never the defect being fixed, which is a row that ASSERTS SOMETHING
 * ABSENT. An allow-list of post-run nouns would fail the other way and reopen it
 * silently.
 *
 * ⚠ A DEFAULT IS NOT A CLASSIFICATION, so the safe default is paired with a
 * spec that REDs when the register gains a noun this file has not placed
 * (`every register noun is classified…`), and with a membership assertion that
 * REDs if a name here stops matching the register — `'est.'` has no exported
 * constant to reference, so it is the one re-typed literal in this file and it
 * needs a guard of its own (CLAUDE.md trap 12). `METRIC_NOUN.strength` is a
 * reference and cannot drift.
 */
/**
 * What the legend needs to know about the board to decide which rows are true.
 *
 * ⚠ TWO FIELDS, NOT ONE, AND THE SECOND ONE IS A CORRECTION.
 *
 * The first version of this fix gated every withheld row on `isPostAnalysis`
 * alone. A reviewer refuted it, and the refutation is the MIRROR IMAGE of the
 * defect being fixed: `optionNumbering` is APPEND-ONLY and is cleared by exactly
 * four paths (import, new decision, `loadScenario`, hydrate) — **none of them
 * tied to `results.status`**. `resultsAnalysing()`, `resultsError()` and
 * `resultsReset()` all leave it intact. So after any completed run, every
 * non-`complete` status shows `1 2 3` on the cards WITH NO ROW EXPLAINING THEM.
 * Measured 7/7 across the `ResultsStatus` union; the most reachable path is a
 * labelled button — Run, then "Clear results" (`NodeInspector.tsx:846`), then
 * open the key. Durable state, not a transient.
 *
 * ⭐ THE LESSON, AND IT IS THE ONE THIS FILE ALREADY CONTAINED: gate on THE
 * MARKING, NOT ON THE RUN. Four of these rows gate on the same predicate their
 * card uses; the ordinal row was gated on a PROXY for its card's predicate, and
 * a proxy is exactly a second authority that agrees on the day it is written
 * (CLAUDE.md trap 21). The repo even held the counter-example the whole time:
 * `OptionNode.spec.tsx:2352` renders the badge with `results.status: 'idle'` and
 * is green. Two specs in one suite would have disagreed about whether the
 * marking is on screen.
 */
export interface LegendBoardState {
  /** `results.status === 'complete'` — the predicate the cards restate. */
  readonly isPostAnalysis: boolean
  /**
   * At least one MOUNTED node carries an ordinal, i.e. a badge is on screen.
   *
   * Read from the same source the badge reads (`optionNumbering[node.id]`,
   * `OptionNode:401,1459`) rather than from a status. Intersected with `nodes`
   * rather than testing the map for emptiness, so a number left in the map for a
   * node that is no longer mounted cannot make the row promise a badge nobody
   * can see — the same direction of error this whole change exists to close.
   */
  readonly ordinalsOnScreen: boolean
  /**
   * ⭐ At least one MOUNTED card can render an `est.` marker.
   *
   * ⛔ WHY THIS FIELD EXISTS: THIS CHANGE DELETED TWO OF THE MARKER'S THREE
   * PRODUCERS WHILE ITS ROW STAYED `() => true`.
   *
   * `<EstimateMarker />` had three production sites — `FactorNode:911`,
   * `RiskNode:265`, `OutcomeNode:267`. The risk and outcome cards now print
   * `METRIC_UNSET.standalone` instead of a figure plus a marker, so there is
   * ONE site left, and its gate is `isInferred && !isDetailed`.
   *
   * `isDetailed` is `viewMode === 'expert'` (`FactorNode:47`) — a BOARD-level
   * setting, not per-card. So in expert view the marker cannot render ANYWHERE,
   * and an always-live row explained a marking the reader could not find. That
   * is the exact harm `METRIC_ROW_VISIBLE` was introduced to close, walked
   * through from the other side: the register spec REDs when a noun GAINS no
   * row, and was structurally blind to a noun whose PRODUCERS were removed.
   *
   * ⚠ BOTH BOARD-LEVEL TERMS ARE CAPTURED EXACTLY, AND THE RESIDUAL IS STATED.
   * `FactorNode:909` also requires `valueDisplay !== null`, which is derived
   * inside the card from several fields. Re-deriving it here would be a SECOND
   * AUTHORITY that agrees on the day it is written (trap 21), so it is not
   * attempted. The residual over-show is therefore "expert view off, an
   * inferred factor is mounted, but that factor renders no value line" — a
   * strictly narrower set than the `() => true` this replaces, and the
   * direction of the remaining error is unchanged, not widened.
   */
  readonly estimateMarkersOnScreen: boolean
}

/**
 * ⭐⭐ ONE PREDICATE PER ROW, EACH DERIVED FROM ITS OWN CARD'S GATE.
 *
 * ⚠ THIS REPLACED A TWO-WAY PRE/POST SPLIT, AND THE SPLIT WAS THE BUG. A single
 * phase axis cannot express "the badge outlives the run that minted it", so the
 * ordinal row was necessarily gated on something adjacent to its truth rather
 * than on its truth. Per-row predicates cost more lines and are the only shape
 * that can be RIGHT for a row whose marking has its own lifetime.
 *
 * Derived at each render site (line numbers are at `bd18bace`):
 *
 *   Ahead     `OptionNode:1498` `winReadout !== null`, null unless
 *             `displayMetadata.isResultsMode`; `DecisionNode:764` gated harder
 *             still on `deriveDecisionVerdict().hasLeadingOption`.
 *   Chance    `GoalNode:223` `hasThreshold && isResultsMode &&
 *             achievementProbability !== null`.
 *   Influence `FactorNode:997` `isPostAnalysis && … influencePct != null`.
 *             ⚠ SENSITIVITY OUTPUT, not an authored weight — pre-run the card
 *             renders `EdgePills`, which says "Link strength": a different word
 *             for a different quantity, so this row was not merely early.
 *   #1,#2,#3  `BaseNode:738` `typeof sensitivityRank === 'number'`; null
 *             whenever `!isResultsMode || !report`.
 *   1,2,3     `OptionNode:1459` `stableOptionNumber != null` — AND NOTHING ELSE.
 *             Its gate carries no results term at all, which is the whole of F1.
 *   Strength  `RiskNode` / `OutcomeNode` render on `bridgeEdgeData != null`, a
 *             memo over `state.edges`/`state.nodes` only.
 *   Not set yet  the same memo's `strengthIsSettled === false` arm.
 *   est.      `FactorNode:911` `isInferred && !isDetailed` — factor values only
 *             since 3 Sep 2026. Graph-authored; no results term, but `isDetailed`
 *             is `viewMode === 'expert'`, a BOARD-level setting, so this row is
 *             gated on `estimateMarkersOnScreen` and NOT always-live.
 *
 * ⚠ THE LIST ABOVE IS THE PRIMARY SITE PER NOUN, NOT THE ONLY ONE. A completeness
 * sweep found SEVEN MORE, and the correction is recorded here rather than left
 * as a tidy-looking table that is quietly short (trap 12d — a derived guard
 * proves agreement, never completeness):
 *
 *   POST-RUN, all routed through `displayMetadata`, so the classification is
 *   unchanged: `lodMetricLine:221` (factor LOD, Influence), `:249` (option LOD,
 *   Ahead), `:305` (outcome LOD, Chance); `FactorNode:728` (detailed bar row,
 *   mounted at `:1018` and at the `:1069` hover popover); `OutcomeNode:180`
 *   (`detailedMetrics`, mounted at `:284`).
 *
 *   PRE-RUN, and these do NOT route through `displayMetadata`:
 *   `RiskNode` and `OutcomeNode` paint their bridge-strength reduced LOD lines
 *   straight off `bridgeEdgeData`. They land on the same side as the primary
 *   Strength row, so the conclusion holds — but it holds for a different reason
 *   than "everything goes through `displayMetadata`", and a reader checking
 *   that premise would have found it false.
 *
 *   ⚠ CORRECTED 3 Sep 2026 — this paragraph said those lines paint
 *   `Strength N% est.`. They no longer can: a strength nobody set now renders
 *   `METRIC_UNSET.standalone` with no figure and no bar, on the card and on the
 *   reduced line alike. `est.` survives on `FactorNode`'s own value only.
 *   ⚠⚠ AND THAT IS WHY ITS ROW IS NOW GATED, NOT WHY IT IS ALWAYS-LIVE — the
 *   first version of this paragraph drew the opposite conclusion from the same
 *   fact. Losing producers narrows a marking's reach; it never widens it.
 *
 * ⚠ `OutcomeNode:253` WAS WRONG IN THE FIRST VERSION OF THIS BLOCK — that line
 * is now inside a comment and the gate is `:258`. Line numbers in a docblock are
 * a hand-maintained mirror; they are kept because they are how the next reader
 * finds the gate, and they are pinned to `bd18bace`. Re-derive before relying.
 *
 * ⚠ AN UNKNOWN NOUN FAILS CLOSED — it is withheld rather than falsely promised,
 * because a row that promises an absent marking is the harm this file exists to
 * prevent. A safe default is not a decision, so the spec REDs when the register
 * grows a noun this map has not placed, and when a key here stops matching the
 * register (three keys are re-typed literals with no exported constant).
 */
const METRIC_ROW_VISIBLE: Readonly<Record<string, (b: LegendBoardState) => boolean>> = {
  [METRIC_NOUN.ahead]: (b) => b.isPostAnalysis,
  [METRIC_NOUN.chance]: (b) => b.isPostAnalysis,
  [METRIC_NOUN.influence]: (b) => b.isPostAnalysis,
  [METRIC_NOUN.strength]: () => true,
  '#1, #2, #3': (b) => b.isPostAnalysis,
  '1, 2, 3 on an option': (b) => b.ordinalsOnScreen,
  // ALWAYS LIVE, and pre-run is exactly when it is most on screen: a drafted
  // model arrives with every bridge strength unset, so the risk and outcome
  // cards say this before any analysis has run.
  [METRIC_UNSET.standalone]: () => true,
  // ⛔ NO LONGER `() => true`. Two of this marker's three producers were deleted
  // by the same change that left this row unconditional — see
  // `LegendBoardState.estimateMarkersOnScreen`. The surviving site is gated on a
  // BOARD-level setting (`viewMode === 'expert'`), so in expert view the row
  // promised a marking that could not render anywhere on the board.
  'est.': (b) => b.estimateMarkersOnScreen,
}

/** The nouns this file classifies. Exported so the spec can assert BOTH directions. */
export const CLASSIFIED_METRIC_NOUNS: readonly string[] = Object.keys(METRIC_ROW_VISIBLE)

/**
 * The rows to render for a given board state.
 *
 * Exported so the spec asserts the SAME function the component renders through,
 * rather than re-deriving the split and agreeing with itself (CLAUDE.md 13b).
 */
export function visibleMetricRows(board: LegendBoardState): readonly MetricLegendRow[] {
  return METRIC_LEGEND_ROWS.filter((r) => METRIC_ROW_VISIBLE[r.noun]?.(board) ?? false)
}

function MetricGroup({ board }: { board: LegendBoardState }) {
  return (
    <div className="space-y-1.5">
      {visibleMetricRows(board).map(r => (
        <div key={r.noun} className={`${typography.panelMeta} text-text-light`}>
          <span className="text-text-body font-medium">{r.noun}</span>: {r.gloss}
        </div>
      ))}
    </div>
  )
}

function LegendGroup({ rows }: { rows: LegendRow[] }) {
  return (
    <div className="space-y-1.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-6 flex items-center justify-center">{r.swatch}</span>
          <span className={`${typography.panelMeta} text-text-light`}>{r.label}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * ⭐⭐ THE PANEL MUST FIT THE VIEWPORT IT OPENS IN — and until this landed it did
 * not, on the most ordinary window size there is.
 *
 * MEASURED ON THE DEPLOYED BUILD `bd18bace`, 1280×800: the popover rendered
 * **816px tall at y = −43**, with `overflow-y: visible` and
 * `scrollHeight === clientHeight`. Its own heading "How to read this" sat at
 * y = −30 and the first row at y = −6. Both were off-screen and unreachable by
 * ANY means — no scrollbar, no keyboard, no drag. A reader who opened the key
 * could not see what it was or read its first entry.
 *
 * ── THE MECHANISM, AND IT IS BOTH HALVES ────────────────────────────────────
 *
 *  1. THE HEIGHT WAS UNBOUNDED. There was no `max-height` anywhere on this
 *     panel, and the rows have only grown — types, connections, thickness,
 *     direction, colour, provenance, and most recently seven prose rows for the
 *     numbers. At 816px the content does not fit an 800px window AT ALL, so no
 *     amount of repositioning could have saved it. Every row added since the
 *     `w-56` → `w-72` widening made this worse and nothing measured it: the
 *     register's own note conceded "**this is the one claim in this change with
 *     no automated witness**".
 *
 *  2. THE ANCHOR GROWS UPWARD, OFF THE TOP, WITH NO CLAMP. The toolbar is
 *     `position: fixed; bottom: 12px` (`CanvasFloatingToolbar.module.css`) and
 *     this panel is `absolute … bottom-0` inside it. So the panel's BOTTOM is
 *     pinned near the foot of the window and its TOP is
 *     `wrapperBottom − panelHeight` — a number that goes NEGATIVE the moment the
 *     content is taller than the space above the button. There is no flip, no
 *     collision detection and no clamp. At 800px the wrapper's bottom is 773,
 *     and 773 − 816 = **−43**, which is exactly the y that was measured.
 *
 *     ⭐ This is also why it is the HEADING that disappears rather than the last
 *     row: the panel overflows at the end it grows from, and the heading is the
 *     first child.
 *
 * ── THE FIX, AND WHY IT IS MEASURED RATHER THAN WRITTEN IN CSS ───────────────
 *
 * The cap has to be "the distance from the top of the window down to the bottom
 * of this panel", and CSS cannot express that: `calc(100vh - …)` would need the
 * toolbar's bottom offset AND its padding restated here, which is the
 * hand-maintained mirror this estate keeps paying for (CLAUDE.md trap 12) — the
 * toolbar changes its padding, this constant does not, and the drift reads as
 * green. So the cap is DERIVED from the wrapper's own rect, which cannot drift
 * from the layout because it IS the layout.
 *
 *     maxHeight = wrapperBottom − VIEWPORT_GUTTER_PX
 *     ⟹ panelTop = wrapperBottom − panelHeight ≥ VIEWPORT_GUTTER_PX
 *
 * The panel therefore cannot render above the top of the viewport BY
 * CONSTRUCTION, at any window height, rather than by a constant someone chose.
 * The content is the point (the brief's words), so the panel scrolls rather than
 * the rows shrinking: nothing is dropped, everything is reachable.
 *
 * ⚠ THE CSS CAP BELOW IS A SECOND GUARD, NOT THE SAME ONE. Inline style wins
 * over the class, so the class only ever applies before the first measurement or
 * where there is no layout at all (jsdom). It is deliberately CONSERVATIVE —
 * `100vh − 96px` is smaller than the real budget — because its job is only to
 * make an unbounded panel impossible in the CSS alone. A reader who deletes the
 * measurement must still not be able to reproduce the 816px panel.
 */
const VIEWPORT_GUTTER_PX = 12

export function CanvasLegendPopover() {
  // Local open-state — this is now the only canvas legend (the edge-thickness
  // scale is folded in below), so there's no second legend to coordinate with.
  // Display-only; not persisted.
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  /**
   * The measured cap, in px. `null` means "not measured" — NOT "unbounded":
   * the conservative CSS class carries the panel in that state. Kept as state
   * rather than written straight to the node so the value is a render input and
   * a resize re-renders through the normal path.
   */
  const [maxHeightPx, setMaxHeightPx] = useState<number | null>(null)
  /**
   * The SAME predicate the cards use — `isPostAnalysis = resultsStatus ===
   * 'complete'` is restated verbatim in `OptionNode:402`, `FactorNode:46`,
   * `GoalNode:72`, `DecisionNode:156`, `RiskNode:35`, `OutcomeNode:28` and
   * `usePreAnalysisInbound:62`. Reading `results.status` here rather than a
   * derived flag keeps this key on the same clock as the cards it describes: it
   * cannot say a badge is on screen on a status where the card withholds it.
   *
   * (That the predicate is restated in eight places is itself the mirror this
   * estate keeps paying for. Consolidating it touches six node components and is
   * not this lane's to do — noted, not fixed.)
   */
  const isPostAnalysis = useCanvasStore(s => s.results.status === 'complete')
  /**
   * ⭐ THE ORDINAL ROW'S OWN PREDICATE — read from the badge's source, not from
   * the run that minted it. See `LegendBoardState.ordinalsOnScreen` for why a
   * status proxy was wrong here (F1: the badges outlive every non-`complete`
   * status, so the row vanished while the numbers stayed on the cards).
   *
   * ⚠ The selector returns a BOOLEAN, not the map or a derived array —
   * `ci:guard:zustand` (React #185) forbids a bare object selector, and a fresh
   * object identity here would re-render the toolbar on every store tick.
   */
  const ordinalsOnScreen = useCanvasStore(s => {
    const numbering = s.optionNumbering
    if (!numbering) return false
    return s.nodes.some(n => numbering[n.id] != null)
  })
  /**
   * ⭐ THE `est.` ROW'S OWN PREDICATE — read from the marker's surviving gate,
   * `FactorNode:911` `isInferred && !isDetailed`, and from nothing else.
   *
   * `isInferred` is `data.observedState?.extractionType === 'inferred'`
   * (`FactorNode:304`) and `isDetailed` is `viewMode === 'expert'`
   * (`FactorNode:47`) — the SAME store field the card reads, not a proxy for it.
   *
   * ⚠ Intersected with mounted `nodes`, exactly as `ordinalsOnScreen` is, so an
   * inferred factor that is no longer on the board cannot make this key promise
   * a marker nobody can see.
   *
   * ⚠ BOOLEAN SELECTOR, not an object — `ci:guard:zustand` (React #185) forbids
   * a bare object selector and a fresh identity re-renders the toolbar on every
   * store tick. Same reason as `ordinalsOnScreen` above.
   */
  const estimateMarkersOnScreen = useCanvasStore(s => {
    if (s.viewMode === 'expert') return false
    return s.nodes.some(n => {
      if (n.type !== 'factor') return false
      const observed = (n.data as { observedState?: { extractionType?: unknown } } | undefined)?.observedState
      return observed?.extractionType === 'inferred'
    })
  })
  const board: LegendBoardState = { isPostAnalysis, ordinalsOnScreen, estimateMarkersOnScreen }

  /**
   * ⚠ `useLayoutEffect`, not `useEffect`: this runs BEFORE paint, so the panel
   * is never painted at its unbounded height. With `useEffect` the reader gets
   * one frame of the 816px panel — the defect, briefly, on every open.
   *
   * ⚠ AND IT RE-MEASURES ON RESIZE. A cap computed once is a cap that is wrong
   * as soon as the window changes, and shrinking the window is precisely how a
   * reader arrives at the small heights this fix is for.
   */
  useLayoutEffect(() => {
    if (!open) {
      setMaxHeightPx(null)
      return
    }
    const measure = () => {
      const bottom = wrapRef.current?.getBoundingClientRect().bottom
      // jsdom returns 0 for every rect (CLAUDE.md trap 3). A 0 here is "no
      // layout to read", and answering it with a cap of `-12` would collapse the
      // panel; fall back to the CSS guard instead of inventing a number.
      if (typeof bottom !== 'number' || !Number.isFinite(bottom) || bottom <= 0) {
        setMaxHeightPx(null)
        return
      }
      setMaxHeightPx(Math.max(0, bottom - VIEWPORT_GUTTER_PX))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  const close = useCallback(() => setOpen(false), [])
  // Functional updater stays immune to focus-before-click staleness: a real mouse
  // click fires focus (mousedown) before click, so the toggle must read the live
  // value. No onFocus — keyboard users open via Enter/Space → click.
  const toggle = useCallback(() => setOpen(o => !o), [])

  useEffect(() => {
    if (!open) return
    const onDocPointer = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        /* Shared with the LeftSidebar and the rest of this toolbar; open takes
           the same active treatment the sidebar's lens menu uses. */
        className={open ? toolbarStyles.iconButtonActive : toolbarStyles.iconButton}
        aria-label="How to read this"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="How to read this"
        data-testid="btn-canvas-legend"
      >
        <HelpCircle className={toolbarStyles.icon} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="How to read this"
          /* `flex flex-col` + a capped height is what makes the rows region
             shrinkable; `max-h-[calc(100vh-96px)]` is the conservative CSS
             fallback described above and is overridden by the measured inline
             cap on every real paint. */
          className="absolute left-full ml-2 bottom-0 w-72 flex flex-col max-h-[calc(100vh-96px)] bg-panel border border-panel-border rounded-lg shadow-panel p-3 z-[1200]"
          style={maxHeightPx === null ? undefined : { maxHeight: `${maxHeightPx}px` }}
          data-testid="canvas-legend-popover"
        >
          {/* The heading stays OUT of the scroll region. It was the element the
              defect put off-screen, and pinning it means a reader always knows
              what they have opened, however far they scroll. */}
          <div className={`${typography.panelMeta} text-text-body font-medium mb-2 shrink-0`}>How to read this</div>
          {/* ⚠⚠ `min-h-0` IS REDUNDANT HERE TODAY, AND THE MEASUREMENT SAYS SO
              — this comment previously claimed it was "load-bearing … without
              it the panel goes back to 816px", and a mutant REFUTED that:
              deleting `min-h-0` left the browser geometry BYTE-IDENTICAL at all
              five viewport heights and every arm still passed. A claim about our
              own code is still a claim (CLAUDE.md 12d).

              WHY it is redundant: a flex item's automatic minimum size
              (`min-height: auto`) is what would refuse to shrink below content —
              but the flexbox spec zeroes it for a box whose `overflow` is
              anything other than `visible`, and this box is `overflow-y: auto`.
              So the SCROLL PROPERTY is already doing the work.

              It is KEPT, not deleted, precisely because that makes the shrink
              behaviour depend on a neighbouring class in the same list: change
              `overflow-y` and the cap would start being ignored with nothing
              else to catch it. Belt and braces, honestly labelled — and the
              surviving mutant is recorded rather than read as a gap in the kit.

              Deliberately NOT `flex-1`: `flex-basis: 0` in an auto-height column
              can collapse the region to nothing. The default `flex: 0 1 auto`
              sizes to content and shrinks only when capped, which is exactly the
              wanted behaviour.

              `overscroll-contain` stops a scroll that reaches the end of this
              list chaining into the canvas behind it. */}
          <div
            className="min-h-0 overflow-y-auto overscroll-contain"
            data-testid="canvas-legend-scroll"
          >
            <LegendGroup rows={TYPE_ROWS} />
            <div className="h-px bg-panel-border my-2" aria-hidden="true" />
            <LegendGroup rows={CONNECTION_ROWS} />
            <div className="h-px bg-panel-border my-2" aria-hidden="true" />
            <LegendGroup rows={THICKNESS_ROWS} />
            <div className="h-px bg-panel-border my-2" aria-hidden="true" />
            <LegendGroup rows={DIRECTION_ROWS} />
            <div className="h-px bg-panel-border my-2" aria-hidden="true" />
            <LegendGroup rows={COLOUR_ROWS} />
            <div className="h-px bg-panel-border my-2" aria-hidden="true" />
            <LegendGroup rows={PROVENANCE_ROWS} />
            <div className="h-px bg-panel-border my-2" aria-hidden="true" />
            <MetricGroup board={board} />
          </div>
        </div>
      )}
    </div>
  )
}
