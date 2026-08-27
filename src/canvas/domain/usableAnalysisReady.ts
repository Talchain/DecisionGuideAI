/**
 * "Is this a readiness verdict I may act on?" — the READ side of `analysis_ready`.
 *
 * ⭐ WHY THIS IS A DERIVED READ AND NOT A NARROWED FIELD.
 *
 * `status: 'blocked'` is CEE REFUSING. It is not a readiness verdict, and a
 * consumer asking "what is ready?" must never receive one. The obvious fix —
 * typing the store's `ceeAnalysisReady` so `status` cannot be `'blocked'` — is
 * NOT taken here, deliberately, and the next reader should not "finish" it:
 *
 *   The store REALLY DOES hold `status: 'blocked'` at runtime.
 *   `store.ts`'s `setCeeAnalysisReady` sets unconditionally, and CEE's
 *   identity-preserving refusal (ARM B) is accepted by the V5 normaliser and
 *   written (`applyV5State.ts:1232`). Narrowing the FIELD would therefore be a
 *   false claim — and a false type is worse than a false comment, because it is
 *   the one kind of claim nothing checks at runtime: the compiler would enforce
 *   the guarantee on every READER while the WRITER that produces the value does
 *   not provide it.
 *
 * A derived read has no storage, so it cannot drift from the field it narrows.
 * That is the whole reason it is a function and not a second slice.
 *
 * ⚠ WHY A TRUTHINESS OR `options.length` CHECK IS NOT ENOUGH. Two refusal
 * carriers exist:
 *   ARM A  empty carrier (`options: []`, `goal_node_id: ''`) — rejected upstream.
 *   ARM B  IDENTITY-PRESERVING carrier — non-empty `options` AND `goal_node_id`,
 *          preserved on purpose so a refusal can still name the model it refused
 *          about (CEE #1128).
 * On ARM B every shape-keyed guard reads a refusal as readiness, because the
 * fields those guards look at are exactly the ones ARM B populates. The only
 * honest discriminator is the status.
 */
import type { CEEAnalysisReady, UsableCEEAnalysisReady } from '../../adapters/cee/types'

/**
 * Type predicate: this payload is not a refusal.
 *
 * ⚠ CORRECTED. An earlier draft of this comment said the narrowing is "something
 * the compiler checks, not something this module asserts". **That is backwards.**
 * TypeScript does not verify a type-predicate's BODY — it takes `x is T` on
 * trust and propagates it. A predicate is therefore exactly as much an assertion
 * as a cast; it is preferable only because the assertion sits in ONE named place
 * with a test around it, instead of at every call site. The guarantee here is
 * the test below it, never the compiler.
 */
export function isUsableAnalysisReady(
  analysisReady: CEEAnalysisReady,
): analysisReady is UsableCEEAnalysisReady {
  return !isBlockedCarrier(analysisReady)
}

/**
 * "Is this payload a readiness verdict at all?" — FALSE for every `blocked`
 * carrier, and NOT a claim that CEE refused.
 *
 * ⚠⚠ RENAMED FROM `isAnalysisRefusal`, AND THE OLD NAME WAS A FALSE CLAIM.
 * TWO DISTINCT `status: 'blocked'` CARRIERS EXIST, derived at the CEE bytes and
 * recorded at `canvas/store/analysisRefusalNotice.ts:39-55`:
 *
 *   REFUSAL  `buildAnalysisRefusalReadiness()` — ALWAYS a non-empty
 *            `blocked_reason`. CEE refused.
 *   LEGACY   `synthesiseFreshnessOnlyAnalysisReady()` — `status:'blocked'`,
 *            NO `blocked_reason`, emitted on legacy/unparseable RELOADS. It
 *            "says nothing about a refusal".
 *
 * ⭐ SO THE PREDICATE'S BEHAVIOUR WAS RIGHT AND ITS NAME WAS WRONG — the
 * sharpest form of this estate's recurring defect, because nothing in a test
 * can see it. For THIS question both carriers are correctly excluded: neither
 * is a verdict a consumer may act on. But `isAnalysisRefusal` ASSERTED that a
 * legacy freshness carrier is a refusal, which is false, and any reader who
 * adopted it for the refusal question would have fabricated "this analysis did
 * not run" on every legacy reload.
 *
 * ⛔ THE REFUSAL QUESTION IS A DIFFERENT QUESTION AND IT IS NOT ANSWERED HERE.
 * Its owner is `analysisRefusalNotice.ts`, and its discriminator is the PRESENCE
 * OF A NON-EMPTY `blocked_reason`, never `status` alone. Do not use this
 * predicate for it, and do not "align" the two — they are two questions, and
 * naming them apart is the fix (trap 21), not reconciling their answers.
 */
export function isBlockedCarrier(
  analysisReady: { status?: string } | null | undefined,
): boolean {
  return analysisReady?.status === 'blocked'
}

/**
 * The payload IF it is a readiness verdict, else `null`.
 *
 * Returns the SAME OBJECT on the pass-through path — nothing is rebuilt, so a
 * consumer cannot receive a payload this module composed.
 */
export function selectUsableAnalysisReady(
  analysisReady: CEEAnalysisReady | null | undefined,
): UsableCEEAnalysisReady | null {
  if (analysisReady === null || analysisReady === undefined) return null
  return isUsableAnalysisReady(analysisReady) ? analysisReady : null
}
