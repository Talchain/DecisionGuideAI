/**
 * THE RUN-OVER-RUN CONSEQUENCE, AS THE UI HOLDS IT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE BLOCK IS NOT STORED BARE.
 * ═══════════════════════════════════════════════════════════════════════════
 * `run_delta` describes ONE PAIR OF RUNS. On its own it carries nothing that
 * says WHICH analysis it is about — `pair_provenance` reports equality, never
 * identity — so a bare block in the store is a claim with no subject, and a
 * consumer reading it can only ask "is it there?", which is the wrong question.
 *
 * PRESENCE IS NOT SUFFICIENT. Four ways a stale delta would otherwise outlive
 * the thing it describes, each of which fails SILENTLY:
 *
 *   1. the user switches scenario            → a delta about another model
 *   2. a later analysis arrives with NO delta → the old one describes a
 *                                               superseded run and would sit
 *                                               under fresh numbers
 *   3. CEE withdraws the run-identity permission (it strips the block on
 *      `WITHHELD_RUN_IDENTITY_UNCONFIRMED` / `_CONFLICT`) → same as 2
 *   4. an out-of-order turn                   → a delta about a run the user
 *                                               is no longer looking at
 *
 * So the block is stored WITH the identity of the analysis it came in beside,
 * and read back only while that analysis is still the one on screen.
 *
 * ⭐ THE IDENTITY IS BORROWED, NOT MINTED. `analysisHash` is the SAME
 * `report.model_card.response_hash` that `resultsComplete` records as
 * `currentResultsHash` — the store's existing answer to "which analysis is
 * displayed". A second notion of run identity here would be two authorities
 * answering one question (CLAUDE.md trap 21), and the one that drifted would
 * be this one, because nothing else would read it.
 *
 * Cases 2 and 3 are ATTEMPTED by the write side and finished here. The writer
 * evicts when a genuinely new analysis lands carrying no delta — but eviction
 * is gated on the analysis CONTENT hash moving, and a content hash is not a run
 * identity, so it cannot catch a new run whose content collides with the
 * displayed one.
 *
 * ⭐ WHICH IS WHY THIS PREDICATE IS THE LOAD-BEARING GUARD, not a second line of
 * defence. It fails closed on every absence, and it is what makes a superseded
 * delta invisible in the cases the writer cannot see.
 */

import type { RunDelta } from '@talchain/schemas/boundary'

/** A `run_delta` plus the identity of the analysis it arrived beside. */
export interface StoredRunDelta {
  readonly delta: RunDelta
  /**
   * `report.model_card.response_hash` of the analysis this delta describes —
   * the value the store also holds as `currentResultsHash`.
   */
  readonly analysisHash: string
  /**
   * The scenario open when it was accepted. `null` is a real state (no
   * scenario id in scope) and is NOT a wildcard: it matches only `null`.
   */
  readonly scenarioId: string | null
}

/**
 * Is this stored delta about the analysis currently on screen, in the scenario
 * currently open?
 *
 * ⚠ FAIL-CLOSED ON EVERY ABSENCE. A missing stored delta, a missing displayed
 * hash, or a mismatch on either axis all read FALSE. The alternative — treating
 * an unknown displayed hash as "probably still the same run" — is the exact
 * shape of defect this module exists to prevent: it would render a real,
 * producer-computed comparison under numbers it was never about, and nothing
 * would go red.
 */
export function runDeltaDescribesDisplayedAnalysis(
  stored: StoredRunDelta | null | undefined,
  displayedAnalysisHash: string | null | undefined,
  currentScenarioId: string | null | undefined,
): boolean {
  if (!stored) return false
  if (typeof displayedAnalysisHash !== 'string' || displayedAnalysisHash.length === 0) return false
  if (stored.analysisHash !== displayedAnalysisHash) return false
  // `undefined` (no scenario concept in this host) and `null` (a scenario id
  // genuinely absent) are normalised together, so a host without the concept
  // behaves as it did before this slice existed.
  return stored.scenarioId === (currentScenarioId ?? null)
}
