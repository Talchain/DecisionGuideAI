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

/** `freshnessReason` for a verdict restored by this leg — says where it came from. */
export const BOOT_READ_RUN_CURRENT = 'boot_read_run_current'

/** Every reason this leg declines, as a runtime value so completeness is checkable. */
export const BOOT_RUN_CURRENCY_DECLINE_REASONS = [
  /** The read carried no valid verdict. */
  'no_verdict',
  /** CEE did not say `complete_current` — other kinds keep their own leg. */
  'not_current',
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
  readonly graphHash: string | null
  readonly canvasProvenEqualToRead: boolean
  readonly store: BootRunCurrencyStore
}): BootRunCurrencyOutcome {
  const verdict = input.analysisState
  if (verdict == null) return declined('no_verdict')
  const runState = verdict.run_state
  if (runState.kind !== 'complete_current') return declined('not_current')
  const computedAt = 'computed_at' in runState ? runState.computed_at : undefined
  if (typeof computedAt !== 'string' || computedAt.trim() === '') return declined('no_computed_at')
  const graphHash = input.graphHash
  if (typeof graphHash !== 'string' || graphHash.length === 0) return declined('no_graph_hash')
  if (!input.canvasProvenEqualToRead) return declined('canvas_not_proven_equal')
  if (input.store.analysisFreshnessDirty === true) return declined('edited_since_read')
  // The mirror of `applyBootAnalysisVerdict`'s gate guard, through the SAME
  // imported predicate: a restored verdict must never close the run gate.
  if (readinessObjectsToRun(null, selectAnalysisReadinessAuthority(verdict))) {
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
  readonly store: { readonly analysisFreshnessDirty?: boolean; readonly setAnalysisStateV1?: (verdict: AnalysisStateV1 | null) => void }
}): BootBlockedVerdictOutcome {
  const verdict = input.analysisState
  if (verdict == null) return { outcome: 'declined', reason: 'no_verdict' }
  if (!input.isRestorableKind(verdict.run_state.kind)) return { outcome: 'declined', reason: 'not_restorable' }
  if (!readinessObjectsToRun(null, selectAnalysisReadinessAuthority(verdict))) {
    return { outcome: 'declined', reason: 'does_not_close_gate' }
  }
  if (typeof input.graphHash !== 'string' || input.graphHash.length === 0) return { outcome: 'declined', reason: 'no_graph_hash' }
  if (!input.canvasProvenEqualToRead) return { outcome: 'declined', reason: 'canvas_not_proven_equal' }
  if (input.store.analysisFreshnessDirty === true) return { outcome: 'declined', reason: 'edited_since_read' }
  input.store.setAnalysisStateV1?.(verdict)
  return { outcome: 'restored' }
}
