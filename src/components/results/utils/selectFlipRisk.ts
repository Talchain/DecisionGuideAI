/**
 * selectFlipRisk — THE single source of truth for the question "may this run
 * name a flip risk at all, and if so which factor is it".
 *
 * ROADMAP 2.276. Witnessed on staging build `a27cadf7` (CEE `ce35e96`, PLoT
 * `7133bba`) in `PHASE0-EVIDENCE-2026-07-28/witness-2267-onscreen-flip.md`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS MODULE EXISTS TO CLOSE
 * ─────────────────────────────────────────────────────────────────────────
 * The producer emits TWO different quantities, and the UI was reading the
 * WRONG one under the word "flip":
 *
 *   • `flip_thresholds[]`                  THE flip evidence. `flip_value` is
 *                                          the factor value at which the
 *                                          ranking changes; `null` means the
 *                                          run positively attested that NO
 *                                          flip exists in that factor's range
 *                                          (`structurally_invariant`,
 *                                          `no_effect_within_bounds`).
 *   • `robustness.fragile_edges[]`
 *     `.switch_probability`                A robustness Monte-Carlo marginal
 *                                          over an EDGE. Non-zero on almost
 *                                          every run, including runs with no
 *                                          flip anywhere.
 *
 * Both flip-risk surfaces ranked `switch_probability` and never consulted
 * `flip_thresholds`, so on a turn whose flip thresholds were 100 %
 * non-flipping the product still announced a "Top flip risk" naming a factor
 * whose own `rank_flip_rate` was 0 (witness §4b, §10). Two independent
 * selectors over the same fragile-edge array then disagreed with each other
 * about WHICH factor, on one screen (witness §10).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE RULE, AND WHY EACH ARM IS DRAWN WHERE IT IS
 * ─────────────────────────────────────────────────────────────────────────
 *   • `flips_absent`          flip thresholds are PRESENT and EVERY row is
 *                             non-flipping. The producer has affirmatively
 *                             said there is no flip. No surface may name a
 *                             flip risk or print a flip percentage. Honest
 *                             absence — the whole point of the fix.
 *   • `flips_present`         at least one row carries a real `flip_value`.
 *                             Candidates are RESTRICTED to the factors that
 *                             actually flip, so the named factor is one the
 *                             producer attests can flip. This is the
 *                             attribution half: on witness-2265 run B the
 *                             only flipping factor (`fac_op_readiness`) is
 *                             not even in the top five fragile edges, so
 *                             ranking `switch_probability` alone named the
 *                             wrong factor on a genuinely flip-bearing turn.
 *   • `no_producer_flip_data` no `flip_thresholds` array at all. Absence of
 *                             evidence is NOT evidence of absence: older /
 *                             partial payloads keep a named flip risk rather
 *                             than being silently blinded.
 *
 * ⚠ "LEGACY BEHAVIOUR IS PRESERVED" WOULD BE FALSE — say what actually changed.
 * On `no_producer_flip_data` the flip-risk GATE is unchanged, but two things
 * about the V7 chip's SELECTION deliberately are not (both corrected here, both
 * defects in their own right):
 *   1. The chip used to take `challengeFragileEdges[0]` POSITIONALLY. That
 *      array is ordered by `marginal_switch_probability`, while the chip
 *      RENDERS `switch_probability` — so it printed a number that had not
 *      determined its own rank. Ranking now uses the metric that is displayed.
 *   2. The chip applied NO visibility floor. It now shares the UI-SEM-013
 *      floor every other fragile-edge surface uses.
 * KNOWN DELTA from (2): a legacy payload whose every fragile edge sits at or
 * below 0.15 now renders NO chip where it previously rendered one. That is
 * intended — a sub-threshold edge is exactly what the floor exists to silence,
 * and the witnessed "15%" chip (0.1485) was itself below it — but it IS a
 * behaviour change on payloads carrying no flip thresholds, not a no-op.
 *
 * ⚠ CORRECTED 2026-08-02 (ROADMAP 2.280) — THE PARAGRAPH THAT WAS HERE IS NOW
 * HALF FALSE, AND ITS SECOND HALF WAS LOAD-BEARING. It read:
 *
 *   "Gating on `flip_value == null` and NOT on `flip_reason`: the UI's
 *    `FlipReason` union (`'no_bracket' | 'timeout' | 'isl_error'`) does not
 *    contain ANY of the values the live producer actually sends
 *    (`structurally_invariant`, `no_effect_within_bounds`, `found`), so a
 *    reason-string test would be a contract-skew trap."
 *
 * The DIAGNOSIS was exactly right and is why 2.280 exists — that union was
 * fiction (`no_bracket`: zero occurrences in the producer; `isl_error`: a
 * transport field, never a flip reason). But the CONCLUSION drawn from it —
 * never read `flip_reason` — is what left this classifier unable to tell an
 * attested no-flip from a probe that never ran, and therefore reporting the
 * second as the first. The skew was a reason to FIX THE UNION, not to discard
 * the only field that carries the distinction.
 *
 * So, precisely:
 *   · WHETHER A FLIP EXISTS is still keyed on `flip_value`, exactly as before.
 *     `flip_reason` is never consulted to claim a flip.
 *   · WHETHER AN ABSENCE MAY BE ASSERTED is keyed on `flip_reason`, through
 *     `flipReasonVocabulary`'s allow-list, because `flip_value: null` alone
 *     genuinely does not distinguish the two cases.
 * The union is now derived from the producer and left OPEN, and every
 * predicate is written so an unrecognised token fails toward "we do not know".
 */

import { THRESHOLDS } from '../../../lib/mappers/constants'
import { isAttestedNoFlipReason } from './flipReasonVocabulary'

/** What the producer's flip evidence says about this run. */
export type FlipEvidence = 'no_producer_flip_data' | 'flips_absent' | 'flips_present'

/**
 * A candidate the calling surface could name, expressed in the caller's own
 * terms. `switchProbability` is the number the surface DISPLAYS — selection
 * and display must use one metric or the chip prints a value that did not
 * determine its own rank (the witnessed "15%" bug: the row was ranked by
 * `marginal_switch_probability` = 0.33 and then rendered
 * `switch_probability` = 0.1485).
 */
export interface FlipRiskCandidate {
  label: string
  switchProbability?: number | null
  /** Canvas focus target, when the surface can focus one. */
  targetId?: string | null
  /** Producer factor / node id, joined to `flip_thresholds[].node_id`. */
  joinId?: string | null
}

export interface FlipRiskSelection {
  evidence: FlipEvidence
  /**
   * False ONLY on `flips_absent`. Surfaces must render no flip-risk chip, no
   * named factor and no percentage while this is false.
   */
  mayNameFlipRisk: boolean
  /** The one factor that may be named, or null. Never fabricated. */
  topFlipRisk: { label: string; switchProbability: number; targetId?: string } | null
}

/** Minimal shape read off a mapped flip threshold. */
export interface FlipThresholdLike {
  node_id?: string | null
  flip_value?: number | null
  /**
   * ROADMAP 2.280. Read ONLY to tell an attested no-flip apart from a probe
   * that established nothing — never to decide that a flip exists (that stays
   * keyed on `flip_value`). Typed as a bare string because the producer's
   * vocabulary is open; `flipReasonVocabulary` does the classification.
   */
  flip_reason?: string | null
}

/**
 * Classify the producer's flip evidence for a run. Exported so surfaces that
 * only need the gate (and have no candidate list) cannot be tempted to
 * re-derive it.
 *
 * ⚠ DELIBERATELY derived from the ROWS, ignoring `flipThresholdsStatus`
 * (`'computed' | 'all_no_effect' | 'partial_no_effect' | 'unresolved' |
 * 'unavailable'`). That field is a producer SUMMARY of the same array and is
 * optional — older builds omit it entirely. Keying the gate on it would make
 * the status and the rows two independent answers to one question, which is
 * the two-choosers defect this module exists to end. Do not add a status-keyed
 * branch here or anywhere else: if the status and the rows ever disagree, the
 * rows are the evidence.
 */
export function classifyFlipEvidence(
  flipThresholds: readonly FlipThresholdLike[] | null | undefined,
): FlipEvidence {
  if (!Array.isArray(flipThresholds) || flipThresholds.length === 0) {
    return 'no_producer_flip_data'
  }
  if (flipThresholds.some((ft) => typeof ft?.flip_value === 'number')) {
    return 'flips_present'
  }
  // ROADMAP 2.280 — NO ROW CARRIES A FLIP VALUE. That is NOT yet enough to
  // state an absence.
  //
  // Until now this returned `flips_absent` here unconditionally, which asserts
  // that the producer PROVED nothing flips. But a null `flip_value` has two
  // completely different meanings: "the probe ran and found no flip"
  // (`no_effect_within_bounds`, `structurally_invariant`) and "the probe never
  // established anything" (`timeout`, `candidate_cap_exceeded`,
  // `insufficient_precision`, `heuristic`, `unattested`, … and every token this
  // build has never seen). Collapsing the second into the first turns an
  // unmeasured factor into an attested safety claim — the precise inversion
  // this module's own header forbids ("absence of evidence is NOT evidence of
  // absence").
  //
  // ⚠ THE READ IS STILL OFF THE ROWS, not off `flipThresholdsStatus` — the
  // two-choosers rule in this file's header is intact. `flip_reason` is a
  // per-row field of the same rows, not a producer summary of them.
  //
  // EVERY row must attest. `isAttestedNoFlipReason` is an allow-list of the two
  // substantive no-flip tokens, so an unknown token, a missing reason or a
  // probe failure all fail it and the run degrades to `no_producer_flip_data`
  // — the arm that keeps the gate OPEN. Fail toward "we do not know".
  const everyRowAttestsNoFlip = flipThresholds.every((ft) =>
    isAttestedNoFlipReason(ft?.flip_reason),
  )
  return everyRowAttestsNoFlip ? 'flips_absent' : 'no_producer_flip_data'
}

export function selectFlipRisk(
  flipThresholds: readonly FlipThresholdLike[] | null | undefined,
  candidates: readonly FlipRiskCandidate[] | null | undefined,
): FlipRiskSelection {
  const evidence = classifyFlipEvidence(flipThresholds)

  if (evidence === 'flips_absent') {
    return { evidence, mayNameFlipRisk: false, topFlipRisk: null }
  }

  // Ids the producer says actually flip. Only consulted on `flips_present`.
  const flippingIds = new Set<string>()
  if (evidence === 'flips_present') {
    for (const ft of flipThresholds ?? []) {
      if (typeof ft?.flip_value === 'number' && ft.node_id) flippingIds.add(ft.node_id)
    }
  }

  const eligible = (candidates ?? []).filter((c) => {
    if (!c?.label) return false
    if (typeof c.switchProbability !== 'number' || !Number.isFinite(c.switchProbability)) {
      return false
    }
    // UI-SEM-013 visibility floor — the canonical constant every fragile-edge
    // surface shares; a local literal would silently desync.
    if (c.switchProbability <= THRESHOLDS.FRAGILE_EDGE_FILTER) return false
    if (evidence !== 'flips_present') return true
    // Attribution: only a factor the producer says flips may be named. A
    // candidate with no join id cannot be shown to flip, so it is not named.
    return Boolean(c.joinId && flippingIds.has(c.joinId))
  })

  if (eligible.length === 0) {
    return { evidence, mayNameFlipRisk: true, topFlipRisk: null }
  }

  const top = eligible.reduce((best, c) =>
    (c.switchProbability as number) > (best.switchProbability as number) ? c : best,
  )

  return {
    evidence,
    mayNameFlipRisk: true,
    topFlipRisk: {
      label: top.label,
      switchProbability: top.switchProbability as number,
      ...(top.targetId ? { targetId: top.targetId } : {}),
    },
  }
}
