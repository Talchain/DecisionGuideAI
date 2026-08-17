/**
 * applyScenarioAnalysisRead — the NARROW applier for a scenario-graph READ's
 * analysis payload. ROADMAP 2.1271, hazard H4.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ WHY THIS EXISTS INSTEAD OF `applyV5State`, AND IT IS NOT A STYLE CHOICE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `applyV5State` is the TURN applier and its `analysis_state` rule is
 * CLEAR-ON-ABSENCE, deliberately and correctly (`v5/applyV5State.ts:1113-1120`):
 * *"the field's whole contract is 'CEE stated this FOR THIS TURN', so silence
 * must clear or the authority claim becomes a lie about which turn spoke."*
 *
 * That rule is right about turns and WRONG about reads, because the two
 * authorities answer DIFFERENT QUESTIONS (CLAUDE.md trap 21):
 *
 *   the DRAFT TURN answers   "did I start a provisional run?"   → can say `running`
 *   a GRAPH READ answers     "has a fact landed for this graph?" → cannot
 *
 * CEE keeps NO in-flight marker anywhere, so while the auto-run is in flight the
 * only answer a read can give is that no fact has landed — `never_run`. Feeding
 * that through the turn applier would therefore flip the product from *"an
 * analysis is running"* to *"no analysis has ever been run"* WHILE ONE IS
 * RUNNING, and `never_run`'s contract text licenses the consumer to render the
 * pre-analysis affordance over it. That is a worse lie than the one this whole
 * slice exists to fix, and under the turn applier it is the DEFAULT behaviour on
 * the very first poll, not an edge case.
 *
 * So: this applier writes a read's verdict ONLY when that verdict is TERMINAL —
 * when it reports an outcome a fact read is actually entitled to report. Every
 * non-terminal answer, and an absent one, is *"not yet"* and performs NO STORE
 * WRITE AT ALL.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TERMINAL SET, DERIVED FROM THE CONTRACT'S OWN TEXT, NOT FROM CONVENIENCE
 * ═══════════════════════════════════════════════════════════════════════════
 * Read at the vendored bytes (`@talchain/schemas` 0.46.0,
 * `dist/boundary/analysis-state.js`), one line of reasoning per kind:
 *
 *   `complete_current`  a fact landed and is current — THE answer being waited
 *                       for. Apply, settle.
 *   `complete_stale`    a fact landed; the graph moved since. Still an outcome a
 *                       read can prove. Apply, settle. (CEE ships no result
 *                       block on this verdict — those numbers describe a graph
 *                       the user has since changed.)
 *   `blocked`           "THE MODEL IS NOT ANALYSABLE as it stands … no run was
 *                       attempted". A statement about the model, provable from
 *                       the read. Apply, settle.
 *   `refused`           the analysis was declined. Provable, terminal. Apply,
 *                       settle.
 *   ─────────────────── the line ──────────────────────────────────────────────
 *   `never_run`         INDISTINGUISHABLE from "in flight" on this leg. Never
 *                       apply. Never settle.
 *   `unknown_degraded`  "the producer cannot state a run state at all" — the
 *                       store was unreadable, or the fact is unclassifiable.
 *                       That is not an outcome; it is the absence of one. Never
 *                       apply, never settle.
 *   `running`           a read CANNOT produce this today (CEE has no in-flight
 *                       marker). Listed as non-terminal rather than omitted so
 *                       that if a future CEE gains the marker (the H4b upgrade)
 *                       this applier keeps a standing `running` rather than
 *                       re-writing it, and the polling loop keeps looking.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT WRITES THE RESULTS BEFORE IT WRITES THE VERDICT.
 * ═══════════════════════════════════════════════════════════════════════════
 * `analysisStateSelector` composes its display semantic from the verdict AND
 * from `hasReport` (`results.report != null`). A verdict-first order would
 * expose a frame in which `complete_current` vouches for a result not yet on
 * screen, which `deriveAnalysisDisplayState` reads as `ready_to_analyse` —
 * "Ready to analyse" over a completed analysis. Cheap to get right, so it is
 * got right, and pinned by a test that asserts the call order.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT DOES NOT TOUCH THE GRAPH.
 * ═══════════════════════════════════════════════════════════════════════════
 * `canvas/hydrate/serverGraphHydration.ts` is the ONE graph-ingestion authority
 * and it stays so — *"A second ingestion path here would be the
 * two-`generateGraphHash`-twins defect all over again"* (`draftRecovery.ts:13-19`).
 * This applier reads only the two analysis keys and never the `graph` member.
 */

import type { AnalysisResultBlock, AnalysisStateV1 } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../../v5/mapV5AnalysisToReport'

/**
 * The kinds a FACT READ is entitled to report as an outcome. Exported so the
 * polling hook and the tests read the SAME set — one definition, three read
 * points, no mirror to drift (trap 12).
 */
export const READ_TERMINAL_RUN_STATE_KINDS = [
  'complete_current',
  'complete_stale',
  'blocked',
  'refused',
] as const

export type ReadTerminalRunStateKind = (typeof READ_TERMINAL_RUN_STATE_KINDS)[number]

export function isReadTerminalRunState(kind: string): kind is ReadTerminalRunStateKind {
  return (READ_TERMINAL_RUN_STATE_KINDS as readonly string[]).includes(kind)
}

/**
 * The store surface this applier is allowed to touch. Deliberately the minimum:
 * a wider type would let a later edit reach the graph slices, which belong to
 * `serverGraphHydration`.
 */
export interface ScenarioAnalysisApplyStore {
  readonly setAnalysisStateV1?: (verdict: AnalysisStateV1 | null) => void
  readonly resultsComplete?: (params: {
    report: ReturnType<typeof mapV5AnalysisToReport>
    hash: string
    resultsSource?: 'direct' | 'conversation'
    enrichment?: null
    rawV2Response?: null
    v5Enrichment?: unknown
  }) => void
  readonly currentResultsHash?: string | null
}

export type ScenarioAnalysisApplyOutcome =
  /** A terminal verdict was applied. The caller must stop polling. */
  | { readonly outcome: 'applied'; readonly kind: ReadTerminalRunStateKind; readonly resultsHydrated: boolean }
  /** Nothing was written. The caller may keep waiting (within its own bound). */
  | { readonly outcome: 'notYet'; readonly reason: 'no_verdict' | 'non_terminal_kind' }
  /** A terminal verdict whose result we already hold. Stop polling; no rewrite. */
  | { readonly outcome: 'alreadyHeld'; readonly kind: ReadTerminalRunStateKind }

export interface ApplyScenarioAnalysisReadInput {
  readonly analysisState: AnalysisStateV1 | null
  readonly analysisResult: unknown
  readonly store: ScenarioAnalysisApplyStore
}

/**
 * Apply a read's analysis payload, or decline to. Pure with respect to
 * everything except the two store actions it may call; never throws.
 */
export function applyScenarioAnalysisRead(
  input: ApplyScenarioAnalysisReadInput,
): ScenarioAnalysisApplyOutcome {
  const verdict = input.analysisState
  // ⚠ ABSENCE IS NOT A STATE. An older CEE, a graphless scenario and a verdict
  // that failed the contract's own validation all arrive here as `null`, and in
  // every one of those cases we know strictly less than we did a moment ago.
  // Writing anything — including `null` — would replace a truthful standing
  // belief with a less-true one (P3).
  // `== null` deliberately, not `=== null`: the TYPE says the field is always
  // present, and it is on every parsed result — but this applier is also called
  // from tests and could one day be called from untyped code, and reading
  // `undefined.run_state` would throw inside a delivery path whose entire
  // contract is that it never costs the user anything. One seam past the guard.
  if (verdict == null) return { outcome: 'notYet', reason: 'no_verdict' }

  const kind = verdict.run_state.kind
  if (!isReadTerminalRunState(kind)) {
    // THE H4 GUARD. `never_run` lands here, and this early return is the
    // difference between the capability and a regression.
    return { outcome: 'notYet', reason: 'non_terminal_kind' }
  }

  // ── Results FIRST (see the header) ────────────────────────────────────────
  let resultsHydrated = false
  const block = input.analysisResult
  if (block !== null && block !== undefined && typeof input.store.resultsComplete === 'function') {
    const report = mapV5AnalysisToReport(block as AnalysisResultBlock)
    const hash = report.model_card.response_hash
    // The SAME hash dedupe the turn applier uses: a re-read of an analysis we
    // already display must not re-write the slice (it would restart animations
    // and re-seed the Compare capture). `alreadyHeld` still SETTLES the caller —
    // the answer arrived, we simply had it.
    if (hash === (input.store.currentResultsHash ?? null)) {
      return { outcome: 'alreadyHeld', kind }
    }
    input.store.resultsComplete({
      report,
      hash,
      resultsSource: 'conversation',
      // V5 carries no V2 envelope; pass null so the V2-shaped slots are
      // explicitly cleared rather than left to a stale prior write — the same
      // reasoning as `applyV5State`'s results hydration.
      enrichment: null,
      rawV2Response: null,
      v5Enrichment: (block as { enrichment?: unknown }).enrichment ?? null,
    })
    resultsHydrated = true
  }

  input.store.setAnalysisStateV1?.(verdict)
  return { outcome: 'applied', kind, resultsHydrated }
}
