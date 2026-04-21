/**
 * V5 eligibility predicate — pure flag pass-through.
 *
 * v5-ui-exclusive-path brief (Phase 2): V5 is the exclusive CEE path when the
 * flag is on. Every turn — free text, chip click, retry, system event, any
 * stage, any history — routes to `/orchestrate/v2/turn`. The gate is the flag
 * and nothing else. This predicate is retained (rather than inlining the
 * env check at each call site) so callers don't duplicate the
 * Vite-inlined env-var lookup and tests can parameterise the flag value
 * without mutating `import.meta.env`.
 *
 * When the flag is off, all turns route to the legacy V4 path unchanged.
 * Rollback is a flag flip plus redeploy.
 */

export interface V5EligibilityInput {
  /** VITE_ENABLE_V5_ORCHESTRATOR raw string value. Exact match on 'true'. */
  flag: string | undefined
}

export type V5EligibilityReason = 'flag_off'

export type V5EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: V5EligibilityReason }

export function isV5Eligible(input: V5EligibilityInput): V5EligibilityResult {
  if (input.flag !== 'true') {
    return { eligible: false, reason: 'flag_off' }
  }
  return { eligible: true }
}
