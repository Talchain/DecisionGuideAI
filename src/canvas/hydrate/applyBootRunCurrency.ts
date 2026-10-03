/**
 * ⭐ FIX 2 — A RELOAD WITH NOTHING CHANGED KEEPS A CURRENT RUN CURRENT.
 *
 * THE DEFECT (served-witnessed, R&C #69 5831180703 row R5b, UI `5f8d9095` ·
 * CEE `4809203`): after a plain reload, with nothing edited, the Run card said
 * "Olumi can't confirm this still matches your latest analysis." The run-turn
 * rule (`v5/blocks/coachingCurrency.ts` `classifyRunTurn`) needs TWO producer
 * facts, and a reload restored neither:
 *   1. the verdict `run_state = complete_current` with its `computed_at` —
 *      `applyBootAnalysisVerdict` declines that kind (`asserts_currency`);
 *   2. `analysisFreshness.currentGraphHash` — its only feed was a turn's
 *      `analysis_ready`, which a scenario-graph read does not carry, so the
 *      slice held no hash after any reload.
 *
 * WHY THE DECLINE WAS RIGHT, AND WHAT CHANGES IT. `applyBootAnalysisVerdict`
 * declines `complete_current` because the client "cannot prove" its canvas
 * equals the graph CEE's verdict describes — at boot the canvas is a MERGE.
 * That reasoning stands for the verdict ALONE. This leg restores currency ONLY
 * when the proof exists, and it is the proof the acknowledgement already uses:
 *   · `canvasProvenEqualToRead` — the scenario is the one read, no edit is
 *     between the user and CEE (`editDeliveryHold`), no unregistered import, and
 *     EVERY analytical value the canvas would send is carried, deep-equal, by
 *     the read (`firstProjectedValueTheReadLacks`: same elements, same values).
 *     The `observed_state 0.7` case — a canvas key the read omits — fails it.
 *   · no local edit since the read (`analysisFreshnessDirty` false — the boot
 *     merge sets it on any model change).
 * Under that proof the canvas IS the graph CEE's verdict describes, so the
 * verdict is a true statement about what the user is looking at.
 *
 * NO PRODUCER STATE IS INVENTED. Both facts are CEE's, carried verbatim
 * (Canonical State, #69 5830227291, measured on served `c1ddb50`, 5/5):
 *   · C1  the read's `graph_hash` === the turn's `graph_hash` === the turn's
 *         `analysis_ready.current_graph_hash`, for the same stored bytes — so it
 *         is the SAME hash space the card's `graph_hash_at_generation` is in;
 *   · C2  the read's `run_state.computed_at` is the fact's string byte for
 *         byte, and a non-canonical one never yields `complete_current`.
 * `computed_at` is passed through UNTOUCHED — never parsed, never re-serialised.
 * `graph_hash_at_run` is set to the same hash because `complete_current` IS
 * CEE's statement that its latest run was on its current graph (C3).
 *
 * ⚠ AFTER A RESTORE, AN EDIT STILL WINS. The wire branch lets the local dirty
 * overlay supersede an affirmative `complete_current`
 * (`analysisStateSelector.localEditSupersedesWireCurrency.spec.tsx`), and the
 * card keeps its dirty-window borrow, so the restore cannot outlive a change.
 *
 * FAIL-CLOSED: every decline writes NOTHING (not `null`), leaving today's
 * behaviour exactly as it was, and says which rule declined.
 */
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { selectAnalysisReadinessAuthority } from '../state/analysisStateSelector'
import { readinessObjectsToRun } from '../utils/canRunAnalysis'
import type { V5AnalysisFactState } from '../store'
import { mapV5AnalysisToReport } from '../../v5/mapV5AnalysisToReport'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'
import { readLimitVerdicts, type LimitVerdictsWrite } from '../state/storedLimitVerdicts'

/** `freshnessReason` for a verdict restored by this leg — says where it came from. */
export const BOOT_READ_RUN_CURRENT = 'boot_read_run_current'

/** Every reason this leg declines, as a runtime value so completeness is checkable. */
export const BOOT_RUN_CURRENCY_DECLINE_REASONS = [
  /** The read carried no valid verdict. */
  'no_verdict',
  /** CEE did not say `complete_current` — other kinds keep their own leg. */
  'not_current',
  /** CEE says this selected analysis needs a rerun, even if an older Run shares the graph. */
  'rerun_required',
  /** A newer degraded Run supersedes the result block, even if CEE did not set requires_rerun. */
  'degraded_newer_run',
  /** No saved result block can confirm the Run whose currency would be restored. */
  'no_result',
  /** No usable `computed_at` — the card's third limb could never hold. */
  'no_computed_at',
  /** The read carried no `graph_hash` — nothing to bind the card to. */
  'no_graph_hash',
  /** The canvas is not proven equal to the graph the verdict describes. */
  'canvas_not_proven_equal',
  /** The model changed since the read (the boot merge or a local edit). */
  'edited_since_read',
  /** The verdict's readiness would close the run gate — never restored. */
  'closes_run_gate',
  /** The freshness slice kept a verdict newer than this one — the two would disagree. */
  'freshness_not_taken',
] as const

export type BootRunCurrencyDeclineReason = (typeof BOOT_RUN_CURRENCY_DECLINE_REASONS)[number]

export type BootRunCurrencyOutcome =
  | { readonly outcome: 'restored' }
  | { readonly outcome: 'declined'; readonly reason: BootRunCurrencyDeclineReason }

export interface BootRunCurrencyStore {
  readonly analysisFreshnessDirty?: boolean
  readonly setAnalysisStateV1?: (verdict: AnalysisStateV1 | null) => void
  readonly setAnalysisFreshness?: (rawAnalysisReady: unknown) => void
  /** Read AFTER the freshness write, so the verdict lands only if the hash did. */
  readonly readCurrentGraphHash: () => string | undefined | null
}

function declined(reason: BootRunCurrencyDeclineReason): BootRunCurrencyOutcome {
  return { outcome: 'declined', reason }
}

/**
 * Restore a boot read's `complete_current` verdict AND its graph hash together,
 * or neither. Pure except for the two store actions; never throws.
 */
export function applyBootRunCurrency(input: {
  readonly analysisState: AnalysisStateV1 | null
  readonly analysisResult: unknown
  readonly graphHash: string | null
  readonly canvasProvenEqualToRead: boolean
  /**
   * The read's `analysis_admission.admitted` (see `applyBootBlockedVerdict`). Only
   * `true` is passed on: a CURRENT run over blockers CEE waives does not close the
   * gate, so it is restored as current (row 3 N1, UI #2103 review 5845273636).
   */
  readonly admitted?: boolean | null
  readonly store: BootRunCurrencyStore
}): BootRunCurrencyOutcome {
  const verdict = input.analysisState
  if (verdict == null) return declined('no_verdict')
  const runState = verdict.run_state
  if (runState.kind !== 'complete_current') return declined('not_current')
  if (verdict.requires_rerun === true) return declined('rerun_required')
  if (verdict.contradictions?.includes('fact_status_success_but_degraded_newer')) return declined('degraded_newer_run')
  if (!hasBootReadRunResult(input.analysisResult)) return declined('no_result')
  const computedAt = 'computed_at' in runState ? runState.computed_at : undefined
  if (typeof computedAt !== 'string' || computedAt.trim() === '') return declined('no_computed_at')
  const graphHash = input.graphHash
  if (typeof graphHash !== 'string' || graphHash.length === 0) return declined('no_graph_hash')
  if (!input.canvasProvenEqualToRead) return declined('canvas_not_proven_equal')
  if (input.store.analysisFreshnessDirty === true) return declined('edited_since_read')
  // The mirror of `applyBootAnalysisVerdict`'s gate guard, through the SAME
  // imported predicate: a restored verdict must never close the run gate.
  if (readinessObjectsToRun(null, selectAnalysisReadinessAuthority(verdict), input.admitted === true ? true : undefined)) {
    return declined('closes_run_gate')
  }

  // The hash first, and the verdict only if the hash landed: the freshness
  // reducer ignores a strictly-older payload, and a restored `complete_current`
  // beside a hash from some other verdict would be two facts that disagree.
  input.store.setAnalysisFreshness?.({
    freshness: 'fresh',
    freshness_reason: BOOT_READ_RUN_CURRENT,
    graph_hash_at_run: graphHash,
    current_graph_hash: graphHash,
    computed_at: computedAt,
  })
  if (input.store.readCurrentGraphHash() !== graphHash) return declined('freshness_not_taken')
  input.store.setAnalysisStateV1?.(verdict)
  return { outcome: 'restored' }
}

/** The same saved-result proof the R6 fact restore requires below. */
function hasBootReadRunResult(block: unknown): block is AnalysisResultBlock {
  if (block == null || typeof block !== 'object' || Array.isArray(block)) return false
  const b = block as { type?: unknown; computed_against_hash?: unknown }
  return b.type === 'analysis_result'
    && typeof b.computed_against_hash === 'string'
    && b.computed_against_hash.trim() !== ''
}

/**
 * ⭐ R6 — THE RESTORED RESULT IS THE RUN THE VERDICT DESCRIBES, SO IT IS NOT AN ORPHAN.
 *
 * THE DEFECT (Paul, 28 Sep 12:39Z reload, export `olumi-debug-b1bffd43`; DL #72 5871346171 R6): the
 * read carried `run_state: complete_current`, `graph_hash 92f3b013…` and the `analysis_result` block
 * with `computed_against_hash 92f3b013…`, nothing was edited — and the hero read "Results may be
 * outdated". `analysisStateSelector` ORs `trust.orphaned` into `analysisChanged`, and a result is an
 * orphan whenever no scenario-bound `v5AnalysisFact` exists. That fact is SESSION-ONLY and never
 * restored (`store.ts`), so every reloaded result was dimmed whatever CEE said.
 *
 * THE PROOF, ALL OF IT ALREADY CEE'S, NONE INVENTED:
 *   · `applyBootRunCurrency` restored — `complete_current` + `computed_at` + `graph_hash`, the canvas
 *     proven equal to the read both ways, no edit since, the run gate open (its whole proof);
 *   · the read carries the `analysis_result` block, which CEE ships ONLY on a `complete_current`
 *     verdict for the current graph, stamped with a non-empty `computed_against_hash` (the run's
 *     canonical hash — never compared with the read's raw `graph_hash`; see the check below).
 * Only then is a fact written, bound to the scenario and to that block's report hash (the hash the
 * results slice holds for it, `applyScenarioAnalysisRead`). Returns `null` otherwise: nothing is
 * written, and the result stays a dimmed prior result with a rerun CTA, exactly as today.
 */
export function bootReadRunFact(input: {
  readonly scenarioId: string
  readonly analysisResult: unknown
  readonly now: number
}): V5AnalysisFactState | null {
  const block = input.analysisResult
  if (!hasBootReadRunResult(block)) return null
  // ⚠ NEVER COMPARED WITH THE READ'S `graph_hash` (Canonical #72 5872261884). The wire `graph_hash`
  // hashes the RAW persisted bytes (the CAS base); `computed_against_hash` is the run's
  // `graph_hash_at_run` over the CANONICAL projection (`scenario-graph-analysis-read.ts:239-252`).
  // They are equal on a canonical-shape graph and DIFFER on a repaired-shape graph that has not moved,
  // so a pair check would still dim Paul's current run there. The read ships this block ONLY on a
  // `complete_current` verdict for the current graph, stamped with that canonical hash: its presence,
  // non-empty, beside the restored verdict IS the proof.
  const analysisHash = mapV5AnalysisToReport(block).model_card.response_hash ?? null
  return {
    scenarioId: input.scenarioId,
    analysisHash,
    hasRunAnalysisFact: true,
    freshness: 'fresh',
    freshnessReason: BOOT_READ_RUN_CURRENT,
    rawBlocks: [],
    writtenAt: input.now,
  }
}

/**
 * ⭐ A RELOAD OF A BLOCKED MODEL KEEPS CEE'S NAMED REASON.
 *
 * THE DEFECT (served-witnessed on UI `c3c2d539` · CEE `6dd42eb`, AI
 * Conversation witness `bui-reads-c3c2d539-0358`): a model the canvas's
 * "+ Add option" left blocked showed a disabled Run control with a named
 * reason, and after a plain reload the same control said only "Olumi needs
 * something more from this model before the next analysis. Ask in the chat…".
 * The boot read carried `run_state: complete_stale` and `readiness: blocked`
 * with two plain-English blockers, but `applyBootAnalysisVerdict` declines any
 * verdict that closes the Run gate (`closes_run_gate`), because a verdict from a
 * PREVIOUS session could falsely disable Analyse.
 *
 * THIS LEG RESTORES IT ONLY WITH THE PROOF THAT FEAR IS ANSWERED BY, the same
 * proof the currency leg above uses: the canvas is proven equal to the read
 * both ways, no edit since the read, and the read names its revision. The read's
 * readiness is CEE's live verdict on the stored graph (revision-bound since CEE
 * #1936), so under that proof it describes the model on screen, and a
 * "blocked" from it is true, not stale.
 *
 * Only the kinds `applyBootAnalysisVerdict` already restores
 * (`isBootRestorableRunState`, i.e. `complete_stale`), and only a verdict that
 * DOES close the gate: every other verdict is that function's or the currency
 * leg's, so the three legs never write the same slice for one read.
 * FAIL-CLOSED: a decline writes nothing and says which rule declined.
 */
export const BOOT_BLOCKED_VERDICT_DECLINE_REASONS = [
  'no_verdict',
  'not_restorable',
  'does_not_close_gate',
  'no_graph_hash',
  'canvas_not_proven_equal',
  'edited_since_read',
] as const
export type BootBlockedVerdictDeclineReason = (typeof BOOT_BLOCKED_VERDICT_DECLINE_REASONS)[number]

export type BootBlockedVerdictOutcome =
  | { readonly outcome: 'restored' }
  | { readonly outcome: 'declined'; readonly reason: BootBlockedVerdictDeclineReason }

export function applyBootBlockedVerdict(input: {
  readonly analysisState: AnalysisStateV1 | null
  readonly graphHash: string | null
  readonly canvasProvenEqualToRead: boolean
  readonly isRestorableKind: (kind: string) => boolean
  /**
   * The read's `analysis_admission.admitted` (`null`: did not answer). `true`
   * WAIVES what the readiness lists by exclusion, exactly as the turn's bound
   * `may_run` does in-session, so such a verdict does not close the gate and is
   * not this leg's. Served 26 Sep (DL bf-20260926T054503Z turn 3; Canvas
   * #70 5843698855): without it a reload greyed Run on a revision CEE admitted.
   *
   * ⛔ ONLY `true` IS PASSED ON. `false` stays "as today": passed as `mayRun`,
   * it would make a stale READY verdict close the gate, so this leg would restore
   * it too and the stale leg's single write would become two (the served 6dd42eb
   * read carries `admitted: false`). A refusal already arrives as `blocked` or
   * as blockers, which close the gate without it.
   */
  readonly admitted?: boolean | null
  readonly store: { readonly analysisFreshnessDirty?: boolean; readonly setAnalysisStateV1?: (verdict: AnalysisStateV1 | null) => void }
}): BootBlockedVerdictOutcome {
  const verdict = input.analysisState
  if (verdict == null) return { outcome: 'declined', reason: 'no_verdict' }
  if (!input.isRestorableKind(verdict.run_state.kind)) return { outcome: 'declined', reason: 'not_restorable' }
  if (!readinessObjectsToRun(null, selectAnalysisReadinessAuthority(verdict), input.admitted === true ? true : undefined)) {
    return { outcome: 'declined', reason: 'does_not_close_gate' }
  }
  if (typeof input.graphHash !== 'string' || input.graphHash.length === 0) return { outcome: 'declined', reason: 'no_graph_hash' }
  if (!input.canvasProvenEqualToRead) return { outcome: 'declined', reason: 'canvas_not_proven_equal' }
  if (input.store.analysisFreshnessDirty === true) return { outcome: 'declined', reason: 'edited_since_read' }
  input.store.setAnalysisStateV1?.(verdict)
  return { outcome: 'restored' }
}

/**
 * ⭐ R6, THE LIMIT ROW — the read's per-limit and joint verdicts, kept across a reload.
 *
 * Served UI `662afcfd` (28 Sep 2026): after a user Re-run the Reasoning tab read "Monthly churn ≤ 5%. Checked only
 * against an assumed figure, not a measured one."; after a plain reload that row, and only that row, was gone. The
 * read carries `analysis_limit_verdicts`, but only the draft-time provisional poll stored them
 * (`applyScenarioAnalysisRead`); the boot path never did, and the store is session-only.
 *
 * ⚠ BOUND TO THE RESULT ON SCREEN, NOT TO THE READ'S BLOCK. The read ships a trimmed block (type, summary,
 * leading_option_id, computed_against_hash, enrichment) whose hash can never equal the displayed report's, so a
 * binding to it would never render. The binding is licensed by R6's own proof, and the caller runs this ONLY where
 * `bootReadRunFact` minted: the currency restored (complete_current, canvas proven equal both ways, no edit since)
 * and the block names the run. Absent or invalid verdicts store nothing — absence is not a verdict.
 */
export function bootReadLimitVerdicts(input: {
  readonly scenarioId: string
  readonly limitVerdicts: unknown
  readonly displayedResultsHash: string | null | undefined
}): LimitVerdictsWrite | null {
  if (typeof input.displayedResultsHash !== 'string' || input.displayedResultsHash === '') return null
  const verdicts = readLimitVerdicts(input.limitVerdicts)
  if (verdicts === null) return null
  return { verdicts, analysisHash: input.displayedResultsHash, scenarioId: input.scenarioId }
}
