/**
 * `resolveEffectiveAdmission` — WHICH ABSENCE IS THIS?
 *
 * The unit that separates two questions that shared one name:
 *
 *   "did the producer never speak?"   -> absence means NO AUTHORITY (unchanged)
 *   "did we null it ourselves?"       -> the last thing CEE said still governs
 *
 * `licensesComparativeLeaderClaim(undefined) === true` is correct for the first
 * and was being applied to the second, so one keystroke turned a recorded refusal
 * into a licence. WITNESSED on staging 9eb30b54 (2026-09-10): a
 * `quantified_provisional` run rendered "What this run may not conclude" and, 59ms
 * after one factor value was edited, rendered "Most likely to serve your goal /
 * Double Down on SMB" in the same slot.
 *
 * ⚠ THE CENTRAL PROPERTY IS THAT THE RETAINED ARGUMENT MAY ONLY EVER WITHHOLD.
 * It is asserted here over the WHOLE enum rather than on the one mode the defect
 * happened to involve — a corpus drawn from the failure mode cannot see the class
 * the failure mode did not include.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveEffectiveAdmission,
  licensesComparativeLeaderClaim,
} from '../useAnalysisReady'
import type { AnalysisAdmissionV1, PermittedAnalysisMode } from '../../../adapters/cee/types'

/**
 * THE WHOLE ENUM, WITH COMPLETENESS ENFORCED BY THE COMPILER.
 *
 * ⚠ NOT `const modes: PermittedAnalysisMode[] = [...]`, which is the idiom
 * elsewhere in this estate and is weaker than it looks: that annotation rejects an
 * INVALID member but says nothing about a MISSING one, so a mode added upstream
 * silently drops out of every sweep written that way and the sweep still reads
 * green. (Proved on myself writing this file — my first list said
 * `'structural_only'`, which is not a member, and `'exploratory'`, which is, was
 * absent.)
 *
 * A `Record` keyed by the union fails to compile in BOTH directions: a missing key
 * is an error, and an extra key is an error. The list is then derived from it.
 */
const EVERY_MODE: Record<PermittedAnalysisMode, true> = {
  none: true,
  exploratory: true,
  quantified_provisional: true,
  comparative_leader: true,
}
const ALL_MODES = Object.keys(EVERY_MODE) as readonly PermittedAnalysisMode[]

const adm = (mode: PermittedAnalysisMode): AnalysisAdmissionV1 => ({
  permitted_analysis_mode: mode,
  reasons: [],
})

describe('resolveEffectiveAdmission — which absence is this?', () => {
  it('the producer never spoke: absence stays absence, so the `true` arm is untouched', () => {
    expect(resolveEffectiveAdmission(undefined, null)).toBeUndefined()
    expect(resolveEffectiveAdmission(null, null)).toBeUndefined()
    expect(resolveEffectiveAdmission(undefined, undefined)).toBeUndefined()
    // The consequence that ARM A depends on, stated here so the coupling is visible.
    expect(licensesComparativeLeaderClaim(resolveEffectiveAdmission(undefined, null))).toBe(true)
  })

  it('we nulled it ourselves: the producer’s last word governs', () => {
    const retained = adm('quantified_provisional')
    expect(resolveEffectiveAdmission(undefined, retained)).toBe(retained)
    expect(licensesComparativeLeaderClaim(resolveEffectiveAdmission(undefined, retained))).toBe(false)
  })

  it('a live admission always wins over a retained one, in BOTH directions', () => {
    const live = adm('comparative_leader')
    const retained = adm('none')
    expect(resolveEffectiveAdmission(live, retained)).toBe(live)
    // …and the reverse, or this only proves the permissive direction.
    expect(resolveEffectiveAdmission(adm('none'), adm('comparative_leader'))?.permitted_analysis_mode)
      .toBe('none')
  })

  /**
   * ⭐ THE SAFETY PROPERTY, OVER THE WHOLE ENUM. Consulting the retained value can
   * never license a claim that the live reading did not already license, because
   * the only values it can hold are values the producer sent. Written against the
   * enum rather than against `quantified_provisional` alone: the defect arrived on
   * one mode, and a corpus shaped like the defect cannot certify the others.
   */
  it('the retained argument NEVER licenses a claim a live admission refused', () => {
    for (const live of ALL_MODES) {
      for (const retained of ALL_MODES) {
        const liveAnswer = licensesComparativeLeaderClaim(adm(live))
        const effective = licensesComparativeLeaderClaim(
          resolveEffectiveAdmission(adm(live), adm(retained)),
        )
        expect(
          effective,
          `live=${live} retained=${retained}: a present live admission must decide alone`,
        ).toBe(liveAnswer)
      }
    }
  })

  it('with no live admission, the effective answer is exactly the retained one', () => {
    for (const retained of ALL_MODES) {
      expect(
        licensesComparativeLeaderClaim(resolveEffectiveAdmission(undefined, adm(retained))),
        `retained=${retained} must be honoured verbatim, not re-interpreted`,
      ).toBe(retained === 'comparative_leader')
    }
  })

  /**
   * ⚠ THE STUB PATH. `reselectGoalNode` constructs a readiness payload with no
   * admission, and it is NOT an older producer. This is why the resolver keys on an
   * absent ADMISSION rather than on an absent PAYLOAD — keying on the payload would
   * let that stub re-license the claim after an edit had invalidated it, which is
   * the same defect reached by a second route.
   */
  it('an admission-less readiness stub does not re-license what an edit invalidated', () => {
    const retained = adm('quantified_provisional')
    const stubAdmission = (({ status: undefined, options: [] } as { analysis_admission?: AnalysisAdmissionV1 })
      .analysis_admission)
    expect(stubAdmission, 'precondition: the stub carries no admission').toBeUndefined()
    expect(licensesComparativeLeaderClaim(resolveEffectiveAdmission(stubAdmission, retained))).toBe(false)
  })
})
