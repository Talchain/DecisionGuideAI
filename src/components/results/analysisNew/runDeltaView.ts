/**
 * "What's changed" — the run-over-run consequence, turned into a view model.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐⭐ TWO STATEMENTS, AND THEY MUST NEVER BE FUSED.
 * ═══════════════════════════════════════════════════════════════════════════
 * `attribution_case` describes the COMPARABILITY CONDITIONS OF THE PAIR. It does
 * NOT describe whether anything moved, and reading it as if it did is the defect
 * this file was rewritten to remove.
 *
 * Measured against the installed schema, all three of these PARSE:
 *
 *     C0_identical     with DIFFERING reported probabilities
 *     C1_attributable  with NO reported movement
 *     C2_unpaired      with IDENTICAL reported probabilities
 *
 * `refineRunDelta` constrains `pair_provenance` and nothing else
 * (`run-delta.js:186-204`) — it says not one word about `win_probabilities`. So
 * "nothing moved" and "this differs" are NOT derivable from the case, and an
 * earlier draft of this surface said both. CLAUDE.md trap 21 inside one sentence:
 * two questions wearing one name.
 *
 * Therefore:
 *   PART A — comparability — reads `attribution_case` ALONE.
 *   PART B — movement      — reads `win_probabilities` ALONE.
 * They render as separate lines and neither may borrow the other's claim.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE MAY NOT DO
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ NO CLIENT-SIDE COMPUTATION OF ANY QUANTITY. The contract is explicit that
 * "the UI renders it with ZERO client-side computation: every number, tag and
 * entitlement below is producer-computed". This module selects sentences and
 * passes numbers through. It does not subtract, threshold, rank or round into a
 * claim.
 *
 * ⛔ `flip_thresholds` IS NOT READ, AND THAT IS DELIBERATE. CEE emits it as a
 * frozen `[]` at every emission today (`claim-safety-cage.ts:311`,
 * `RUN_DELTA_FLIP_THRESHOLDS_NOT_COMPUTED`) because, in its own words, "the join
 * is deferred and we never looked". Its own comment names the hazard: "an empty
 * array read naively ASSERTS there are no flip thresholds, which is a claim we
 * have not earned". That ground alone settles it: there is no honest sentence to
 * build from a value the producer has not earned.
 *
 * ⚠⚠ CORRECTED — an earlier draft of this note gave a SECOND reason that is
 * false, and the true version is a hazard rather than a nuance. It said absence
 * and emptiness are "indistinguishable" here. They are MAXIMALLY distinguishable:
 * `flip_thresholds: z.array(...)` carries NO `.optional()` (target 0 against a
 * contrast of 5 `.optional()` in the same file, `edit_list` among them), so it is
 * REQUIRED. Proven by execution against the vendored 0.55.0 with a must-pass
 * control: the same block PARSES with the field and fails `flip_thresholds
 * Required` without it.
 *
 * ⛔ AND THE FAILURE IS SILENT AND TOTAL. `run_delta` sits in
 * `QUARANTINABLE_ADDITIVE_KEYS` (`responseParser.ts:284`), so a parse failure
 * lifts THE WHOLE KEY out and the turn survives without it — no error, no red,
 * and a section that renders nothing, which is indistinguishable from this
 * feature's own legitimate default. If CEE ever stops emitting the field, the
 * capability goes dark exactly the way the two-writer defect made it dark.
 * Reported to Core; nothing the consumer can guard, because the block is gone
 * before any consumer sees it.
 *
 * ⛔ `edit_list` IS NOT READ EITHER — it is declared in 0.55.0 and emitted
 * nowhere (verified at CEE `78515b95` with a contrast control). When Core ships
 * it, C1's line can name WHICH values changed; until then it degrades to "your
 * change", which the contract explicitly sanctions.
 */

import type { RunDelta, RunDeltaGoalChanceSide, RunDeltaInputChange } from '@talchain/schemas/boundary'
import { formatRawValueWithUnit } from '../../../canvas/utils/labelUtils'
import { compactCarriedReading, formatMoneyFigure } from '../../../utils/unitClassifier'
import { scienceBand } from '../../../components/science/ScienceQuantity'

export type NoiseVerdict = 'signal' | 'within_noise' | 'not_noise_qualified'

/** Which way a score went. Derived from the producer's own two numbers only. */
export type MovementDirection = 'up' | 'down' | 'level'

export interface RunDeltaMovement {
  /** Identity, never a label (contract: "identity-bound (trap 19)"). */
  readonly optionId: string
  /** Resolved from the caller's node map. `null` = this run does not name it. */
  readonly label: string | null
  readonly prior: number
  readonly current: number
  readonly direction: MovementDirection
  /**
   * The producer's tag, VERBATIM. The three states are "deliberately never
   * collapsible" — collapsing `within_noise` into `signal` is precisely how a
   * surface starts reporting sampling movement as a finding.
   */
  readonly noiseVerdict: NoiseVerdict
  /** False for `not_noise_qualified`: direction only, never dressed as signal. */
  readonly mayShowMagnitude: boolean
}

export interface RunDeltaLeaderLine {
  readonly changed: boolean
  readonly noiseVerdict: NoiseVerdict
  /**
   * False when either side's id is absent. The contract is explicit that an
   * absent id means the producer is not entitled to make a claim on that side —
   * never that no such option existed — and that a consumer must not name one.
   */
  readonly mayName: boolean
  readonly priorLabel: string | null
  readonly currentLabel: string | null
}

/** One option's chance of meeting the goal on each side of the pair, as THAT Run's own licence showed it (schemas 0.81.0). */
export interface RunDeltaGoalChanceRow {
  readonly optionId: string
  readonly label: string | null
  readonly prior: RunDeltaGoalChanceSide
  readonly current: RunDeltaGoalChanceSide
}

export interface RunDeltaView {
  /** PART A. */
  readonly comparability: string
  /** True ONLY for `C1_attributable`. Nothing else licenses a causal reading. */
  readonly attributable: boolean
  /**
   * The cause rider, SELECTED BY CASE. `null` on C1 only. ⛔ Not a binary on
   * `attributable`: C0 proves a model change did not happen, while C2/C3/C4
   * merely cannot establish one — opposite claims that a binary fused.
   */
  readonly attributionLimit: string | null
  /** PART B. Empty array + `movementsUnavailable` are different states. */
  readonly movements: readonly RunDeltaMovement[]
  /**
   * True when no option has a comparable pair: the producer sent none, OR the goal's direction or comparison changed
   * between the two Runs (`goalFramingChanged`), so each side's support answers a different question.
   */
  readonly movementsUnavailable: boolean
  /**
   * ⛔ The two Runs answered DIFFERENT QUESTIONS (red team #87 6003625586): the goal's `direction` or `operator` is in
   * the producer's input rows, e.g. "at most" turned "which option scores highest" into "which comes out lowest". The
   * producer still pairs support by option id, but higher/lower or beyond-variation across the two is a direction
   * artefact, so `movements` is withheld and `noPairsText` says why. Absent = no such row (including no input record).
   */
  readonly goalFramingChanged?: true
  /**
   * Compare-chance (schemas 0.81.0, DL #87 6035414740): each option's chance of meeting the goal, in the producer's
   * (model) order, each side under ITS Run's own licence, never the leader gate. Figures only: no direction travels.
   * Absent = the producer sent none (a pre-0.81 CEE), or the goal's direction or comparison changed between the Runs
   * (`goalFramingChanged`: the two chances answer different questions). Empty = no option was compared in both Runs.
   */
  readonly goalChances?: readonly RunDeltaGoalChanceRow[]
  /**
   * 0.70.0: the producer's TYPED reason for an empty `win_probabilities`, or `null` when it sent none. `prior_withheld`
   * = the earlier Run withheld its figures, so this is the first comparison (RC's UNWITHHELD). Never inferred from an
   * empty array.
   */
  readonly winProbabilitiesUnavailable: 'prior_withheld' | 'no_matched_option' | null
  /**
   * ⛔ NOT NULLABLE, AND THE `| null` THAT WAS HERE MADE A TAUTOLOGY DOWNSTREAM.
   * `leader` is REQUIRED on the producer's block — proven by execution against
   * the vendored 0.55.0 with a must-pass control: the same block PARSES with it
   * and fails `leader Required` without it. This builder therefore returns it
   * unconditionally, so `view.leader?.changed` in the section was an optional
   * chain on a value that is never absent: always true, well typed, and reading
   * exactly like a safety check. Absence is expressed INSIDE the line —
   * `changed: false` renders nothing, and `mayName: false` withholds the names.
   */
  readonly leader: RunDeltaLeaderLine
  /**
   * SC-24 (schemas 0.68.0) — WHAT DIFFERED IN THE INPUTS, independent of `attributable`. Producer-built rows in the
   * producer's order; `null` when the producer sent no input comparison (a pre-SC-24 delta).
   */
  readonly inputs: RunDeltaInputsView | null
  /** "Compared with the earlier run at 14:02" — the EARLIER Run named as earlier (AIQ 5915390400 gate 3). */
  readonly comparedWith: string | null
  /**
   * WHICH PAIR THE WORDS DESCRIBE. Absent = `rerun`: this analysis vs the previous one (Compare tab, canvas strip).
   * `versions`: the recorded results of two saved versions (schemas 0.74 `result_comparison`), where `prior` is the
   * version compared FROM and may be the LATER Run, so nothing may say "earlier", "previous" or "last time".
   */
  readonly frame?: RunDeltaFrame
}

export type RunDeltaFrame = 'rerun' | 'versions'

/** One exact input difference, as sentence parts. Nothing here is computed: before/after are the producer's values. */
export interface RunDeltaInputRow {
  /** A React key only (a colon join plus the index; ids can hold ':'). Never parse it — bind to the ids below. */
  readonly key: string
  readonly kind: RunDeltaInputChange['entity_kind']
  /**
   * The producer's identity for this input, copied VERBATIM from its `input_changes` row (UNDO grant #75
   * 5920635710). The canvas binds its marks and click-to-focus to these, so the list and the graph read one row.
   */
  readonly entityId: string
  readonly optionId: string | null
  /** `link` rows only: the link's two ends, verbatim (`entity_id` is opaque for a link). */
  readonly linkEnds: { readonly from: string; readonly to: string } | null
  /** What the input is, in this surface's words ("Pro price, Raise to £60"). */
  readonly subject: string
  /**
   * The same input split for a row layout (Compare v3): the input's own name ("Pro price"; a link as "A → B") and, for an
   * option setting, the option it belongs to ("Raise to £60"). Display only, from the same labels as `subject`; optional so
   * a row built elsewhere without them still reads by `subject`.
   */
  readonly name?: string
  readonly optionLabel?: string | null
  /** The producer's before → after, formatted; `null` on the side where the input did not exist. */
  readonly before: string | null
  readonly after: string | null
  readonly change: RunDeltaInputChange['change']
  /** The producer's field, verbatim: the words branch on it by IDENTITY (0.70.0 `sizing` / `strength`), never on text. */
  readonly field: RunDeltaInputChange['field']
  /** `link` rows only: the link's two ends in this surface's labels (`null` where a label is unknown). */
  readonly linkLabels: { readonly from: string | null; readonly to: string | null } | null
  /**
   * RC's one-sentence-per-link rule (contract `change_label_templates.one_sentence_per_link`): when the producer sends a
   * `sizing` row AND a `strength` row for the same link ("Edit the strength" writes both), the two are ONE change. The
   * strength row is folded into the sizing row here (and dropped from the list), so it counts once and says once.
   */
  readonly strength: { readonly before: string | null; readonly after: string | null } | null
}

export interface RunDeltaInputsView {
  /** `complete` / `partial` carry rows; `not_recorded` carries none and says so. */
  readonly coverage: NonNullable<RunDelta['input_coverage']>
  readonly rows: readonly RunDeltaInputRow[]
}

/** The rows shown before "See all N changes" (ChatGPT 5914416431: up to two, then the producer's total). */
export const INPUT_ROWS_SHOWN_FIRST = 2

/**
 * PART A, by identity. The case enum is "the ONLY input the sentence builder may
 * take", and this is that builder.
 *
 * ⚠ Every arm talks about the PAIR. Not one of them says whether a number moved.
 */
const COMPARABILITY: Record<RunDelta['attribution_case'], string> = {
  // ⛔ "A CHANGE TO THE MODEL", NEVER "YOUR CHANGE" — and the distinction is not
  // pedantry. C1 is `seed_equal && !hash_equal && builds_equal='equal' &&
  // n_equal`: it establishes that THE MODEL CHANGED and that nothing else did.
  // It carries nothing whatever about WHO changed it, and Olumi's own graph_patch
  // path moves that same hash. Saying "your change" would attribute authorship the
  // producer never sent — entitled by the pair's comparability and unentitled by
  // what the product actually knows. That is the defect this file's header
  // describes, one level up in the prose, and `edit_list`'s absence makes it worse:
  // we cannot even name WHAT changed, let alone who did it.
  C1_attributable:
    'The only difference between this analysis and the previous one is a change to the model.',
  // ⛔ BOUNDED TO WHAT `hash_equal` PROVES (P0 5943180154, served 2 Oct): the ANALYSIS-AFFECTING hash excludes
  // authorship and provenance, so an accepted estimate (sizing olumi_estimate → accepted) is a real model change on a
  // C0 pair. "Nothing about the model … differed" was false there; "nothing the analysis uses" is what C0 proves.
  C0_identical:
    'Nothing the analysis uses differed between this analysis and the previous one, and it was worked out the same way.',
  // ⛔ THE SEED AND NOTHING ELSE. CEE returns C2 on `!seed_equal` before it
  // reads the build or the sample count (`build-run-delta.ts:374`), and a
  // factor-value edit moves the seed, so this is the sentence an ordinary
  // edit → Re-run reads. It said "not worked out on a comparable basis" — a
  // claim about the method, served on a pair with the same build and the same
  // sample count (26 Sep, churn 7% → 12%).
  C2_unpaired:
    'This analysis and the previous one drew different random samples.',
  C3_engine_drift:
    'The way this analysis was worked out changed between the two.',
  C4_budget_drift:
    'This analysis and the previous one were worked out to different levels of precision.',
  // SC-24 (0.68.0): the pair exists but the table names no case for it — the engine builds could not be confirmed
  // equal. It is a refusal to attribute, like C2–C4; the input rows below still say what the user changed.
  C5_unattributed:
    'Whether this analysis and the previous one were worked out the same way cannot be confirmed.',
}

/**
 * THE RIDER — what the reader may and may not conclude about CAUSE.
 *
 * ⛔⛔ BY CASE, NEVER BINARY, AND THE DIFFERENCE IS A FALSE STATEMENT. An earlier
 * draft was `attributable ? null : ONE_SENTENCE`, i.e. a binary over a FIVE-value
 * enum, and the one sentence DENIED a model change: "any difference below cannot
 * be put down to a change in the model". Two separate defects fell out of that:
 *
 *   ⛔ ON `C2_unpaired` IT DENIES THE CAUSE THAT IS ROUTINELY THE REAL ONE. CEE
 *     emits C2 on `!seed_equal` WITHOUT CONSULTING THE HASH, and its own producer
 *     note (`build-run-delta.ts:332-335`) says a factor-value edit moves
 *     `observed_state.value` — which sits in BOTH the seed inputs AND the hash.
 *     So the likeliest edit a person makes lands in C2, and the card told them
 *     their change could not explain what they were looking at. "Not established"
 *     and "not the cause" are different claims; only the first is ours to make.
 *
 *   ⛔ ON `C0_identical` IT FIRED AS A LIMIT WHERE THE PAIR IS AT ITS STRONGEST.
 *     C0 requires `hash_equal === true` (`refineRunDelta` demands all four
 *     echoes), so "the model did not change" is PROVEN, not merely unestablished.
 *     Printing a not-comparable rider there mislabels a certainty as a gap.
 *
 * ⇒ Three distinct riders. C1 needs none — part A already carries the whole
 * claim. C0 states a proven negative. C2/C3/C4 REFUSE TO ATTRIBUTE, which is the
 * honest shape of "we cannot tell from this pair".
 */
/**
 * ⛔ C0 WITH `partial` COVERAGE (P0 5943351889; producer owner 52f8cd 5943379851, 2 Oct). `partial` means Olumi cannot
 * VERIFY that every sent input was the same — since 0.71 `complete` needs equal residuals on BOTH ends, so a legacy end
 * with no residual reads `partial` on a no-edit rerun. It never means "an input changed". So neither "nothing … differed"
 * (unverified) nor "an input changed" (false on the legacy no-edit pair): say what is unconfirmed, and refuse to
 * attribute.
 */
const C0_PARTIAL_COMPARABILITY =
  "This analysis was worked out the same way as the previous one, but Olumi can't confirm that every input was the same between these runs."

/**
 * THE SAME CLAIMS, FOR TWO SAVED VERSIONS (`frame: 'versions'`). Each sentence keeps its rerun twin's scope word for
 * word; only the two things compared are renamed, because "this analysis" and "the previous one" are false nouns when
 * the user compares a later version FROM and an earlier one TO. Never "earlier", "previous" or "last time".
 */
const COMPARABILITY_VERSIONS: Record<RunDelta['attribution_case'], string> = {
  C1_attributable: 'The only difference between these two recorded results is a change to the model.',
  C0_identical:
    'Nothing the analysis uses differed between these two recorded results, and they were worked out the same way.',
  C2_unpaired: 'These two recorded results drew different random samples.',
  C3_engine_drift: 'The way these two results were worked out changed between them.',
  C4_budget_drift: 'These two recorded results were worked out to different levels of precision.',
  C5_unattributed: 'Whether these two recorded results were worked out the same way cannot be confirmed.',
}

const C0_PARTIAL_COMPARABILITY_VERSIONS =
  "These two recorded results were worked out the same way, but Olumi can't confirm that every input was the same between them."

const CANNOT_ESTABLISH =
  'Whether a change to the model explains anything below cannot be established from this pair.'

const ATTRIBUTION_LIMIT: Record<RunDelta['attribution_case'], string | null> = {
  // Part A already says the only difference is a change to the model. A rider
  // would either repeat it or weaken it.
  C1_attributable: null,
  // ⭐ PROVEN, NOT UNKNOWN. `hash_equal` is true by the case's own preconditions,
  // so this is the one arm entitled to say a model change is NOT the explanation.
  // ⛔ ONLY THE CONSEQUENCE (COPY-SHAPE, 7 Oct): part A already says nothing the analysis uses differed. The rider said it
  // again ("did not change … so"), so the C0 note read "nothing changed" twice. Same proven scope, said once.
  C0_identical:
    'So no difference below comes from an edit to anything the analysis uses.',
  // ⛔ REFUSAL TO ATTRIBUTE, NOT DENIAL. C2 is decided on the seed alone; the hash
  // is never consulted, so a change to the model may well be the cause and this
  // pair simply cannot show it.
  // ⚠ ONE LITERAL, THREE ARMS. These were three byte-identical copies — a
  // hand-maintained mirror at three lines' distance, which is close enough to
  // look deliberate and far enough to drift. They agree BECAUSE the claim is the
  // same claim: the case says nothing about the hash, so no model change can be
  // established or ruled out. If one of them ever needs different words, that is
  // a signal the case means something different, not a reason to copy the string.
  C2_unpaired: CANNOT_ESTABLISH,
  C3_engine_drift: CANNOT_ESTABLISH,
  C4_budget_drift: CANNOT_ESTABLISH,
  C5_unattributed: CANNOT_ESTABLISH,
}

/** A producer value, formatted for display. Numbers take the one raw-value formatter; nothing is converted. */
/**
 * RC's one-sentence-per-link rule: a `sizing` row and a `strength` row for the SAME link (same entity id) become ONE row,
 * the sizing row carrying the strength's before → after. Every other row passes through in the producer's order.
 */
function foldSizingAndStrength(rows: RunDeltaInputRow[]): RunDeltaInputRow[] {
  const strengthOf = new Map<string, RunDeltaInputRow>()
  for (const r of rows) if (r.kind === 'link' && r.field === 'strength' && r.change === 'changed') strengthOf.set(r.entityId, r)
  const folded = new Set<RunDeltaInputRow>()
  const out: RunDeltaInputRow[] = []
  for (const r of rows) {
    if (r.kind === 'link' && r.field === 'sizing') {
      const s = strengthOf.get(r.entityId)
      if (s) {
        folded.add(s)
        out.push({ ...r, strength: { before: s.before, after: s.after } })
        continue
      }
    }
    out.push(r)
  }
  return out.filter((r) => !folded.has(r))
}

function formatInputValue(
  v: { raw: number | string | boolean; unit?: string; per?: { amount: number; unit: string } } | null,
  field?: string,
): string | null {
  if (v === null) return null
  if (field === 'strength' && typeof v.raw === 'number') return scienceBand('strength', v.raw)
  // 0.78.0 `effect` (SD-1 cut 6): a link's size in the user's terms is a figure PER a source change; the per is part of
  // the figure ("2 customers per 1 percentage point"), so it is never dropped. Both ends carry the same per (contract).
  if (field === 'effect' && typeof v.raw === 'number' && v.per !== undefined) {
    return `${formatRawValueWithUnit(v.raw, v.unit ?? null)} per ${formatRawValueWithUnit(v.per.amount, v.per.unit)}`
  }
  if (typeof v.raw === 'number') {
    // The canvas card's own reading of the carried unit (Compare v3 served witness, 7 Oct: a row read "39 £ per paying
    // customer per month"): money through the one money rule, a compound unit through the one compact owner. A unit
    // neither recognises prints exactly as before. Same figure, same unit; only the notation.
    const plain = formatRawValueWithUnit(v.raw, v.unit ?? null)
    return formatMoneyFigure(v.raw, v.unit ?? null) ?? compactCarriedReading(plain, v.unit ?? null) ?? plain
  }
  if (typeof v.raw === 'boolean') return v.raw ? 'on' : 'off'
  return v.unit ? `${v.raw} ${v.unit}` : v.raw
}

/**
 * Option-setting display seam for #2898's carried frame and resolveOptionTargetDisplayFrame (#2722).
 * The installed contract has raw/unit, and label_before/label_after name the INPUT, not either value.
 * Until a value display frame travels on the row, preserve raw precision without scaling or percent conversion.
 */
export function optionInputChangeValues(row: RunDeltaInputChange): { before: string | null; after: string | null } {
  const value = (side: RunDeltaInputChange['before']): string | null => {
    if (side === null) return null
    const raw = String(side.raw)
    if (!side.unit) return raw
    // Carried currency symbols keep the existing notation; no value is converted or rounded.
    return ['£', '$', '€', '¥'].includes(side.unit) ? `${side.unit}${raw}` : `${raw} ${side.unit}`
  }
  return { before: value(row.before), after: value(row.after) }
}

const GOAL_FIELD_WORDS: Record<string, string> = {
  target: 'Goal target',
  unit: 'Goal unit',
  operator: 'Goal comparison',
  direction: 'Goal direction',
}

function inputSubject(
  row: RunDeltaInputChange,
  labelFor: (optionId: string) => string | null,
  nodeLabelFor: (nodeId: string) => string | null,
): string {
  const own = row.label_after ?? row.label_before ?? nodeLabelFor(row.entity_id)
  switch (row.entity_kind) {
    case 'option_setting': {
      const option = (row.option_id !== undefined ? labelFor(row.option_id) : null) ?? 'an option'
      return `${own ?? 'A factor'}, ${option}`
    }
    case 'option':
      return own ?? labelFor(row.entity_id) ?? 'An option'
    case 'goal':
      return row.field === 'presence' ? (own ?? 'The goal') : (GOAL_FIELD_WORDS[row.field] ?? 'The goal')
    case 'constraint':
      return `${own ?? 'A limit'}${row.field === 'operator' ? ' (comparison)' : ''}`
    case 'link': {
      const from = row.link ? nodeLabelFor(row.link.from) : null
      const to = row.link ? nodeLabelFor(row.link.to) : null
      return from && to ? `Link from ${from} to ${to}` : 'A link'
    }
    default:
      return own ?? 'An input'
  }
}

/** `subject`'s two halves for a row layout: the input's own name and, for an option setting, its option. Same labels. */
function inputName(
  row: RunDeltaInputChange,
  labelFor: (optionId: string) => string | null,
  nodeLabelFor: (nodeId: string) => string | null,
): { name: string; optionLabel: string | null } {
  const own = row.label_after ?? row.label_before ?? nodeLabelFor(row.entity_id)
  if (row.entity_kind === 'option_setting') {
    return { name: own ?? 'A factor', optionLabel: (row.option_id !== undefined ? labelFor(row.option_id) : null) ?? 'an option' }
  }
  if (row.entity_kind === 'link') {
    const from = row.link ? nodeLabelFor(row.link.from) : null
    const to = row.link ? nodeLabelFor(row.link.to) : null
    return { name: from && to ? `${from} → ${to}` : 'A link', optionLabel: null }
  }
  return { name: inputSubject(row, labelFor, nodeLabelFor), optionLabel: null }
}

/** "14:02" in the viewer's clock, or null when the producer sent no time. */
function clockOf(iso: string | undefined): string | null {
  if (iso === undefined) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function directionOf(prior: number, current: number): MovementDirection {
  if (current > prior) return 'up'
  if (current < prior) return 'down'
  return 'level'
}

/**
 * The goal's direction or comparison differs between the two Runs, BY IDENTITY: a `goal` input row whose producer
 * field is `direction` or `operator` (schemas 0.77 `RunInputField`). A limit's comparison (`constraint`) and the
 * goal's target, unit or presence do not change what an option's support measures, so they never match.
 */
export function goalFramingChanged(delta: Pick<RunDelta, 'input_changes'>): boolean {
  return (delta.input_changes ?? []).some((row) => row.entity_kind === 'goal' && (row.field === 'direction' || row.field === 'operator'))
}

/**
 * Build the view model.
 *
 * `labelFor` resolves an option id to what this surface already calls it —
 * passed in rather than read here so this module stays pure and so the section
 * cannot disagree with the rest of the tab about an option's name.
 */
export function buildRunDeltaView(
  delta: RunDelta,
  labelFor: (optionId: string) => string | null,
  nodeLabelFor: (nodeId: string) => string | null = () => null,
  frame: RunDeltaFrame = 'rerun',
  inputRows: 'folded' | 'all' = 'folded',
): RunDeltaView {
  const attributable = delta.attribution_case === 'C1_attributable'

  const framingChanged = goalFramingChanged(delta)
  // Withheld, not emptied by accident: across a direction change no option has a comparable pair (see the field).
  const movements: RunDeltaMovement[] = framingChanged ? [] : delta.win_probabilities.map((w) => ({
    optionId: w.option_id,
    label: labelFor(w.option_id),
    prior: w.prior,
    current: w.current,
    direction: directionOf(w.prior, w.current),
    noiseVerdict: w.noise_verdict,
    mayShowMagnitude: w.noise_verdict !== 'not_noise_qualified',
  }))

  const c0Partial = delta.attribution_case === 'C0_identical' && delta.input_coverage === 'partial'
  const priorId = delta.leader.prior_leading_option_id
  const currentId = delta.leader.current_leading_option_id
  const mayName =
    typeof priorId === 'string' && priorId.length > 0 &&
    typeof currentId === 'string' && currentId.length > 0

  return {
    comparability:
      frame === 'versions'
        ? c0Partial ? C0_PARTIAL_COMPARABILITY_VERSIONS : COMPARABILITY_VERSIONS[delta.attribution_case]
        : c0Partial ? C0_PARTIAL_COMPARABILITY : COMPARABILITY[delta.attribution_case],
    attributable,
    attributionLimit: c0Partial ? CANNOT_ESTABLISH : ATTRIBUTION_LIMIT[delta.attribution_case],
    movements,
    // ⚠ AN EMPTY LIST IS "NO OPTION HAD A COMPARABLE PAIR", NEVER "NOTHING
    // MOVED". The contract permits an empty array on a pair where no option
    // could be matched; reading it as stillness would be the same fabrication
    // `flip_thresholds` is withheld to avoid, one field over.
    movementsUnavailable: movements.length === 0,
    ...(framingChanged ? { goalFramingChanged: true as const } : {}),
    ...(!framingChanged && delta.goal_chances !== undefined
      ? { goalChances: delta.goal_chances.map((g) => ({ optionId: g.option_id, label: labelFor(g.option_id), prior: g.prior, current: g.current })) }
      : {}),
    winProbabilitiesUnavailable: delta.win_probabilities_unavailable ?? null,
    leader: {
      changed: delta.leader.changed,
      noiseVerdict: delta.leader.noise_verdict,
      mayName,
      priorLabel: mayName ? labelFor(priorId as string) : null,
      currentLabel: mayName ? labelFor(currentId as string) : null,
    },
    inputs:
      delta.input_coverage === undefined
        ? null
        : {
            coverage: delta.input_coverage,
            rows: (inputRows === 'all' ? (rows: RunDeltaInputRow[]) => rows : foldSizingAndStrength)((delta.input_changes ?? []).map((row, i) => ({
              key: `${row.entity_kind}:${row.entity_id}:${row.option_id ?? ''}:${row.field}:${i}`,
              kind: row.entity_kind,
              entityId: row.entity_id,
              optionId: row.option_id ?? null,
              linkEnds: row.link ? { from: row.link.from, to: row.link.to } : null,
              subject: inputSubject(row, labelFor, nodeLabelFor),
              ...inputName(row, labelFor, nodeLabelFor),
              ...(row.entity_kind === 'option_setting' && inputRows === 'all' ? optionInputChangeValues(row) : {
                before: formatInputValue(row.before, row.field),
                after: formatInputValue(row.after, row.field),
              }),
              change: row.change,
              field: row.field,
              linkLabels: row.link ? { from: nodeLabelFor(row.link.from), to: nodeLabelFor(row.link.to) } : null,
              strength: null,
            }))),
          },
    // `versions`: the surface names both versions and their own dates; "the earlier run" may be the LATER one there.
    comparedWith: (() => {
      if (frame === 'versions') return null
      const at = clockOf(delta.endpoints?.prior.computed_at)
      return at !== null ? `Compared with the earlier run at ${at}.` : null
    })(),
    ...(frame === 'versions' ? { frame } : {}),
  }
}
