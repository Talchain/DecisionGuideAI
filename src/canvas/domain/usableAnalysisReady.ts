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
 * A predicate rather than a cast — the narrowing is then something the compiler
 * checks, not something this module asserts.
 */
export function isUsableAnalysisReady(
  analysisReady: CEEAnalysisReady,
): analysisReady is UsableCEEAnalysisReady {
  return !isAnalysisRefusal(analysisReady)
}

/**
 * THE discriminator. Structurally typed on purpose: several consumers hold only
 * a narrow projection of the payload, and they must not each re-spell
 * `status === 'blocked'` — one literal, one module, so a change to what counts
 * as a refusal cannot land in some readers and miss others.
 */
export function isAnalysisRefusal(
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
