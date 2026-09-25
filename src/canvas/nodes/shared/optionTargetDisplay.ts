/**
 * ⭐⭐ ONE OWNER FOR "WHAT DOES THIS OPTION SET THIS FACTOR TO, IN WORDS" — so
 * the option card and the inspector cannot print two different things for one
 * target.
 *
 * ── WHY THIS MODULE EXISTS (DEFECT 5 + ED #63 §9, served `a4434670`) ────────
 * The card resolved each target from `ceeAnalysisReady.options[].interventions`
 * joined with `intervention_details`, kept a user's receipt-stamped `source`
 * over a bare producer number, and formatted it through
 * `formatInterventionTargetText` — "£60k", "59 GBP/month", "Low (0.1)". The
 * inspector read `node.data.interventions` alone and, whenever a target carried
 * no `display_value` (every target a user has set), printed the MODEL'S
 * INTERNAL NUMBER: "0.295 model value" beside a card saying "59 GBP/month".
 *
 * The three resolution steps lived INLINE in `OptionNode`, so the inspector had
 * no way to ask the same question. They are MOVED here byte-for-byte — not
 * re-spelled — and `OptionNode` now calls them, so a later correction to either
 * surface lands on both (trap 12: a hand-maintained mirror is the defect).
 *
 * ⛔ NO NEW TRANSFORM. Nothing here converts a real-world figure back to the
 * model scale. The display direction (model value → reading) is the card's
 * existing, trusted chain; the reverse direction belongs to the input-parsing
 * path and is not invented here.
 */
import { joinInterventionDetails, unwrapInterventionValue } from '../../utils/labelUtils'
import {
  buildOptionChangeRow,
  buildOptionNeedsInputRow,
  type FactorContext,
  type OptionChangeRow,
  type OptionTargetLike,
} from './optionChangeRows'
import { tierReadingNumber } from '../../utils/interventionDisplay'

/** The slice of `ceeAnalysisReady.options[]` these readers use. */
export interface CeeOptionTargetsLike {
  id: string
  interventions?: unknown
  intervention_details?: unknown
}

/** The slice of a canvas node these readers use. */
export interface TargetNodeLike {
  id: string
  type?: string
  data?: Record<string, unknown> | null
}

/**
 * Every target this option sets, as the CARD reads it.
 *
 * Moved verbatim from `OptionNode`'s `optionSet` memo. The CEE map wins when
 * present (it is what the analysis ran on) with its `intervention_details`
 * joined in; otherwise the option node's own map.
 *
 * ⚠ A BARE NUMBER CARRIES NO PROVENANCE, SO IT MUST NOT ERASE ONE. After a
 * user's `option_intervention_edit`, the same turn's `analysis_ready` has been
 * witnessed carrying BARE numbers (`applyDraftResult.ts`,
 * `mergeProducerInterventions`, 23 Sep staging) while the node holds the
 * receipt-stamped `{value, source:'user_specified'}`. Reading the bare map
 * alone printed the user's own target with no author. Same rule as
 * `mergeProducerInterventions`: where the producer entry has no source and its
 * value EXACTLY equals the node's own object, that object's `source` stands. A
 * different value keeps the producer's (unstamped) entry.
 */
export function resolveOptionTargets(
  optionData: Record<string, unknown> | null | undefined,
  ceeOpt: CeeOptionTargetsLike | null | undefined,
): Map<string, OptionTargetLike> {
  const raw = ceeOpt?.interventions && typeof ceeOpt.interventions === 'object'
    ? joinInterventionDetails(
        ceeOpt.interventions as Record<string, unknown>,
        ceeOpt.intervention_details as Record<string, unknown> | undefined,
      )
    : Object.entries((optionData?.interventions ?? {}) as Record<string, unknown>)
  const ownInterventions = (optionData?.interventions ?? {}) as Record<string, unknown>
  const targets = new Map<string, OptionTargetLike>()
  for (const [fid, entry] of raw) {
    const u = unwrapInterventionValue(entry)
    if (u.value == null) continue
    let source = u.source ?? null
    if (source === null && ceeOpt) {
      const own = ownInterventions[fid]
      if (own !== null && typeof own === 'object' && !Array.isArray(own)) {
        const ownU = unwrapInterventionValue(own)
        if (ownU.value === u.value) source = ownU.source ?? null
      }
    }
    targets.set(fid, { value: u.value, displayValue: u.displayValue, source })
  }
  return targets
}

/**
 * ⭐ THE TARGETS THIS OPTION NAMES AND NEVER SET (design-gap row 22) — factorId →
 * the entry's own `source` (or null). Read from the SAME map `resolveOptionTargets`
 * reads (CEE's, joined with its details, when present; else the node's own), and
 * exactly the entries it skips for having no number: those that ALSO carry no
 * reading (`display_value`). An entry with a reading but no number is a
 * different state (a named value awaiting encoding) and is not claimed here.
 * `resolveOptionInterventionCount` already counts these keys, so the card's
 * `+N more` counted rows it could never show.
 */
export function resolveUnsetOptionTargets(
  optionData: Record<string, unknown> | null | undefined,
  ceeOpt: CeeOptionTargetsLike | null | undefined,
): Map<string, string | null> {
  const raw = ceeOpt?.interventions && typeof ceeOpt.interventions === 'object'
    ? joinInterventionDetails(
        ceeOpt.interventions as Record<string, unknown>,
        ceeOpt.intervention_details as Record<string, unknown> | undefined,
      )
    : Object.entries((optionData?.interventions ?? {}) as Record<string, unknown>)
  const unset = new Map<string, string | null>()
  for (const [fid, entry] of raw) {
    const u = unwrapInterventionValue(entry)
    if (u.value == null && u.displayValue == null) unset.set(fid, u.source ?? null)
  }
  return unset
}

/** The `Needs input` row for an unset target, labelled exactly as a change row is. */
export function buildOptionNeedsInputTargetRow({
  factorId,
  factorNode,
  source,
}: {
  factorId: string
  factorNode: TargetNodeLike | undefined
  source: string | null
}): OptionChangeRow {
  return buildOptionNeedsInputRow({ factorId, factor: optionFactorContext(factorNode, factorId), source })
}

/**
 * The factor half of a change row — moved verbatim from `OptionNode`'s
 * `changeRows` memo. `data.unit` wins over `observedState.unit`, as it did there.
 */
export function optionFactorContext(
  factorNode: TargetNodeLike | undefined,
  factorId: string,
): FactorContext {
  const obs = factorNode?.data?.observedState as {
    unit?: string; factor_type?: string; cap?: number; value?: number; raw_value?: string | number
  } | undefined
  return {
    label: (factorNode?.data?.label as string | undefined) ?? factorId,
    unit: (factorNode?.data?.unit as string | undefined) ?? obs?.unit,
    factorType: obs?.factor_type,
    cap: obs?.cap,
    observedValue: obs?.value,
    observedRawValue: obs?.raw_value,
  }
}

export interface BaselineOptionReference {
  label: string
  values: Record<string, ReturnType<typeof unwrapInterventionValue>>
}

/**
 * The declared baseline option's own targets — the card's "from" reference.
 * Moved verbatim from `OptionNode`'s `baselineOptionReference` memo; the caller
 * still answers "is THIS option the baseline?" (the card returns null for it).
 *
 * A before-reference must identify an actual option. A factor's observed value
 * may be a proposal, and a label containing "status quo" is not a reference
 * declaration. Multiple declared baselines are ambiguous here.
 */
export function resolveBaselineOptionReference(
  nodes: ReadonlyArray<TargetNodeLike>,
  ceeOptions: ReadonlyArray<CeeOptionTargetsLike> | null | undefined,
  optionId: string,
): BaselineOptionReference | null {
  const candidates = nodes.filter(n =>
    n.id !== optionId && (n.type === 'option' || n.data?.type === 'option') &&
    n.data?.is_baseline === true,
  )
  if (candidates.length !== 1) return null
  const baselineNode = candidates[0]
  const baselineCeeOption = ceeOptions?.find(opt => opt.id === baselineNode.id)
  const raw = baselineCeeOption?.interventions ?? baselineNode.data?.interventions
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  // ⭐ The SAME join as the chip builder. `structuredDeltas` drops any pair
  // where one side carries an authored string and the other does not, so
  // joining only the target's map empties the card. One owner, both sides.
  const rawEntries = joinInterventionDetails(
    raw as Record<string, unknown>,
    baselineCeeOption?.intervention_details as Record<string, unknown> | undefined,
  )
  const values = Object.fromEntries(rawEntries.flatMap(([factorId, entry]) => {
    const unwrapped = unwrapInterventionValue(entry)
    return unwrapped.value == null ? [] : [[factorId, unwrapped] as const]
  }))
  return {
    label: typeof baselineNode.data?.label === 'string' && baselineNode.data.label.trim()
      ? baselineNode.data.label : 'Baseline option',
    values,
  }
}

/**
 * One option's change row for one factor, built exactly as the card builds it.
 */
export function buildOptionTargetRow({
  factorId,
  target,
  factorNode,
  baselineReference,
}: {
  factorId: string
  target: OptionTargetLike
  factorNode: TargetNodeLike | undefined
  baselineReference: BaselineOptionReference | null
}): OptionChangeRow {
  const ref = baselineReference?.values[factorId]
  return buildOptionChangeRow({
    factorId,
    target,
    factor: optionFactorContext(factorNode, factorId),
    baselineOptionTarget: ref && ref.value != null
      ? { value: ref.value, displayValue: ref.displayValue ?? null }
      : null,
  })
}

/**
 * ⭐ DOES THE READING SHOW THE NUMBER AN INPUT ON THE MODEL SCALE WOULD HOLD?
 *
 * The option-target input edits the MODEL value (that is the carrier's
 * contract, `option_intervention_edit.value`, and its parsing is owned by the
 * commit path — not by this module). So it may stand beside a reading only when
 * the reading visibly IS that number: a bare "0.2", or a tier reading carrying
 * it in parentheses, "Low (0.1)" — the form both CEE's `display-value.ts` and
 * `formatInterventionTargetText` write, `parseFloat(v.toFixed(2))`.
 *
 * ⛔ "£60k", "59 GBP/month", "15%", "Increases" and CEE prose do not show it,
 * and an input holding "0.5" beside "£60k" is the exact "0.295 model value"
 * defect this closes. Those rows keep their input under technical detail,
 * labelled as the model's internal scale.
 *
 * ⚠ DELIBERATELY A TEST OF WHAT THE USER SEES, not of units or anchors: a
 * false negative only moves a box behind "Show technical detail"; a false
 * positive is impossible without the reading literally printing the number.
 */
export function readingShowsModelValue(reading: string, modelValue: number): boolean {
  if (!Number.isFinite(modelValue)) return false
  const text = reading.trim()
  const parenthesised = /\((-?\d+(?:\.\d+)?)\)$/.exec(text)
  const candidate = parenthesised ? parenthesised[1] : text
  if (!/^-?\d+(?:\.\d+)?$/.test(candidate)) return false
  const shown = Number(candidate)
  // The number the card's own tier reading printed for this model value — the
  // formatter's helper, never a second rounding rule: `Math.round(v*100)/100`
  // disagrees at half-cent boundaries (0.155 → 0.16 vs the printed 0.15).
  return shown === modelValue || shown === tierReadingNumber(modelValue)
}
