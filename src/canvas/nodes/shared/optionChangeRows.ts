/**
 * ⭐ WHAT THIS OPTION CHANGES, AT REST — the option card's compact anatomy
 * (locked spec §4 "Always lead with what this option changes"; ED 11:52Z
 * point 4: "max two change rows + `+N more` … selection must not grow the card";
 * ED 02:31Z D2: a wrapped `from → to` is accepted, values are never truncated).
 *
 * ── ONE ROW ORDER FOR THE WHOLE OPTION ROW ──────────────────────────────────
 *
 * The purpose audit's finding on #1901: each card picked a DIFFERENT pair, so
 * options could not be read side by side. So the order is chosen ONCE, for the
 * whole set, and every card shows — in that order — the first two factors IT
 * sets. Options that change the same things therefore show the same rows in the
 * same places; an option that changes something no other option does still leads
 * with its own change rather than an empty row.
 *
 * The order is STRUCTURAL, not a score: how many options set the factor (the
 * changes the options have in common first), then the factor's position in the
 * model. No distance heuristic, no magnitude sort — nothing that implies one
 * change matters more than another.
 *
 * ── `+N more` COUNTS FROM THE ONE TOTAL ─────────────────────────────────────
 *
 * `N = totalInterventionCount − rows shown`, the SAME total the inspector route
 * uses (`optionInterventionCount.ts`), so a card never states two totals (#1901
 * finding 3). Every set target yields a row — a target with no reference still
 * reads `→ £59` — so no row can silently drop out of the count.
 */
import {
  formatInterventionChange,
  formatInterventionTargetText,
  isInterventionNoChange,
} from '../../utils/interventionDisplay'
import {
  cleanFactorLabel,
  sentenceCaseFactorLabel,
  compactFactorLabel,
  isSuppressedUnit,
  classifyUnit,
  unwrapInterventionValue,
} from '../../utils/labelUtils'
import { NODE_ROW_LABEL_MAX_CHARS } from '../../utils/nodeLayoutConstants'
import {
  encodingMapPhrase,
  factorCardVisibleText,
  factorDisplayParts,
  factorDisplayText,
  placeholderMagnitudeNumber,
  readFactorDisplayValue,
} from '../../../utils/formatFactorDisplayValue'
import { collapseEstimateDisplay } from './collapseEstimateDisplay'
import { interventionTargetSourceMark, type FactorValueSourceMark } from './valueSourceMark'

/**
 * ⭐ THREE, NOT TWO — Paul, 25 Sep 2026, from live screenshots: the card must
 * match the PROTOTYPE, which shows one row per concrete change at rest (up to
 * three, then `+N more`). This supersedes ED 11:52Z point 4's "max two change
 * rows" and ED #63 5809278282's one-line option body.
 */
export const OPTION_CARD_ROW_LIMIT = 3

/**
 * The muted separator between a row's value and its source mark (contract v3.1
 * pt 7, gap U12: "→ 1 brief" read the mark as the value's unit). Decorative —
 * the mark carries its own accessible name.
 */
export const OPTION_ROW_SOURCE_MARK_SEPARATOR = '·'

/**
 * ⭐ ED 02:31Z (D2): "If a particular value makes the resting card materially
 * taller, reduce visible rows at that LOD before truncating the value." A row
 * whose `from → to` runs past two lines' worth of the row budget
 * (`NODE_ROW_LABEL_MAX_CHARS`, the estate's own per-line budget, ×2) makes the
 * card show ONE row, never a cut value — the rest are one `+N more` away.
 * Measured on `build-vs-buy`: "Moderate engineering allocation (2 of 4
 * engineers) → Very high" (62 chars) doubled the card's height at two rows.
 */
export const OPTION_ROW_CHANGE_BUDGET_CHARS = 2 * NODE_ROW_LABEL_MAX_CHARS

export interface OptionTargetLike {
  value: number
  displayValue?: string | null
  source?: string | null
}

/**
 * ⭐⭐ THE FACTOR CARD'S OWN READING — the exact call `FactorNode` makes for its
 * value line: `factorDisplayText` over the node's data, the label cleaned and a
 * suppressed unit dropped. So a row's "from" and the factor card beside it print
 * ONE string (Paul 25 Sep: "use the SAME value formatter the factor cards use,
 * so units match the factor card exactly"). The one input the card adds and this
 * omits is the unacknowledged keystroke (`pending_user_value`): a row reads the
 * persisted model, never a half-typed number.
 *
 * ⚠ ONLY THE "FROM". A target CEE authored a display string for still prints
 * that string verbatim (`formatInterventionTargetText`'s passthrough; Paul 20
 * Sep: "a thin layer, not performing excessive data manipulation";
 * `OptionNode.ceeDisplayValueIsNotRederived.spec.tsx`). Re-reading the target
 * through the factor card's formatter would turn CEE's "£18k" into a UI
 * "£18,000" — a UI-substituted value.
 */
export function factorCardReading(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data || typeof data !== 'object') return null
  const input = factorCardInput(data)
  return factorCardVisibleText(factorDisplayText(input), factorDisplayParts(input))
}

/** The node data exactly as the factor card formats it: label cleaned, a suppressed unit dropped. */
function factorCardInput(data: Record<string, unknown>): Record<string, unknown> {
  const obs = data.observedState as Record<string, unknown> | undefined
  const unit = typeof obs?.unit === 'string' ? obs.unit : undefined
  const label = cleanFactorLabel((data.label as string | undefined) ?? '')
  const observedState = obs && { ...obs, unit: isSuppressedUnit(unit) ? undefined : unit }
  return { ...data, label, observedState }
}

/**
 * ⛔⛔ THE FACTOR CARD'S READING, ONLY WHEN THE DATA CARRIES IT — else `null`.
 *
 * A row's "from" is the factor's current value "when the data carries it;
 * otherwise show `→ to` only" (Paul 25 Sep). The factor card's formatter does
 * more than read: from a bare model value it GUESSES — "No <label> in place" for
 * 0, "<Label> active" for 1 (`formatFactorDisplayValue`'s value-only branch).
 * Those phrases are in no field of the data, so they are never a "from". e0490565
 * took any reading and put "No tech lead headcount in place → 1" on the served
 * hiring board (verifier FIX_NEEDED).
 *
 * Accepted, each traced to a field the node carries:
 *   1. a `raw_value` on a unit that is not a placeholder (or no unit): from
 *      there every branch the formatter can take prints that figure with its
 *      unit, the `display_value` or the `encoding_map` phrase — the guessing
 *      branch needs `raw_value` absent or a placeholder unit. (A zero on a
 *      `cost` factor prints "No cost allocated": the carried 0, in words.)
 *   2. otherwise, the producer's own words only: the `display_value` verbatim
 *      (or its figure with the placeholder word dropped — the forwarding gate
 *      the card applies), or the `encoding_map` phrase for the value.
 *
 * ⚠ DELIBERATELY CONSERVATIVE, recorded rather than hidden: a figure the
 * formatter prints from a bare `value` (a user-stated number on a placeholder
 * scale, the percent recovered from a contradicted `display_value`) is NOT
 * accepted. Those rows lose their "from" and read `→ to` — a missing "from" is
 * incomplete; a guessed one is false.
 */
export function carriedFactorCardReading(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data || typeof data !== 'object') return null
  const input = factorCardInput(data)
  const reading = factorDisplayText(input)
  if (reading === null) return null
  const shown = factorCardVisibleText(reading, factorDisplayParts(input))
  const obs = input.observedState as Record<string, unknown> | undefined
  const unit = typeof obs?.unit === 'string' && obs.unit !== '' ? obs.unit : null
  const raw = obs?.raw_value
  const carriesRaw = unwrapInterventionValue(raw).value !== null || (typeof raw === 'string' && raw.trim() !== '')
  if (carriesRaw && (unit === null || classifyUnit(unit).kind !== 'placeholder')) return shown
  const displayValue = readFactorDisplayValue(input)
  if (displayValue !== undefined && (reading === displayValue || reading === placeholderMagnitudeNumber(displayValue))) {
    return shown
  }
  if (reading === encodingMapPhrase(input.encoding_map, unwrapInterventionValue(obs?.value).value)) return shown
  return null
}

export interface OptionSetLike {
  id: string
  isBaseline: boolean
  /** factorId → the option's target for that factor. */
  targets: ReadonlyMap<string, OptionTargetLike>
  /**
   * Factors the option NAMES with no target value at all — no number and no
   * reading (design-gap row 22, "Needs input"). They take their place in the
   * shared order like any change, so the gap reads where the value would.
   */
  unsetTargets?: ReadonlySet<string>
}

/** Every factor an option names, set or not — the keys the row order reads. */
const namedFactorIds = (o: OptionSetLike): string[] =>
  [...o.targets.keys(), ...[...(o.unsetTargets ?? [])].filter((fid) => !o.targets.has(fid))]

/**
 * The shared factor order for the whole option row: most-shared first, then
 * model order. Baseline options do not vote — they describe "no change".
 */
export function sharedChangeOrder(
  options: ReadonlyArray<OptionSetLike>,
  modelOrder: ReadonlyArray<string>,
): string[] {
  const coverage = new Map<string, number>()
  for (const o of options) {
    if (o.isBaseline) continue
    for (const fid of namedFactorIds(o)) coverage.set(fid, (coverage.get(fid) ?? 0) + 1)
  }
  const position = new Map(modelOrder.map((id, i) => [id, i]))
  return [...coverage.keys()].sort(
    (a, b) =>
      (coverage.get(b) ?? 0) - (coverage.get(a) ?? 0) ||
      (position.get(a) ?? Number.MAX_SAFE_INTEGER) - (position.get(b) ?? Number.MAX_SAFE_INTEGER) ||
      (a < b ? -1 : a > b ? 1 : 0),
  )
}

/** The factors THIS option's card shows, in the shared order, capped. */
export function rowFactorIdsFor(
  option: OptionSetLike,
  order: ReadonlyArray<string>,
  limit: number = OPTION_CARD_ROW_LIMIT,
): string[] {
  const out: string[] = []
  const named = new Set(namedFactorIds(option))
  for (const fid of order) {
    if (out.length >= limit) break
    if (named.has(fid)) out.push(fid)
  }
  // Any target the shared order did not reach (defensive — the order is built
  // from every option's targets, so this is only reachable with a stale order).
  if (out.length < limit) {
    for (const fid of named) {
      if (out.length >= limit) break
      if (!out.includes(fid)) out.push(fid)
    }
  }
  return out
}

export interface FactorContext {
  label: string
  unit?: string
  factorType?: string
  cap?: number
  observedValue?: number
  observedRawValue?: string | number
  /**
   * The factor node's own data, when the caller has it — what the factor card
   * reads (`factorCardReading`). Absent, the row keeps its older, context-only
   * formatting.
   */
  factorData?: Record<string, unknown> | null
}

export interface OptionChangeRow {
  factorId: string
  /** The row's visible label (compacted to the row budget, with recovery). */
  label: string
  fullLabel: string
  /** `from → to`, or `→ to` when there is no reference to start from. */
  change: string
  /**
   * The two halves of a `from → to` row, so the card can set the tone of each
   * (contract v3.1 OPT-03: `.delta-rows .before` is muted, arrow and target are
   * ink). Present ONLY when the row has a "from"; `${before} → ${after}` is
   * byte-identical to `change` — the split is presentation, never a second
   * wording. Absent on target-only, direction-only and same-as-baseline rows,
   * which render `change` whole.
   */
  before?: string
  after?: string
  /** The same change with nothing collapsed — the row's full-text recovery. */
  fullChange: string
  /**
   * The TARGET alone, with nothing collapsed ("Low (0.1)", "£60k", "59
   * GBP/month") — the reading the inspector prints for this row, so the two
   * surfaces print one string (DEFECT 5). `''` when the formatter declines to
   * print a number (an unframed `scale` value); `change` then carries the
   * card's direction words.
   */
  target: string
  /** Where the "from" came from — stated in the row's tooltip. */
  reference: 'baseline_option' | 'current_value' | 'none'
  /** Olumi chose this target (`cee_hypothesis`) — stays marked (#1901 finding 2). */
  estimated: boolean
  /**
   * WHERE THE TARGET CAME FROM — you / Olumi / brief (Paul 23 Sep contract
   * feedback point 7). Never absent: an unknown or missing source is Olumi's
   * estimate, never the user's. `estimated` is exactly `targetSource.kind === 'olumi'`.
   */
  targetSource: FactorValueSourceMark
  /** The target equals the baseline option's — said, not hidden. */
  sameAsReference: boolean
  /**
   * The option names this factor with NO target value (design-gap row 22): the
   * amount cell reads `Needs input` and carries no source mark — there is no
   * target to attribute. `change` / `fullChange` are `OPTION_ROW_NEEDS_INPUT`.
   */
  needsInput?: true
}

/** Visual contract v3 §02: the amount cell of a target with no value. */
export const OPTION_ROW_NEEDS_INPUT = 'Needs input'

/**
 * The row for a factor the option names with no target value — the same label
 * rules as `buildOptionChangeRow`, and no invented change, reference or value.
 */
export function buildOptionNeedsInputRow({
  factorId,
  factor,
  source,
}: {
  factorId: string
  factor: Pick<FactorContext, 'label'>
  source: string | null
}): OptionChangeRow {
  const fullLabel = sentenceCaseFactorLabel(cleanFactorLabel(factor.label || factorId)) || factorId
  const targetSource = interventionTargetSourceMark(source)
  return {
    factorId,
    label: compactFactorLabel(fullLabel, NODE_ROW_LABEL_MAX_CHARS),
    fullLabel,
    change: OPTION_ROW_NEEDS_INPUT,
    fullChange: OPTION_ROW_NEEDS_INPUT,
    target: '',
    reference: 'none',
    estimated: targetSource.kind === 'olumi',
    targetSource,
    sameAsReference: false,
    needsInput: true,
  }
}

export function buildOptionChangeRow({
  factorId,
  target,
  factor,
  baselineOptionTarget,
}: {
  factorId: string
  target: OptionTargetLike
  factor: FactorContext
  baselineOptionTarget: OptionTargetLike | null
}): OptionChangeRow {
  const fullLabel = sentenceCaseFactorLabel(cleanFactorLabel(factor.label || factorId)) || factorId
  const label = compactFactorLabel(fullLabel, NODE_ROW_LABEL_MAX_CHARS)
  // Point 7: every row names its target's source. Was `classify…?.kind === 'ai'`,
  // which left `cee_inference` (live on the wire, unclassified in the
  // intervention vocabulary) and an absent source UNMARKED — "unmarked = Olumi".
  const targetSource = interventionTargetSourceMark(target.source ?? null)
  const estimated = targetSource.kind === 'olumi'
  const context = {
    label: fullLabel,
    unit: factor.unit,
    factorType: factor.factorType,
    cap: factor.cap,
    observedValue: factor.observedValue,
    observedRawValue: factor.observedRawValue,
    // A13: the factor's OWN declared encoding, read straight off its node data
    // (the same field `factorCardReading` reads for the "from" above) so
    // `formatTarget` below resolves BOTH ends through it, not just whichever
    // side happens to go through the current-value branch.
    encoding_map: (factor.factorData as Record<string, unknown> | null | undefined)?.encoding_map,
  }
  // At rest a tier reading sheds its parenthesised internal-scale number
  // ("Very high (0.9)" → "Very high"), exactly as a factor's resting value does
  // (`collapseEstimateDisplay`, R6; spec §3: "Never expose raw internal scales
  // … by default"). The full string is the row's tooltip and the inspector's.
  const rest = (text: string) => collapseEstimateDisplay(text) ?? text
  // Contract v3.1 pt 7 (gap U12): a placeholder unit word ("0.3 scale") names
  // no real-world scale, so the row drops the WORD and keeps the producer's own
  // figure — the factor card's rule (`placeholderMagnitudeNumber`), not a new one.
  // Nothing to recover, so the full text drops it too. Real units are untouched.
  const unitless = (text: string) => placeholderMagnitudeNumber(text) ?? text
  const formatTarget = (t: OptionTargetLike): string =>
    formatInterventionTargetText({ ...context, value: t.value, displayValue: t.displayValue ?? undefined })
  const targetFull = unitless(formatTarget(target))
  const targetText = rest(targetFull)
  let fromFull = ''

  // "from": the baseline OPTION's own target where one exists (the reference
  // the estate already uses — `OptionNode.referenceFidelity`), else the
  // factor's current value in the model. A display string on one side and a
  // number on the other would compare two different scales, so the pair is
  // only formed when both sides are the same kind.
  let reference: OptionChangeRow['reference'] = 'none'
  let fromText = ''
  let sameAsReference = false
  const currentReading = carriedFactorCardReading(factor.factorData)
  if (baselineOptionTarget && Boolean(baselineOptionTarget.displayValue) === Boolean(target.displayValue)) {
    reference = 'baseline_option'
    sameAsReference =
      isInterventionNoChange(baselineOptionTarget.value, target.value) &&
      (baselineOptionTarget.displayValue ?? null) === (target.displayValue ?? null)
    if (!sameAsReference) {
      fromFull = unitless(formatTarget(baselineOptionTarget))
      fromText = rest(fromFull)
    }
  } else if (currentReading) {
    // ⭐ THE FACTOR'S CURRENT VALUE, AS ITS OWN CARD READS IT (Paul 25 Sep:
    // "`from` is the factor's baseline/status-quo value when the data carries
    // it"). This arm used to require `!target.displayValue`, and the served wire
    // puts a display string on EVERY target (`intervention_details[]
    // .display_value`, debug bundle 5fe89207) — so no served row ever had a
    // "from" while the factor card beside it read "0 GBP/year". Both halves are
    // READINGS the data carries (the factor card's string, the producer's
    // string). ⛔ Only a CARRIED reading: the formatter's value-only guesses
    // ("No X in place", "X active") are refused by `carriedFactorCardReading`,
    // and the row falls through to the older arms — `→ to` for a served target.
    // No pair when the target IS the current value, or reads identically.
    const unchanged = typeof factor.observedValue === 'number' && isInterventionNoChange(factor.observedValue, target.value)
    const currentFull = unitless(currentReading)
    if (!unchanged && currentFull !== targetFull) {
      fromFull = currentFull
      fromText = rest(fromFull)
      reference = 'current_value'
    }
  } else if (!target.displayValue && typeof factor.observedValue === 'number') {
    const change = formatInterventionChange({
      baselineValue: factor.observedValue,
      targetValue: target.value,
      label: fullLabel,
      unit: factor.unit,
      factorType: factor.factorType,
      cap: factor.cap,
      observedValue: factor.observedValue,
      observedRawValue: factor.observedRawValue,
    })
    if (change.changed && change.baselineText) {
      fromFull = unitless(change.baselineText)
      fromText = rest(fromFull)
      reference = 'current_value'
    }
  }
  // ⛔ NEVER AN ARROW POINTING AT NOTHING. An unframed target (a `scale` value
  // with no unit or reading) formats to '' — the row then says what the option
  // DOES in words, the estate's directional fallback (`describeInterventionDirection`),
  // rather than "→ ". Found by the option-spec review of this PR.
  if (!targetText) {
    const reference = baselineOptionTarget?.value ?? factor.observedValue
    const direction =
      typeof reference === 'number'
        ? isInterventionNoChange(reference, target.value)
          ? 'No change'
          : target.value > reference ? 'Increases' : 'Decreases'
        : 'Changes'
    return {
      factorId,
      label,
      fullLabel,
      change: direction,
      fullChange: direction,
      target: '',
      reference: typeof reference === 'number' ? (baselineOptionTarget ? 'baseline_option' : 'current_value') : 'none',
      estimated,
      targetSource,
      sameAsReference: direction === 'No change',
    }
  }
  // ⛔⛔ NEVER "Low → Low", AND NEVER AN INVENTED COMPARISON WORD EITHER (A13,
  // AUDIT-SYNTH 20260925). At rest both sides shed their internal-scale number
  // (R6), so a real change INSIDE one band — "Low (0.2)" → "Low (0.3)" — would
  // print the same word around an arrow: a row claiming a change and showing
  // none (S5, seen on `pricing-model`). The first fix for that invented
  // "Low · slightly higher" — a judgement about the size of the move that no
  // field of the data states. The row shows the full carried strings instead:
  // they are the data's own numbers, unabbreviated, and the direction is
  // legible from which one prints first.
  if (fromText && fromText === targetText && fromFull !== targetFull) {
    return {
      factorId,
      label,
      fullLabel,
      change: `${fromFull} → ${targetFull}`,
      before: fromFull,
      after: targetFull,
      fullChange: `${fromFull} → ${targetFull}`,
      target: targetFull,
      reference,
      estimated,
      targetSource,
      sameAsReference: false,
    }
  }
  return {
    factorId,
    label,
    fullLabel,
    // A13: "same as baseline" was an invented comparison word — `sameAsReference`
    // still carries the signal as data; the row states only what it can carry.
    change: fromText ? `${fromText} → ${targetText}` : `→ ${targetText}`,
    ...(fromText ? { before: fromText, after: targetText } : {}),
    fullChange: fromFull ? `${fromFull} → ${targetFull}` : `→ ${targetFull}`,
    target: targetFull,
    reference,
    estimated,
    targetSource,
    sameAsReference,
  }
}

/** The rows that fit the resting budget: two, or one when a value is long (D2). */
export function fitRowsToBudget(rows: OptionChangeRow[]): OptionChangeRow[] {
  if (rows.length <= 1) return rows
  return rows.some(r => r.change.length > OPTION_ROW_CHANGE_BUDGET_CHARS) ? rows.slice(0, 1) : rows
}

/** `+N more`, from the ONE total — never below zero. */
export function moreCount(totalInterventionCount: number, rowsShown: number): number {
  return Math.max(0, totalInterventionCount - rowsShown)
}
