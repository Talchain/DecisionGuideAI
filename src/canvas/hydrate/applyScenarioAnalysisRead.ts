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
import { selectAnalysisReadinessAuthority } from '../state/analysisStateSelector'
import { readinessObjectsToRun } from '../utils/canRunAnalysis'

/**
 * The kinds a FACT READ is entitled to report as an outcome. Exported so the
 * polling hook and the tests read the SAME set — one definition, three read
 * points, no mirror to drift (trap 12).
 *
 * ⚠ THIS LIST CANNOT BE DERIVED, AND THAT IS THE POINT. Which kinds a read may
 * treat as terminal is a JUDGEMENT about what a fact read can prove (the
 * per-kind reasoning is in this file's header) — there is no field in the
 * contract that states it, so no derivation can produce it. What that judgement
 * DOES owe is that it has been made for every kind the contract admits.
 *
 * A derived guard proves agreement and can never prove completeness (trap 12d).
 * So the completeness check lives beside its twin below and is asserted against
 * the contract's OWN exported vocabulary (`ANALYSIS_RUN_STATE_KINDS`) in
 * `__tests__/applyScenarioAnalysisRead.contractPartition.spec.ts`: the two sets
 * must PARTITION it exactly. A contract that gains a kind therefore REDs that
 * spec instead of falling silently into the non-terminal default here — which
 * is the safe direction, but a silent one, and silence is how a new state stops
 * being noticed.
 */
export const READ_TERMINAL_RUN_STATE_KINDS = [
  'complete_current',
  'complete_stale',
  'blocked',
  'refused',
] as const

/**
 * The twin: kinds this applier has CONSCIOUSLY declined to treat as terminal.
 *
 * It is not used for control flow — `isReadTerminalRunState` is the only
 * predicate — and it exists solely so "we have classified every kind" is a
 * checkable claim rather than an assumption. Listing them here, next to the
 * terminal set, is what lets the partition spec notice a kind that belongs to
 * neither.
 */
export const READ_NON_TERMINAL_RUN_STATE_KINDS = [
  'never_run',
  'running',
  'unknown_degraded',
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
      // ⚠ 'conversation' IS CORRECT HERE, and it was queried in review — so the
      // reasoning is pinned rather than left to be re-litigated.
      //
      // The objection is that these results arrived on a READ leg, not a
      // conversation turn. That is true of the TRANSPORT and irrelevant to this
      // field, because the two answer different questions (trap 21):
      //
      //   `resultsSource` asks   "what CAUSED this analysis to exist?"
      //   the read leg answers   "how did it REACH the client?"
      //
      // The store's own declaration scopes it to cause — "'direct' (Play
      // button) or 'conversation' (envelope path)" (`canvas/store.ts:901`) —
      // and its only consumer renders "Updated from conversation"
      // (`OutputsDock.tsx:3114`) to explain results the user did not ask for by
      // pressing Run. This run was scheduled BY the draft turn. So:
      //   · 'conversation' → true, and the user gets the explanation.
      //   · 'direct'       → a lie (claims the Play button) AND suppresses the
      //                      indicator, so results would appear unannounced.
      // A third value would need a product decision about that indicator's copy
      // and is out of this lane's scope; it is not needed for honesty.
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

// ═══════════════════════════════════════════════════════════════════════════
// THE BOOT LEG — A3 link 6. A STRICTLY NARROWER SET THAN THE POLLING LEG'S.
// ═══════════════════════════════════════════════════════════════════════════
//
// `hydrateCanvasFromServer` reads the scenario graph at boot, and that response
// CARRIES CEE'S COMPOSED VERDICT — parsed at `adapters/cee/scenarioGraph.ts:296`
// and, until now, dropped. The only consumer was the polling hook above, which
// arms solely on a standing `running` verdict that `store.ts:6043` has just
// nulled. So on every ordinary reload the verdict was fetched, validated and
// thrown away.
//
// ⚠⚠ WHY THIS IS NOT SIMPLY `applyScenarioAnalysisRead` CALLED AT BOOT.
// The two legs answer questions that differ in ONE decisive respect (trap 21):
//
//   the POLLING leg asks  "has the run I just watched start finished?"
//                         → the canvas has not moved since that run was armed
//   the BOOT leg asks     "what did CEE last say about a graph I am
//                          simultaneously MERGING INTO THE CANVAS?"
//
// `AnalysisStateV1` carries NO graph hashes — derived at the vendored 0.48.0
// bytes: `run_state.kind` IS the currency statement and there is no
// `graph_hash_at_run`/`current_graph_hash` pair on it anywhere. The verdict is
// CEE's statement about CEE'S OWN persisted graph, and at boot the canvas is a
// MERGE of that graph onto the local one — local-only nodes survive, and the
// client cannot prove the two are equal. It has no access to CEE's hash
// function, and claiming otherwise is the two-hash-functions trap that
// `store/analysisFreshness.ts:441-445` already refuses on the sibling path.
//
// ⚠⚠ AND THE HARM IS ASYMMETRIC, WHICH IS WHAT MAKES THE NARROWING NECESSARY
// RATHER THAN MERELY CAUTIOUS. `canvas/state/analysisStateSelector.ts` is
// FEATURE-DETECTED on this field: a non-null verdict takes the WIRE branch,
// where `semantic` comes from `mapRunStateKindToSemantic(kind, hasReport)` and
// THE LOCAL DIRTY OVERLAY IS NOT CONSULTED (`analysisStateSelector.ts:551-554`).
//
// So restoring `complete_current` at boot would yield `semantic: 'current'`,
// `wireForcesStale: false`, `analysisChanged: false` — a green "Analysis
// complete" rendered OVER A CANVAS #837 HAS JUST MARKED STALE. The naive
// restore does not rescue #837; it SILENCES it. That is the same defect this
// slice exists to fix, running backwards.
//
// ⚠⚠ THE RULE WAS FIRST WRITTEN AS "MAY ONLY EVER WITHHOLD CURRENCY, NEVER
// ASSERT IT", AND THAT UNIVERSAL WAS FALSE — refuted by independent review.
// It is true of `complete_stale`. It was NOT true of `blocked` / `refused`,
// which withhold currency and ASSERT SOMETHING ELSE: that the model is not
// analysable. See BOOT_RESTORABLE_RUN_STATE_KINDS for the measured chain by
// which that assertion replaced the freshness notice with a refusal banner.
//
// THE CORRECTED RULE, and it is narrower AND stronger: this leg restores only a
// verdict that CANNOT BE FALSIFIED BY THE BOOT MERGE. The decline is a NO-OP —
// never a write of `null`, which would itself be a claim (this file's own
// "absence is not a state" rule).

/**
 * The ONE kind a BOOT read may restore.
 *
 * ⭐ THE TEST IS MONOTONICITY, NOT "DOES IT WITHHOLD CURRENCY". Restore a
 * verdict only if NOTHING THE BOOT MERGE DOES CAN FALSIFY IT.
 *
 *   `complete_stale`  SAFE, and provably so. Staleness is MONOTONE: a stale
 *                     result cannot become current without a new run, and a new
 *                     run produces a new verdict. So no merge, and no local
 *                     edit, can make this claim false in the interval between
 *                     CEE composing it and the client reading it. It also
 *                     carries CEE's `cause` (e.g. `graph_changed`) — a REASON
 *                     the local derivation cannot produce at all.
 *
 * ⚠⚠ `blocked` AND `refused` WERE HERE AND WERE REMOVED — independent review,
 * and the removal costs the stated capability NOTHING (the whole
 * cannot-confirm → changed win is carried by `complete_stale`).
 *
 * They are NOT monotone: they assert the model is not ANALYSABLE, and the boot
 * merge can falsify exactly that by supplying the values CEE was refusing over.
 * Worse, the harm does not travel through `readiness` — where the run-gate guard
 * below looks — but through `run_state.kind`, measured hop by hop:
 *
 *   `analysisStateSelector.ts:632-633`   wireKind === 'blocked' forces
 *                                        `ceeAnalysisReadyStatus: 'blocked'`
 *                                        ⚠ REGARDLESS of `readiness.status`
 *   `deriveAnalysisDisplayState.ts:106`  EXPLICIT_NOT_READY_STATUSES is every
 *                                        status except `ready`, and `:79-81`
 *                                        says those "MUST override a prior
 *                                        populated report"
 *
 * So a CONTRACT-VALID `blocked` verdict with a perfectly READY readiness sailed
 * past the run-gate guard, restored, and turned the freshness notice into a
 * not-ready/refusal banner over a model that HAS a report — strictly LESS
 * information than no verdict at all, on the one surface this slice exists to
 * improve. Pinned in `__tests__/bootVerdictNoDisplayRegression.spec.ts` against
 * the CONSUMER, not against this guard.
 *
 * ⚠ THIS LIST CANNOT BE DERIVED: which kinds survive the boot merge is a
 * JUDGEMENT no contract field states. What the judgement owes is that it has
 * been made for every kind — asserted against the contract's own exported
 * `ANALYSIS_RUN_STATE_KINDS` in
 * `__tests__/bootAnalysisVerdict.contractPartition.spec.ts` (trap 12d).
 */
export const BOOT_RESTORABLE_RUN_STATE_KINDS = ['complete_stale'] as const

/**
 * The twin: kinds a BOOT read must NOT restore, and why each is declined.
 *
 *   `complete_current`   Asserts CURRENCY the client cannot verify, and on the
 *                        wire branch that assertion SILENCES #837's stale mark
 *                        outright. Declined though terminal and though CEE
 *                        means it.
 *   `blocked`            Asserts the model is NOT ANALYSABLE — which the boot
 *                        merge can falsify by supplying the missing values. And
 *                        it reaches the display through `run_state.kind`, not
 *                        through `readiness`, so the run-gate guard cannot see
 *                        it. See the restorable set above for the measured chain.
 *   `refused`            Same shape: a previous session's refusal to analyse,
 *                        asserted as current, over a model that may now be fine.
 *   `never_run`          Indistinguishable from in-flight on a read leg (H4).
 *   `running`            A read cannot produce it today; if a future CEE gains
 *                        an in-flight marker, a boot is not the leg that should
 *                        adopt it — the polling hook is.
 *   `unknown_degraded`   The absence of an outcome, not an outcome.
 *
 * Not used for control flow — `isBootRestorableRunState` is the only predicate.
 * It exists so "we have classified every kind" is checkable rather than assumed.
 */
export const BOOT_DECLINED_RUN_STATE_KINDS = [
  'complete_current',
  'blocked',
  'refused',
  'never_run',
  'running',
  'unknown_degraded',
] as const

export type BootRestorableRunStateKind = (typeof BOOT_RESTORABLE_RUN_STATE_KINDS)[number]

export function isBootRestorableRunState(kind: string): kind is BootRestorableRunStateKind {
  return (BOOT_RESTORABLE_RUN_STATE_KINDS as readonly string[]).includes(kind)
}

/**
 * The store surface the boot leg may touch. DELIBERATELY ONE MEMBER, and
 * narrower than `ScenarioAnalysisApplyStore` by one more than it looks.
 *
 * The polling leg writes RESULTS as well as the verdict, because a run it was
 * watching has just produced them. A boot has no such warrant: results are
 * already restored from the localStorage autosave by
 * `store/restoreAnalysisFromAutosave.ts`, and adding a second writer for that
 * one fact is the two-restorers defect this estate keeps paying for. So the
 * boot leg restores the VERDICT ONLY and cannot reach `resultsComplete` at all
 * — enforced by the type, not by a comment.
 */
export interface BootAnalysisVerdictStore {
  readonly setAnalysisStateV1?: (verdict: AnalysisStateV1 | null) => void
}

export type BootAnalysisVerdictOutcome =
  /** A currency-withholding verdict was restored. */
  | { readonly outcome: 'restored'; readonly kind: BootRestorableRunStateKind }
  /**
   * Nothing was written — and NOTHING is the operative word: not `null`, which
   * would replace a standing belief with a claim of ignorance.
   *
   * `asserts_currency` is kept DISTINCT from `not_restorable` deliberately. It
   * is the one decline that turns away a verdict CEE genuinely stated and
   * genuinely means, so it must be visible as its own fact in telemetry and in
   * tests, rather than lumped in with the non-terminal kinds that say nothing.
   */
  | {
      readonly outcome: 'declined'
      readonly reason:
        | 'no_verdict'
        | 'asserts_currency'
        | 'not_restorable'
        | 'closes_run_gate'
    }

/**
 * Restore a BOOT read's verdict, or decline to. Pure with respect to everything
 * except the single store action it may call; never throws.
 */
export function applyBootAnalysisVerdict(input: {
  readonly analysisState: AnalysisStateV1 | null
  readonly store: BootAnalysisVerdictStore
}): BootAnalysisVerdictOutcome {
  const verdict = input.analysisState
  // Absence is not a state — an older CEE, a graphless scenario and a verdict
  // that failed the contract's validation all arrive here as `null`. `== null`
  // for the same one-seam-past-the-guard reason as the polling leg.
  if (verdict == null) return { outcome: 'declined', reason: 'no_verdict' }

  const kind = verdict.run_state.kind
  if (kind === 'complete_current') {
    // THE SAFETY DECLINE. Named separately from the fall-through below so that
    // a reader — and a mutant — can tell the two apart.
    return { outcome: 'declined', reason: 'asserts_currency' }
  }
  if (!isBootRestorableRunState(kind)) {
    return { outcome: 'declined', reason: 'not_restorable' }
  }

  // ── ⚠⚠ THE GATE GUARD, AND IT IS THE MIRROR OF THE `complete_current` ONE ──
  //
  // THE DEFECT IT CLOSES, and it was live in this function's first cut: every
  // rule above reasons about `run_state.kind`, and THE RUN GATE DOES NOT READ
  // `run_state` AT ALL. `selectAnalysisReadinessAuthority` (:809 of the
  // selector) reads `readiness.status` / `readiness.blockers` and hands them to
  // `readinessObjectsToRun`, which objects on
  // `status === 'blocked' || actionableBlockers(blockers).length > 0`.
  //
  // So `readiness` RIDES ALONG on every verdict this function restores, and
  // reaches the Analyse control on three mounted surfaces
  // (`usePreAnalysisModel.ts:257`, `OutputsDock.tsx:1130,1303`,
  // `ConversationPanel.tsx:560`). Measured before this guard existed:
  //
  //   verdict null (pre-restore)              -> false   Analyse ENABLED
  //   restored `blocked`  (readiness blocked) -> TRUE    Analyse DISABLED
  //   restored `refused`  (readiness blocked) -> TRUE    Analyse DISABLED
  //
  // A verdict from a PREVIOUS session could therefore disable Analyse on a
  // model that is analysable right now. That is a false block arriving by a
  // route the parallel `mayRun` fix does not cover: this objects through clause
  // (a) — `status: 'blocked'` with an EMPTY blocker list, the shape
  // `buildAnalysisRefusalReadiness` emits — while that work addresses clause
  // (b). Two fixes for one harm, each correct alone (trap 21).
  //
  // ⭐ WHY HERE AND NOT IN THE GATE. The gate is right to respect a stated
  // verdict; the mistake is restoring a claim we cannot verify. Fixing it at the
  // gate would teach the gate to distrust its own authority, and the seam has
  // one writer. So the decline lives on the RESTORE side.
  //
  // ⭐ SYMMETRY, which is the actual principle: `complete_current` is declined
  // because the client cannot verify a CURRENCY claim. A previous session's
  // REFUSAL is equally unverifiable, and worse in consequence — a false currency
  // claim misinforms, a false block REMOVES THE USER'S ACTION. Fail-closed has to
  // point both ways or it is just caution in one direction.
  //
  // ⚠ THE PREDICATE IS IMPORTED, NEVER MIRRORED. Re-deriving "would this object?"
  // here would be a second authority for one question, and it would diverge on
  // the next change to either. `null` is passed for the side-car because
  // `readinessObjectsToRun` ignores its first argument entirely once the
  // producer has spoken (`canRunAnalysis.ts:443`) — so this asks exactly the
  // question the gate will ask, and nothing else. A `null` authority (not
  // stated, or the UNSUPPLIED sentinel) yields `false`: an unstated readiness
  // cannot close the gate, and must not be read as if it had.
  if (readinessObjectsToRun(null, selectAnalysisReadinessAuthority(verdict))) {
    return { outcome: 'declined', reason: 'closes_run_gate' }
  }

  input.store.setAnalysisStateV1?.(verdict)
  return { outcome: 'restored', kind }
}
