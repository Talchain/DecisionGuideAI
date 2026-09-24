/**
 * Reasoning V2 — WHICH GROUNDED SIGNALS the "Challenge the thinking" zone shows
 * at rest: the three strongest drivers, one tipping point, one assumption or
 * evidence gap. Pure: it SELECTS from the view model and the normalised
 * `flip_thresholds[]` rows, and computes nothing.
 *
 * ⛔ NO NEW NUMBER, NO NEW RANKING, NO NEW SENTENCE ABOUT THE RUN.
 *   • Driver order and bar length are `vm.drivers.influenceRows` as built
 *     (sorted by `displayInfluence`, `fraction` = magnitude / strongest).
 *   • The rank a driver prints is the view model's own `Rank` inspect value —
 *     the PRODUCER's rank, never the row's position (see
 *     `theRankIsTheProducersNotThePositions.spec.ts`: a suppressed factor must
 *     not let a survivor be renumbered #1).
 *   • The tipping point goes through the STRICT gate `buildTippingPoints`
 *     (`flip_reason === 'found'` and both endpoints and a named alternative)
 *     and is worded by the existing `ANALYSIS_NEW_COPY.disclosure.tippingPoint`.
 *     `glanceCondition`'s looser gate is deliberately not used.
 *   • The gap is the FIRST assumption/evidence item in
 *     `vm.uncertainty.findings`, whose order the builder already fixes ("what
 *     is most worth resolving, FIRST"; then the unconfirmed strength; then
 *     evidence gaps in emission order; then the ledger). This file filters by
 *     kind and keeps that order; it never re-ranks.
 *
 * ⚠ A ROW WITHOUT AN ID GETS NO ACTIONS. Every act (focus, inspect, ask) needs
 * a model element to point at; a row the view model could not tie to one
 * renders as text alone rather than as a control that cannot act.
 */
import { ANALYSIS_NEW_COPY as COPY } from './analysisNewCopy'
import type { AnalysisNewFinding, AnalysisNewViewModel } from './analysisNewTypes'
import { driverSubjectKey } from './driverSubjectCount'
import { buildTippingPoints, type FlipThresholdLike } from './tippingPoints'
import type { AskOlumiPayload } from '../coaching/askOlumiStore'

/** How many drivers the zone shows at rest. The Drivers section keeps the rest. */
export const SIGNAL_DRIVER_COUNT = 3

/**
 * The label `buildAnalysisNewViewModel`'s `driverFinding` gives its rank row
 * (`row('Rank', …)`). ⚠ A MIRROR OF ONE STRING, pinned by
 * `reasoningSignals.spec.tsx` on the witnessed suppression shape: if the
 * builder renames the row, the rank disappears from this zone and that spec
 * goes red rather than a position being printed in its place.
 */
const RANK_ROW_LABEL = 'Rank'

/**
 * The normalised flip row as `useResultsSectionData` emits it: the strict
 * gate's fields plus `node_id`, which `buildTippingPoints` does not carry and
 * which is the only thing that lets the row point at the model.
 */
export type FlipThresholdRow = FlipThresholdLike & { node_id?: unknown }

export interface SignalDriverRow {
  /** `DriverInfluenceRow.id` (the factor key). Identity for tests. */
  id: string
  label: string
  /** 0-1 against the strongest driver in this run. Bar geometry only. */
  fraction: number
  /** The producer's rank as the Drivers section prints it, or `null`. */
  rank: string | null
  /** Canvas target, or `null` (fail-closed `canFocus` in the builder). */
  targetId: string | null
  ask: AskOlumiPayload | null
}

export interface SignalTippingRow {
  /** `ANALYSIS_NEW_COPY.disclosure.tippingPoint(...)` over the admitted row. */
  sentence: string
  factorLabel: string
  targetId: string | null
  ask: AskOlumiPayload | null
}

export type SignalGapKind = 'value_of_information' | 'assumed_strength' | 'evidence_gap' | 'ledger_assumption'

export interface SignalGapRow {
  /** The view model's finding id. Identity for tests. */
  findingId: string
  kind: SignalGapKind
  headline: string
  /** The finding's own implication, or `null` where it is only a basis note. */
  detail: string | null
  focusTargetId: string | null
  inspectTargetId: string | null
  ask: AskOlumiPayload | null
}

export interface ReasoningSignalsModel {
  drivers: SignalDriverRow[]
  tipping: SignalTippingRow | null
  gap: SignalGapRow | null
}

/**
 * Finding-id prefixes minted by `buildUncertainty`, and what each one is. The
 * prefix is identity (it is minted in one place per kind), never a guess from
 * the headline's wording.
 */
const GAP_KIND_BY_PREFIX: ReadonlyArray<readonly [string, SignalGapKind]> = [
  ['voi:', 'value_of_information'],
  ['uncertainty:assumed-strength:', 'assumed_strength'],
  ['gap:', 'evidence_gap'],
  ['assumption:', 'ledger_assumption'],
]

/**
 * `voiFinding`'s "nothing is above resolution" row. It STATES that no factor
 * clears the estimator's resolution, which is the opposite of a gap to chase,
 * so it is never the zone's gap.
 */
const VOI_NONE_ABOVE_RESOLUTION_ID = 'voi:none-above-resolution'

const nonEmptyId = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v : null

function gapKindOf(findingId: string): SignalGapKind | null {
  if (findingId === VOI_NONE_ABOVE_RESOLUTION_ID) return null
  return GAP_KIND_BY_PREFIX.find(([prefix]) => findingId.startsWith(prefix))?.[1] ?? null
}

function driverRows(vm: Pick<AnalysisNewViewModel, 'drivers'>): SignalDriverRow[] {
  return vm.drivers.influenceRows.slice(0, SIGNAL_DRIVER_COUNT).map((row) => {
    const finding = vm.drivers.findings.find((f) => driverSubjectKey(f.id) === row.id)
    const rank = finding?.inspect.find((r) => r.label === RANK_ROW_LABEL)?.value ?? null
    return {
      id: row.id,
      label: row.label,
      fraction: row.fraction,
      rank,
      targetId: row.targetId,
      ask: row.targetId
        ? {
            // ⚠ The drawer's context is the SCALE note, not the row's
            // "Relative influence N%" implication: this zone prints no
            // percentage, and the ask must not smuggle one back in.
            context: COPY.coverage.setRelativeInfluence,
            draft: row.label,
            label: COPY.disclosure.askOlumi,
            targetId: row.targetId,
          }
        : null,
    }
  })
}

function tippingRow(rows: readonly FlipThresholdRow[] | null | undefined): SignalTippingRow | null {
  if (!Array.isArray(rows)) return null
  for (const row of rows) {
    // The strict gate, applied to ONE row so the admitted point and the row
    // that carries its `node_id` are the same object — identity, not a label
    // match between two lists.
    const [point] = buildTippingPoints([row])
    if (!point) continue
    const sentence = COPY.disclosure.tippingPoint(
      point.factorLabel,
      point.currentValue,
      point.flipValue,
      point.alternativeLabel,
      point.unit,
    )
    const targetId = nonEmptyId(row?.node_id)
    return {
      sentence,
      factorLabel: point.factorLabel,
      targetId,
      ask: targetId
        ? { context: sentence, draft: point.factorLabel, label: COPY.disclosure.askOlumi, targetId }
        : null,
    }
  }
  return null
}

function gapRow(vm: Pick<AnalysisNewViewModel, 'uncertainty'>): SignalGapRow | null {
  let chosen: { finding: AnalysisNewFinding; kind: SignalGapKind } | null = null
  for (const finding of vm.uncertainty.findings) {
    const kind = gapKindOf(finding.id)
    if (kind) {
      chosen = { finding, kind }
      break
    }
  }
  if (!chosen) return null
  const { finding, kind } = chosen
  const targetId = finding.targetId ?? null
  return {
    findingId: finding.id,
    kind,
    headline: finding.headline,
    // The value-of-information row's implication is the ranking's basis note,
    // the same sentence for every run; it stays in the Uncertainty section.
    detail: kind === 'value_of_information' || !finding.implication ? null : finding.implication,
    focusTargetId: targetId ? (finding.focusTargetId ?? targetId) : null,
    inspectTargetId: targetId ? (finding.reviewTargetId ?? targetId) : null,
    // The same payload `AnalysisNewTabBody`'s `askOlumiAbout` builds for a row.
    ask: targetId
      ? {
          context: finding.detail ?? finding.implication,
          draft: finding.headline,
          label: COPY.disclosure.askOlumi,
          targetId,
        }
      : null,
  }
}

/**
 * The zone's signals, or `null` when there is nothing grounded to show —
 * including ALWAYS pre-run, where the flip rows handed in are not a run's.
 */
export function buildReasoningSignals(
  vm: Pick<AnalysisNewViewModel, 'status' | 'drivers' | 'uncertainty'>,
  flipThresholds: readonly FlipThresholdRow[] | null | undefined,
): ReasoningSignalsModel | null {
  if (vm.status.isPreRun) return null
  const drivers = driverRows(vm)
  const tipping = tippingRow(flipThresholds)
  const gap = gapRow(vm)
  if (drivers.length === 0 && tipping === null && gap === null) return null
  return { drivers, tipping, gap }
}
