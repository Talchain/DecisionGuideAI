/**
 * (Moved verbatim from ServerVersionsSection so Version history and canvas
 * Undo/Redo share ONE restore identity rule.)
 *
 * A fresh restore identity, one per GESTURE.
 *
 * ⚠ WHY FRESHNESS IS A SAFETY PROPERTY, NOT AN OPTIMISATION. CEE's restore RPC
 * resolves replay BEFORE the CAS and says so itself
 * (`20260824200000_c8_atomic_model_version_restore.sql:311-314`): "A successful
 * original call may legitimately be retried after later graph changes; it
 * returns the original operation receipt and performs no writes."
 *
 * So a REUSED id on a genuinely-new restore of the same version — restore v1,
 * edit, restore v1 again — returns HTTP 200, `restored: true` and a real
 * receipt WHILE THE SERVER'S WORKING GRAPH IS NEVER REVERTED. The wire cannot
 * tell: CEE computes `replayed` and only LOGS it, and the response schema is
 * `.strict()` without it. We would then reconcile the canvas to the old graph
 * and tell the user "the shared model and this canvas now show that version",
 * which would be false about the shared model. A fabricated success is worse
 * than the honest 422 this PR removes.
 *
 * DO NOT hoist this, memoise it per versionId, or derive it from
 * (scenarioId, versionId). The append path's `deterministicMutationId` is NOT
 * a precedent: there a `turn_id` already identifies the logical mutation, and
 * a restore gesture has no such pre-existing identity. Reuse is correct only
 * WITHIN one gesture, and there is no in-gesture retry to serve — `postOnce`
 * issues exactly one fetch. The user clicking Restore again is a NEW gesture
 * and must get a NEW id. If an automatic retry of a timed-out restore is ever
 * added, THAT retry reuses this id; nothing else ever does.
 *
 * Shape follows `conversation/systemEvents.ts:51-61` — the only UUID-valid
 * fallback in this tree. Deliberately NOT `utils/idempotency.ts`, whose
 * fallback returns `idk_<hex>_<hex>` and would fail CEE's `z.string().uuid()`,
 * reproducing this very defect somewhere far harder to see.
 */
export function newRestoreMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
