/**
 * buildV7Lenses — pure passthrough builder for the V7 lens group + evidence
 * disclosure (V7 Lane L5).
 *
 * Composes lens availability, honest-gate selection, and the evidence model
 * from EXISTING resultsSectionData fields only — never a fabricated number, a
 * threshold, or an inferred claim (V6-RESPEC-2026-07-23 §5, passthrough
 * doctrine). Every gate here renders the honest "not produced yet / unlocks
 * when the engine returns…" line instead of inventing the missing value.
 *
 *   · Likely outcome ← recommendation.allOptions (the SAME options + win
 *     probabilities OptionCards consumes); the shared [globalMin, globalMax]
 *     scale is computed identically to OptionCards (p10/p90 with mean
 *     fallback) so the V7 range bars and the cards below cannot drift.
 *   · Goal fit ← per-option goalProbability vs goalThreshold, gated exactly
 *     like OptionCards' "Hits target" (threshold present AND every option
 *     carries a probability); the gate distinguishes the user-actionable
 *     no-target case from the producer gap.
 *   · Stability → always the honest gap (no per-option stability on the wire).
 *   · Evidence: drivers (producer rank order, "est." from a defaulted-value/
 *     confidence read), flip risks (challengeFragileEdges — the SAME slice the
 *     signal row + stress test consume), trade-offs (conditional_winners —
 *     producer factor-split narration, verbatim values).
 *
 * The What-changed lens reads local run history at render (V7WhatChangedLens)
 * and is deliberately NOT modelled here — its data is store-backed, not part
 * of resultsSectionData.
 */

import type { OptionResult, DriverItem, ConditionalWinner } from '../types'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { VoiRanking } from '../voi/voiRanking'
import { computeOptionScale } from '../shared/OptionRangeBar'

/** One flip-risk row — the challengeFragileEdges slice, unchanged. */
export interface V7FlipRisk {
  fromId?: string
  /** Producer target node id — passthrough for the analysis-graph projection's
   * from→to canvas-edge resolution (never displayed). */
  toId?: string
  /** Producer edge id — passthrough for the analysis-graph projection's edge_id
   * canvas-edge resolution (never displayed). */
  edgeId?: string
  fromLabel: string
  toLabel: string
  /** Producer switch probability in [0,1], or null when non-finite. */
  switchProbability: number | null
}

/** One driver row for the evidence disclosure — pure passthrough. */
export interface V7EvidenceDriver {
  factorKey: string
  label: string
  /** Producer-normalised effect direction; null when the producer sent none. */
  direction: 'positive' | 'negative' | null
  /** True when the factor value OR its confidence was defaulted (an estimate)
   * — a direct producer boolean read, never a threshold. */
  isEstimate: boolean
  /** Canvas focus target when the factor maps to a node. */
  focusId?: string
}

/** One trade-off row — a producer conditional-winner split, narrated verbatim. */
export interface V7TradeOff {
  factorLabel: string
  factorId: string
  splitValue: number
  splitUnit?: string
  highWinnerLabel: string
  lowWinnerLabel: string
}

export interface V7OutcomeLens {
  /** True when at least one option carries a win probability or a p10/p90 range. */
  available: boolean
  /** Options to render (recommendation.allOptions), unchanged. */
  options: OptionResult[]
  /** Shared display scale — computed exactly as OptionCards (UI-SEM-free). */
  globalMin: number
  globalMax: number
  /** True when any option carries a full p10/p90 range (gates the caption). */
  hasRange: boolean
  winnerId?: string
}

export interface V7GoalLens {
  available: boolean
  /** Which honest gate to render when unavailable. */
  gate: 'none' | 'no_target' | 'producer_gap'
  goalThreshold: number | null
  options: Array<{ id: string; label: string; goalProbability: number; isWinner: boolean }>
}

export interface V7EvidenceModel {
  drivers: V7EvidenceDriver[]
  flipRisks: V7FlipRisk[]
  tradeOffs: V7TradeOff[]
  /**
   * V7-C slice 1 (ROADMAP 2.141) — the "Resolve next" view's model: ISL's real
   * per-factor EVPPI as a RANKING plus the below-resolution band, carried
   * straight through from the hook's `voiRanking`.
   *
   * Deliberately NOT recomputed, re-sorted, filtered or grouped here. The one
   * verdict lives in `voi/voiRanking.ts` (pure, unit-pinned); a second
   * derivation in this file would be the hand-maintained mirror trap 12 warns
   * about, and re-sorting is the specific defect the producer-order doctrine
   * exists to prevent. `null` ⇒ the view renders its honest gate.
   */
  resolveNext: VoiRanking | null
  /**
   * ROADMAP 1.267. The evidence ROWS are producer data and always render;
   * the two lead-in NOTES above them ("…can change the leading option",
   * "Where the leading option depends on an assumption") are claims that
   * presuppose a leader. Carried on the model rather than resolved in the
   * component so the one verdict this file already computes is the only
   * authority — the disclosure never re-derives one.
   */
  designationsWithheld: boolean
}

export interface V7LensesModel {
  outcome: V7OutcomeLens
  goal: V7GoalLens
  evidence: V7EvidenceModel
}

function driverDirection(d: DriverItem): 'positive' | 'negative' | null {
  return d.direction === 'positive' || d.direction === 'negative' ? d.direction : null
}

export function buildV7Lenses(data: ResultsSectionDataReturn): V7LensesModel {
  const { recommendation, drivers, confidence, voiRanking } = data
  const options = recommendation.allOptions ?? []
  // ROADMAP 1.267. `winnerId` drives the ONLY thing the V7 rows do with a
  // leader: bold + darken that row's label and readout
  // (`V7LensGroup.tsx`). On a withheld run the V7 HEADLINE above these rows
  // already goes silent (`buildV7Headline` returns '' on an `unknown`
  // verdict, ROADMAP 1.223) — which left a bolded, designated option sitting
  // under a deliberately empty hero, the emphasis making the claim the
  // sentence had just been withdrawn. Withholding the id here is one change
  // point for every `isWinner` style in the group.
  //
  // `options` needs no separate treatment: it is `recommendation.allOptions`,
  // which the hook now leaves in canonical order on a withheld run.
  const designationsWithheld = recommendation.verdict != null && !recommendation.verdict.hasLeadingOption
  const winnerId = designationsWithheld ? undefined : recommendation.recommendedOption?.id

  // ── Likely outcome ─────────────────────────────────────────────────────
  const hasRange = options.some(
    (o) => typeof o.outcome?.p10 === 'number' && typeof o.outcome?.p90 === 'number',
  )
  const hasWin = options.some(
    (o) => typeof o.winProbability === 'number' && Number.isFinite(o.winProbability),
  )
  // Shared [globalMin, globalMax] scale — computeOptionScale is the exact
  // OptionCards formula (p10/p90 with mean fallback), so the V7 bars and the
  // cards below share one scale.
  const { globalMin, globalMax } = computeOptionScale(options)

  const outcome: V7OutcomeLens = {
    available: options.length > 0 && (hasRange || hasWin),
    options,
    globalMin,
    globalMax,
    hasRange,
    winnerId,
  }

  // ── Goal fit ───────────────────────────────────────────────────────────
  // Gate exactly like OptionCards' "Hits target": a user threshold is present
  // AND every option carries a finite goal probability. Otherwise the honest
  // gate, distinguishing the no-target case (user-actionable) from the
  // producer gap (a target is set but the engine returned no probabilities).
  const goalThreshold =
    typeof recommendation.goalThreshold === 'number' && Number.isFinite(recommendation.goalThreshold)
      ? recommendation.goalThreshold
      : null
  const everyGoalProb =
    options.length > 0 &&
    options.every((o) => typeof o.goalProbability === 'number' && Number.isFinite(o.goalProbability))
  const goalAvailable = goalThreshold != null && everyGoalProb
  const goal: V7GoalLens = {
    available: goalAvailable,
    gate: goalAvailable ? 'none' : goalThreshold == null ? 'no_target' : 'producer_gap',
    goalThreshold,
    options: goalAvailable
      ? options.map((o) => ({
          id: o.id,
          label: o.label,
          goalProbability: o.goalProbability as number,
          isWinner: o.id === winnerId,
        }))
      : [],
  }

  // ── Evidence: drivers / flip risks / trade-offs ────────────────────────
  const evidenceDrivers: V7EvidenceDriver[] = (drivers.drivers ?? []).map((d) => ({
    factorKey: d.factorKey,
    label: d.factorLabel,
    direction: driverDirection(d),
    isEstimate: d.isDefaultedConfidence === true || d.valueDefaulted === true,
    focusId: d.canFocus ? (d.matchedNodeId ?? d.factorKey) : undefined,
  }))

  const flipRisks: V7FlipRisk[] = (confidence.challengeFragileEdges ?? []).map((e) => ({
    fromId: e.from_id,
    toId: e.to_id,
    edgeId: e.edge_id,
    fromLabel: e.from_label,
    toLabel: e.to_label,
    switchProbability:
      typeof e.switch_probability === 'number' && Number.isFinite(e.switch_probability)
        ? e.switch_probability
        : null,
  }))

  const tradeOffs: V7TradeOff[] = (confidence.conditionalWinners ?? []).map(
    (c: ConditionalWinner) => ({
      factorLabel: c.factor_label,
      factorId: c.factor_id,
      splitValue: c.split_value,
      splitUnit: c.split_unit,
      highWinnerLabel: c.high_bucket.winner_label,
      lowWinnerLabel: c.low_bucket.winner_label,
    }),
  )

  return {
    outcome,
    goal,
    evidence: {
      drivers: evidenceDrivers,
      flipRisks,
      tradeOffs,
      // Passthrough of the hook's single verdict — never re-derived here.
      resolveNext: voiRanking,
      designationsWithheld,
    },
  }
}
