/**
 * Selector hooks over the canvas store's `ceeAnalysisReady` slice.
 *
 * The slice is a nested object (`CEEAnalysisReady | null`) that carries the
 * full CEE payload. Surfaces that only need the readiness status or option
 * list use these narrow selectors instead of reaching into the object,
 * which keeps the single-source-of-truth (nested slice) intact and avoids
 * the write-race risk that would come with flat duplicate state.
 *
 * See docs/ui-v5-alpha-hardening-evidence.md — Phase 2.1 slice-naming
 * decision — for why the codebase uses nested state + selectors rather
 * than flat `analysis_status` / `analysis_ready_options` slices.
 */

import { useCanvasStore } from '../store'
import type { CEEOptionV3, AnalysisAdmissionV1 } from '../../adapters/cee/types'

/**
 * Returns the wire-format `analysis_ready.status` string, or `'missing'`
 * when the slice is null (no CEE response has landed yet, or it was
 * cleared by the explicit-unknown branch on an analyse turn). Use to
 * gate executable affordances like the "Run analysis" chip.
 */
export function useAnalysisStatus(): string {
  return useCanvasStore((s) => s.ceeAnalysisReady?.status ?? 'missing')
}

/** Readiness-gate helper: true only when the wire status is exactly `'ready'`. */
export function useIsAnalysisReady(): boolean {
  return useCanvasStore((s) => s.ceeAnalysisReady?.status === 'ready')
}

/**
 * CEE's own admission verdict for this turn (`analysis_ready.may_run`), or
 * `undefined` when the producer did not send one.
 *
 * `undefined` is load-bearing and must not be collapsed to `false`: it means a
 * pre-`may_run` CEE, and the consumer's job is then to fall back to whatever it
 * did before. See {@link admitsRunAffordance}.
 */
export function useAnalysisMayRun(): boolean | undefined {
  return useCanvasStore((s) => s.ceeAnalysisReady?.may_run)
}

/**
 * May a Run affordance be offered on this turn?
 *
 *     admitted = status === 'ready' || may_run === true
 *
 * ⭐ A DISJUNCTION, ON PURPOSE — THIS IS A WIDENING, NOT A REPLACEMENT.
 *
 * `status === 'ready'` is the historical gate and is left exactly as it was, so
 * every affordance that renders today still renders — including when CEE sends
 * no `may_run` at all, which makes the two services deploy-order independent.
 * The second term can only ever ADD, never remove.
 *
 * WHY THE SECOND TERM IS NEEDED. `status` answers *"is this model ready as it
 * stands?"*; `may_run` answers *"will the run proceed if asked?"* — which is
 * also true when the run proceeds by excluding the options the user left open.
 * That is the readiness loop's payoff turn: `needs_user_input` AND admissible.
 * Measured in CEE on the `live-4day-week` capture, ONE status value carries BOTH
 * admission verdicts, so no reading of `status` can recover the answer.
 *
 * WHY `=== true` AND NOT `!== false`. The route-level `may_run` is three-valued
 * (`true | false | 'unknown'`) because a caller can fail to REACH that route; on
 * the turn payload there is no such case, and ABSENCE already carries "producer
 * did not say". Strict `=== true` therefore means an unexpected or malformed
 * value can never widen the gate by accident.
 *
 * ⚠ It is deliberately NOT this function's job to decide that a run is a good
 * idea — only that CEE would accept it. `may_run` IS the predicate CEE's own run
 * path admits on, so a chip shown on it cannot lead to a refusal.
 */
export function admitsRunAffordance(
  analysisStatus: string,
  mayRun: boolean | undefined,
): boolean {
  return analysisStatus === 'ready' || mayRun === true
}

/**
 * CEE's admission of what may be CLAIMED from a run of this model.
 *
 * `undefined` is load-bearing and must NOT be collapsed to a refusal: it means a
 * pre-admission CEE, and the consumer's job is then to behave exactly as it did
 * before. That is what makes this consumer safe to land before the CEE half —
 * the two services can deploy in either order.
 *
 * Distinct from a refusal BY TYPE, not by a sentinel value:
 *   `undefined`                           -> the producer has not spoken
 *   `{ permitted_analysis_mode: 'none' }` -> the producer refused, and `reasons`
 *                                            is non-empty by contract
 * They cannot collapse: one is `undefined`, the other an object.
 */
export function useAnalysisAdmission(): AnalysisAdmissionV1 | undefined {
  return useCanvasStore((s) =>
    resolveEffectiveAdmission(s.ceeAnalysisReady?.analysis_admission, s.retainedAnalysisAdmission),
  )
}

/**
 * ⭐⭐ WHICH ABSENCE IS THIS? — the one question `analysis_admission`'s absence
 * used to answer two ways under one name.
 *
 * `licensesComparativeLeaderClaim(undefined)` is `true`, and that is RIGHT for
 * the absence it was written for: **the producer never spoke**. An older CEE
 * sends no admission, and reading that as a refusal would silently strip the
 * leader from every legacy payload. That arm is pinned by ARM A of
 * `useResultsSectionData.admissionGatesLeader.spec.ts` and is NOT changed here.
 *
 * It is WRONG for a second absence that reaches the same predicate: **we nulled
 * it ourselves**. `invalidateAnalysisReady` clears `ceeAnalysisReady` — the
 * admission's only carrier — on every analytical edit, so one keystroke turns a
 * recorded refusal into a licence. WITNESSED on staging 9eb30b54, 2026-09-10: a
 * `quantified_provisional` run showed "What this run may not conclude", and 59ms
 * after a single factor value was edited the same slot showed "Most likely to
 * serve your goal / Double Down on SMB".
 *
 * The two are told apart by a fact neither the predicate nor the payload carried:
 * HAS THIS DECISION'S PRODUCER EVER SPOKEN? `retainedAnalysisAdmission` holds
 * that, so:
 *
 *   live admission present        -> it wins, in either direction
 *   absent, nothing retained      -> `undefined`: no authority     (ARM A, unchanged)
 *   absent, something retained    -> the last thing CEE said       (the fix)
 *
 * ⚠ THE SECOND ARGUMENT MAY ONLY EVER WITHHOLD, and that is structural rather
 * than a rule to remember: the retained value is a value the producer sent, so it
 * can license nothing CEE did not license. Where CEE licensed the leader and the
 * user then edits, this returns the licence unchanged — which is the deliberate
 * stale-but-licensed behaviour `AtAGlance.tsx` keeps, hedged by the staleness
 * ribbon. Suppressing those would be a different product decision, not this fix.
 *
 * ⚠ IT KEYS ON THE ABSENT **ADMISSION**, NEVER ON AN ABSENT PAYLOAD.
 * `reselectGoalNode` constructs a readiness stub carrying no admission and is not
 * an older producer; keying on `ceeAnalysisReady == null` would let that stub
 * re-license the claim after an edit — the same defect by a second route.
 */
export function resolveEffectiveAdmission(
  liveAdmission: AnalysisAdmissionV1 | undefined | null,
  retained: AnalysisAdmissionV1 | undefined | null,
): AnalysisAdmissionV1 | undefined {
  return liveAdmission ?? retained ?? undefined
}

/**
 * Q1 OF TWO. **Does the MODEL license a comparative-leader claim at all?**
 *
 * A property of the GRAPH, decided before the run — given how this model was
 * authored, may the product name a leader, an ordinal, or a strength word?
 *
 * NOT THE WHOLE ANSWER, AND NEVER TO BE USED ALONE. The second question — did
 * THIS RESULT separate the arms? — is answered by `deriveDecisionVerdict`'s
 * `hasLeadingOption`, and the two are conjoined AT THE POINT OF USE, on their
 * own lines. Two questions under one name is the defect this estate has paid
 * for twice; do not fold either into the other's default.
 *
 * AND THEIR ABSENCE ARMS ARE OPPOSITE, ON PURPOSE:
 *   Q1 absent -> `true`  (the producer has not spoken, so nothing changes)
 *   Q2 absent -> `false` (no result, so no claim may be authored)
 * A shared default would silently blank the panel on every legacy payload, or
 * license a claim on every one. Neither is acceptable.
 *
 * NOT A RUN GATE. `structurally_analysable` is literally the same object as
 * `may_run` on the producer; the Run affordance keeps gating on `may_run` via
 * {@link admitsRunAffordance}. Adding the mode there would refuse runs the
 * engine would happily accept.
 */
export function licensesComparativeLeaderClaim(
  admission: AnalysisAdmissionV1 | undefined | null,
): boolean {
  if (admission == null) return true
  return admission.permitted_analysis_mode === 'comparative_leader'
}

/**
 * Returns the option array from the slice, or `null` when no readiness
 * state is present. Consumers that need option count / status breakdown
 * (e.g. pre-analysis panel) use this instead of reading the whole slice.
 */
export function useAnalysisReadyOptions(): readonly CEEOptionV3[] | null {
  return useCanvasStore((s) => s.ceeAnalysisReady?.options ?? null)
}
