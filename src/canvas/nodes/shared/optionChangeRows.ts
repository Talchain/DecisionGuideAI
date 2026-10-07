import { isServedSwitch, servedSwitchReading, switchReading } from '../../domain/switchFactors'
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
 * ── `+N more` COUNTS THE CONCRETE CHANGES NOT SHOWN ─────────────────────────
 *
 * `N = concrete changes − rows shown` (side-by-side DIFF N1, 28 Sep 2026; owner
 * decision). It used to be `totalInterventionCount − rows shown`, and once the
 * rows were filtered to concrete changes (below) that advertised hidden
 * NON-changes as "more": vendor-selection read 1 row + `+5 more` on every
 * option, all five equal to the status quo's. The target TOTAL still has one
 * owner (`optionInterventionCount.ts`) and is still stated — by the rail's
 * target route, never by `+N more`.
 *
 * ── CONCRETE CHANGES FIRST (contract v3.1, DESIGN-GAP-v31 #9) ─────────────────
 *
 * The resting card lists only rows that CHANGE something (`isConcreteChangeRow`):
 * a target equal to the baseline's, or to the factor's current value, is a
 * target but not a change, and it is reached through `+N more` (the inspector),
 * never shown as a resting row. The shared order is unchanged; the card skips
 * the non-changes in it.
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
import { NODE_ROW_AMOUNT_MAX_CHARS, NODE_ROW_LABEL_MAX_CHARS } from '../../utils/nodeLayoutConstants'
import {
  encodingMapPhrase,
  factorCardVisibleText,
  factorDisplayParts,
  factorDisplayText,
  placeholderMagnitudeNumber,
  readFactorDisplayValue,
} from '../../../utils/formatFactorDisplayValue'
import { collapseEstimateDisplay } from './collapseEstimateDisplay'
import { interventionTargetSourceMark, VALUE_SOURCE_MARK_TOKEN, type FactorValueSourceMark } from './valueSourceMark'

/**
 * ⭐ THREE, NOT TWO — Paul, 25 Sep 2026, from live screenshots: the card must
 * match the PROTOTYPE, which shows one row per concrete change at rest (up to
 * three, then `+N more`). This supersedes ED 11:52Z point 4's "max two change
 * rows" and ED #63 5809278282's one-line option body.
 */
export const OPTION_CARD_ROW_LIMIT = 3

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
  const switchText = servedSwitchReading(data)
  if (switchText !== null) return switchText
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
 * ⭐ AN OPTION CHANGE-ROW LABEL IS CUT AT A WHOLE WORD whenever one fits (Canvas
 * owner, 27 Sep 2026, landing text cap). At the 21-character row budget the
 * shared 0.6 fallback cut "Time to live (quarters)" to "Time to live (quarter…";
 * the row now reads "Time to live…". The mid-word cut survives only where not
 * even the first word fits. The ONE label path for both row builders below —
 * other `compactFactorLabel` callers keep the shared rule.
 */
function optionRowLabel(fullLabel: string): string {
  return compactFactorLabel(fullLabel, NODE_ROW_LABEL_MAX_CHARS, { wholeWords: true })
}

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
    label: optionRowLabel(fullLabel),
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

/**
 * The INSPECTOR's reading of a yes/no factor's target, in the card's words: the
 * factor's own value labels (`encoding_map`), else "In use" / "Not in use".
 * The card row states both ends (`binaryChangeEnds`); the inspector's "This
 * option sets …" line states the target alone, and printed CEE's bare "on"
 * (Paul's test, 28 Sep). Null unless the factor is binary AND the reading is a
 * bare switch word, so any phrase of CEE's own stays CEE's.
 */
export function binaryTargetReading(factorData: unknown, reading: string): string | null {
  const d = (factorData ?? {}) as Record<string, unknown>
  const obs = (d.observedState ?? d.observed_state) as Record<string, unknown> | undefined
  const unit = typeof obs?.unit === 'string' ? obs.unit : typeof d.unit === 'string' ? d.unit : undefined
  const factorType = typeof obs?.factor_type === 'string' ? obs.factor_type : typeof d.factor_type === 'string' ? d.factor_type : undefined
  if (!isBinaryFactor({ unit, factorType }, [reading])) return null
  // The card row needs both ends at 0 or 1; the inspector's one end is the
  // factor's own value. A switch word on a factor at 0.5 is not a switch.
  const own = typeof obs?.value === 'number' ? obs.value : null
  if (!isBinaryFactor({ unit, factorType }) && own !== null && own !== 0 && own !== 1) return null
  const word = reading.trim()
  if (!BARE_SWITCH_WORD.test(word)) return null
  const v: 0 | 1 = /^(?:on|yes|true|1)$/i.test(word) ? 1 : 0
  return switchReading(d, v)
}

/**
 * ⭐ A YES/NO FACTOR'S ROW STATES BOTH ENDS (Paul's staging test, 28 Sep 2026,
 * export 64c5eccc: "AI assistant use → on" — CEE's bare `display_value` "on",
 * and no "from", because the factor card's reading for 0 is the formatter's own
 * guess, "No AI assistant use in place", which `carriedFactorCardReading`
 * rightly refuses as a "from").
 *
 * A factor is binary when its unit or type SAYS so ("binary adoption",
 * `factor_type: binary`). When both ends of the row are 0/1 and differ, the row
 * reads the factor's OWN value labels (`encoding_map` for 0 and 1 — the
 * producer's words, as everywhere else), else the two state words below.
 *
 * ⛔ CEE'S WORDS STAY CEE'S. The default words replace a producer reading ONLY
 * when it is a bare switch word ("on", "off", "yes", "no", "true", "false",
 * "0", "1") — a state token, not a phrase. Any other reading ("Adopted", "Not
 * adopted") is kept verbatim by the ordinary path below. The row's `target`
 * (the inspector's reading) is untouched: this is the card's row only.
 */
export const BINARY_STATE_WORDS: Readonly<Record<0 | 1, string>> = Object.freeze({ 0: 'Not in use', 1: 'In use' })

const BARE_SWITCH_WORD = /^(?:on|off|yes|no|true|false|0|1)$/i

/** CEE's word for a switched state; a bare digit is not one here. */
export const SWITCH_STATE_WORD = /^(?:on|off|yes|no|true|false)$/i

/**
 * ⭐ A FACTOR IS BINARY WHEN THE PRODUCER SAYS SO: its unit or type names it
 * ("binary adoption", `factor_type: binary`), OR CEE's own word for the value
 * is a switch word ("on"). The unit's spelling cannot decide it: three fresh
 * drafts of Paul's brief (28 Sep 2026, 0d334f7a/00c6244c) spelled one yes/no
 * factor's unit "binary", "0-1 availability" and "adoption indicator", and
 * every one said "→ on". The card row still needs both ends at 0 or 1
 * (`binaryChangeEnds`), so a count or a proportion is never re-worded.
 */
function isBinaryFactor(
  factor: Pick<FactorContext, 'unit' | 'factorType'>,
  producerWords: ReadonlyArray<string | null | undefined> = [],
): boolean {
  if (factor.factorType?.toLowerCase().trim() === 'binary' || /\bbinary\b/i.test(factor.unit ?? '')) return true
  return isServedSwitch('target', { ceeAnalysisReady: { options: producerWords.map(w => ({ intervention_details: { target: { display_value: w } } })) } })
}

const binaryEnd = (v: number | null | undefined): 0 | 1 | null => (v === 0 ? 0 : v === 1 ? 1 : null)

function binaryChangeEnds({
  factor,
  target,
  baselineOptionTarget,
}: {
  factor: FactorContext
  target: OptionTargetLike
  baselineOptionTarget: OptionTargetLike | null
}): { from: string; to: string } | null {
  // Buddy r2 P1: a switch is at 0 or 1 ITSELF (CEE's rule, and `binaryTargetReading`'s guard above). A factor
  // whose own value is known and off 0/1 is never worded as a switch, by the served signal OR a producer word.
  if (factor.observedValue !== undefined && binaryEnd(factor.observedValue) === null) return null
  if (servedSwitchReading(factor.factorData, target.value) === null && !isBinaryFactor(factor, [target.displayValue, baselineOptionTarget?.displayValue])) return null
  const to = binaryEnd(target.value)
  const from = binaryEnd(baselineOptionTarget ? baselineOptionTarget.value : factor.observedValue)
  if (to === null || from === null || from === to) return null
  const servedTo = servedSwitchReading(factor.factorData, to)
  if (servedTo !== null) return { from: switchReading(factor.factorData, from), to: servedTo }
  const encoding = (factor.factorData as Record<string, unknown> | null | undefined)?.encoding_map
  const own0 = encodingMapPhrase(encoding, 0)
  const own1 = encodingMapPhrase(encoding, 1)
  if (own0 !== null && own1 !== null) {
    const own = [own0, own1] as const
    return { from: own[from], to: own[to] }
  }
  const producerWords = [target.displayValue, baselineOptionTarget?.displayValue]
    .filter((d): d is string => typeof d === 'string' && d.trim() !== '')
  if (producerWords.some(d => !BARE_SWITCH_WORD.test(d.trim()))) return null
  return { from: switchReading(factor.factorData, from), to: switchReading(factor.factorData, to) }
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
  const label = optionRowLabel(fullLabel)
  // Point 7: every row names its target's source. Was `classify…?.kind === 'ai'`,
  // which left `cee_inference` (live on the wire, unclassified in the
  // intervention vocabulary) and an absent source UNMARKED — "unmarked = Olumi".
  const targetSource = interventionTargetSourceMark(target.source ?? null)
  const estimated = targetSource.kind === 'olumi'
  const context = {
    label: fullLabel,
    factorData: factor.factorData,
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
  const binary = binaryChangeEnds({ factor, target, baselineOptionTarget })
  if (binary) {
    const change = `${binary.from} → ${binary.to}`
    return {
      factorId,
      label,
      fullLabel,
      change,
      before: binary.from,
      after: binary.to,
      fullChange: change,
      target: targetFull || binary.to,
      reference: baselineOptionTarget ? 'baseline_option' : 'current_value',
      estimated,
      targetSource,
      sameAsReference: false,
    }
  }
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
  // field of the data states.
  //
  // ⭐ AND NOT THE MODEL'S 0–1 NUMBERS EITHER (26 Sep, design audit #3; served
  // `853feeb7` pricing `opt_new_logos`: "Low (0) → Low (0.1) · brief"). The A13
  // fix printed the full carried strings, which put the internal scale back on
  // the card — contract v3.1 `checks.factor`, "no bare internal model scale";
  // ruling "omit, never invent". The row now states only what the data states:
  // the DIRECTION of the move (the two model values, the same rule and words as
  // the unframed-target arm above) and the band both readings share. No size
  // is claimed and no number is shown. The full carried strings stay the row's
  // hover text (`fullChange`), as on every other row (R6).
  if (fromText && fromText === targetText && fromFull !== targetFull) {
    // The value the "from" was read off — the same pairing `reference` names.
    const referenceValue = reference === 'baseline_option' ? baselineOptionTarget?.value : factor.observedValue
    const direction =
      typeof referenceValue === 'number' && !isInterventionNoChange(referenceValue, target.value)
        ? target.value > referenceValue ? 'Increases' : 'Decreases'
        : 'Changes'
    return {
      factorId,
      label,
      fullLabel,
      change: `${direction}, stays ${targetText}`,
      fullChange: `${fromFull} → ${targetFull}`,
      target: targetFull,
      reference,
      estimated,
      targetSource,
      sameAsReference: false,
    }
  }
  const restingFrom = fromText ? elideSharedUnit(fromText, targetText) : ''
  return {
    factorId,
    label,
    fullLabel,
    // A13: "same as baseline" was an invented comparison word — `sameAsReference`
    // still carries the signal as data; the row states only what it can carry.
    change: restingFrom ? `${restingFrom} → ${targetText}` : `→ ${targetText}`,
    ...(restingFrom ? { before: restingFrom, after: targetText } : {}),
    fullChange: fromFull ? `${fromFull} → ${targetFull}` : `→ ${targetFull}`,
    target: targetFull,
    reference,
    estimated,
    targetSource,
    sameAsReference,
  }
}

/**
 * ⭐ ONE UNIT PER ROW (contract v3.1 `.delta-rows`: "£49 → £59"; Paul, 30 Sep:
 * option cards "all bunched together"). When both ends read `<figure> <unit>`
 * with the SAME unit, the resting row says the unit once, after the target:
 * "£49 / month → £60 / month" → "£49 → £60 / month". Anything else is left
 * whole: qualitative readings ("Very high"), different units, or a figure with
 * no separate unit word. The hover (`fullChange`) keeps both ends in full.
 */
const FIGURE_THEN_UNIT = /^(\S*\d\S*)\s+(\S.*)$/
export function elideSharedUnit(from: string, to: string): string {
  const a = FIGURE_THEN_UNIT.exec(from)
  const b = FIGURE_THEN_UNIT.exec(to)
  return a && b && a[2] === b[2] ? a[1] : from
}

/** The rows that fit the resting budget: two, or one when a value is long (D2). */
export function fitRowsToBudget(rows: OptionChangeRow[]): OptionChangeRow[] {
  if (rows.length <= 1) return rows
  return rows.some(r => r.change.length > OPTION_ROW_CHANGE_BUDGET_CHARS) ? rows.slice(0, 1) : rows
}

/**
 * ⭐⭐ ONE LINE, OR THE NAME ON ITS OWN LINE — a deterministic character budget
 * at the landing bound (Paul's staging test, 28 Sep 2026, export 64c5eccc;
 * Canvas owner decision).
 *
 * SERVED at landing (`--canvas-label-scale` 1.64): "Human as… 0 hours/week →
 * 20 hours/week est." — the one-line grid gave the amount everything but a
 * ~6em label floor, so the factor's name was unreadable AND the amount wrapped
 * to a second line anyway.
 *
 * THE RULE, in characters of the row's own type (`typography.edgeLabel`, the
 * label's and the amount's size) at the bound, where the row holds
 * `NODE_ROW_AMOUNT_MAX_CHARS` (23):
 *
 *   one-line  ⇔  min(name, OPTION_ROW_NAME_MIN_CHARS) + 1 + amount ≤ 23
 *
 * where `amount` is the row's `change` plus the glued mark (" est.", " brief",
 * " you", …; none on a `Needs input` row) and 1 is the grid's 8px column gap.
 * `OPTION_ROW_NAME_MIN_CHARS` = 12 is the old grid's 6em label floor in
 * characters (6em ÷ the measured 0.493em a character, `AVG_CHAR_EM`): the
 * least of the name a one-line row may keep. Otherwise the row is TWO lines —
 * the name alone, full width (truncating only past the card), then the amount
 * with its mark. No DOM measurement: the rule has no zoom term, so it never
 * re-lays a board as the camera moves — the estate's "size for the bound" rule.
 */
export const OPTION_ROW_NAME_MIN_CHARS = 12

/** The grid's 8px column gap, in characters at the bound (≈ 0.9 of one). */
const OPTION_ROW_GAP_CHARS = 1

export type OptionRowForm = 'one-line' | 'two-line'

/** The characters a row's amount occupies at the bound: its `change`, the glue and the mark's token. */
export function optionRowAmountChars(row: OptionChangeRow): number {
  const mark = row.needsInput ? '' : VALUE_SOURCE_MARK_TOKEN[row.targetSource.kind]
  return row.change.length + (mark ? 1 + mark.length : 0)
}

export function optionRowForm(row: OptionChangeRow, amountMaxChars: number = NODE_ROW_AMOUNT_MAX_CHARS): OptionRowForm {
  const name = Math.min(row.fullLabel.length, OPTION_ROW_NAME_MIN_CHARS)
  return name + OPTION_ROW_GAP_CHARS + optionRowAmountChars(row) <= amountMaxChars ? 'one-line' : 'two-line'
}

/**
 * Lines a row takes at the bound: one for a one-line row; for a two-line row
 * the name's line plus the amount's (an amount longer than the row wraps — it
 * breaks only before its arrow — so it is counted in whole row-widths).
 */
export function optionRowLineCount(row: OptionChangeRow, amountMaxChars: number = NODE_ROW_AMOUNT_MAX_CHARS): number {
  if (optionRowForm(row, amountMaxChars) === 'one-line') return 1
  return 1 + Math.max(1, Math.ceil(optionRowAmountChars(row) / amountMaxChars))
}

/**
 * ⭐ THE LINES A CARD SPENDS ON ROWS — the three rows it reserves, at the two
 * lines a grid row reached at the bound whenever its amount could not sit in
 * the ~10 characters the 6em floor left it (every `from → to`: 23 of 23 landing
 * rows measured stacked before the grid, and the grid kept the amount's wrap).
 * So the two-line form never makes the rows taller than three rows already
 * were: a row that would overrun the budget is not shown, and `+N more` counts
 * it. The `+N more` line itself is the one line it always was.
 */
export const OPTION_CARD_ROW_LINE_BUDGET = 2 * OPTION_CARD_ROW_LIMIT

/**
 * The rows that fit `OPTION_CARD_ROW_LINE_BUDGET`: a PREFIX of the shared order
 * (a later short row never jumps a longer one — options compare like with
 * like), and never zero rows (ED 02:31Z D2: fewer rows before a cut value).
 */
export function fitRowsToLineBudget(rows: OptionChangeRow[], amountMaxChars: number = NODE_ROW_AMOUNT_MAX_CHARS): OptionChangeRow[] {
  const out: OptionChangeRow[] = []
  let used = 0
  for (const row of rows) {
    const lines = optionRowLineCount(row, amountMaxChars)
    if (out.length > 0 && used + lines > OPTION_CARD_ROW_LINE_BUDGET) break
    out.push(row)
    used += lines
  }
  return out
}

/**
 * ⭐ MAY THIS SEGMENT OF A ROW'S AMOUNT STAY ON ONE LINE? True while it fits one
 * line of the AMOUNT's budget at the largest label counter-scale
 * (`NODE_ROW_AMOUNT_MAX_CHARS`: the estate's per-line budget, measured at the
 * amount's own `edgeLabel` size — since 27 Sep 2026 no longer the label's 12px
 * budget, which the landing cap shrank until "→ 3 engineers no source" broke
 * inside its value; the amount never breaks, the label yields). A longer
 * segment — a producer's prose reading — wraps at its own spaces rather than
 * run past the card's right edge (served `cd6a82e4`: "49 GBP per month → 59 GBP
 * per month · brief" overflowed). The card's amount breaks, if at all, before
 * the arrow.
 */
export function optionAmountSegmentNoWrap(segment: string, amountMaxChars: number = NODE_ROW_AMOUNT_MAX_CHARS): boolean {
  return segment.length <= amountMaxChars
}

/** `+N more`: the concrete changes the card does not show — never below zero. */
export function moreCount(concreteChangeCount: number, rowsShown: number): number {
  return Math.max(0, concreteChangeCount - rowsShown)
}

/**
 * ⭐ CONCRETE CHANGES ONLY — contract v3.1 `checks.option` ("Concrete changes,
 * differentiator and an editable target route"), DESIGN-GAP-v31 row #9.
 *
 * Measured on served `eec722ab` (25 Sep): market-entry's Germany option listed
 * "Localisation and compliance cost · 0.5 · same as baseline" and "Nordics
 * market entry · Low · same as baseline" as two of its three resting rows, and
 * every row of every vendor-selection option read "same as baseline" — a card
 * whose rows were all non-changes, posing as what the option changes.
 *
 * A row is NOT a concrete change when the data itself says the option leaves
 * the factor where its reference already has it:
 *   · `sameAsReference` — the target equals the declared baseline option's own
 *     target (the builder's `isInterventionNoChange` + the same display string),
 *     or an unframed target the builder already read as "No change";
 *   · no baseline pair was formed, no "from" printed, and the factor's CURRENT
 *     value equals the target (`isInterventionNoChange`, the builder's own
 *     tolerance) — the arm where the builder declined to pair for exactly this
 *     reason.
 * Everything else is kept: a `from → to`, a direction word, a target with no
 * reference to compare ("→ £59" states a target nobody can call unchanged), and
 * a `Needs input` gap.
 *
 * ⭐ AND `+N more` COUNTS THE SAME FILTERED LIST (DIFF N1, 28 Sep 2026): rows
 * shown + more = the option's CONCRETE changes. Unchanged targets are still
 * targets — the inspector lists them, and the rail's route names their total —
 * but they are never advertised as more changes.
 */
export function isConcreteChangeRow(
  row: OptionChangeRow,
  target: Pick<OptionTargetLike, 'value'> | null | undefined,
  factor: Pick<FactorContext, 'observedValue'>,
): boolean {
  if (row.needsInput) return true
  if (row.sameAsReference) return false
  if (row.before !== undefined || row.reference === 'baseline_option') return true
  return !(
    target != null &&
    typeof factor.observedValue === 'number' &&
    isInterventionNoChange(factor.observedValue, target.value)
  )
}
