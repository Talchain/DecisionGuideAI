/**
 * OLUMI MUST NOT ATTRIBUTE ITS OWN BUNDLED EXAMPLE TO THE USER'S BRIEF.
 *
 * MEASURED DEFECT (W-1, reproduced live on the deployed staging build
 * `6524caed`, 2026-08-18). A guest with empty storage enters guest mode and
 * opens the "Customer Data Platform Selection" saved example. The panel says,
 * verbatim:
 *
 *   "Olumi estimated 6 values from your brief. Check Snowflake-Native Build
 *    Adoption first, it may matter most."
 *
 * The visitor has never written a brief. The six values were estimated on
 * 2026-07-28 from a brief that ships inside the app — which the canvas banner
 * two inches away says out loud ("Saved example — Olumi drafted this model on
 * 2026-07-28. It wasn't generated just now."). One surface knows; this one
 * claims authorship on the user's behalf.
 *
 * P5: a claim about the user's own input must be grounded in something that
 * says the user supplied it. The authoritative read here is the graph itself —
 * `resolveStarterId(nodes)`, the SAME predicate the disclosure and the run gate
 * use — not a separate "is this a demo" flag that could drift from either.
 *
 * OPPOSITE-DIRECTION TWIN (mandatory): a real user who really did write a brief
 * must still be told their values came from it. Fixing a false claim by
 * deleting the true one is the same defect facing the other way.
 */

import { describe, it, expect } from 'vitest'
import { SIGNAL_REGISTRY, type SignalDetectionInput } from '../registry'

function input(overrides: Partial<SignalDetectionInput> = {}): SignalDetectionInput {
  return {
    goalPresent: true,
    successSet: true,
    optionCount: 4,
    riskCount: 3,
    risksAllOlumi: true,
    aiEstimatedCount: 6,
    // The exact factor the deployed build named in the live capture.
    topUncalibrated: { id: 'f_snowflake', label: 'Snowflake-Native Build Adoption' },
    narrowFramingDetail: null,
    biasFindingExplanation: null,
    isSavedExample: false,
    ...overrides,
  }
}

const def = SIGNAL_REGISTRY.find(d => d.signal_id === 'sig_estimates')!

describe('estimates signal — attribution of who wrote the brief', () => {
  it('does NOT claim the values came from the user\'s brief on a saved example', () => {
    const detection = def.detect(input({ isSavedExample: true }))
    // Precondition pinned in-test: the signal must actually fire, or the
    // absence of the false sentence would prove nothing (trap 13).
    expect(detection, 'precondition: the estimates signal must fire on this input').not.toBeNull()

    expect(
      detection!.copy.lead,
      'the panel told a visitor who has never written a brief that Olumi estimated values "from ' +
        'your brief" — the values came from the example\'s own bundled brief, drafted 2026-07-28',
    ).not.toMatch(/your brief/i)

    // Still says the true, useful part: how many values Olumi estimated.
    expect(detection!.copy.lead).toMatch(/\b6\b/)
    expect(detection!.copy.lead).toMatch(/Olumi estimated/)
    // And still points at the highest-influence one, bound by its identity.
    expect(detection!.copy.emphasis).toContain('Snowflake-Native Build Adoption')
  })

  it('STILL says "from your brief" when the brief really is the user\'s', () => {
    const detection = def.detect(input({ isSavedExample: false }))
    expect(detection, 'precondition: the estimates signal must fire on this input').not.toBeNull()
    expect(detection!.copy.lead).toBe('Olumi estimated 6 values from your brief.')
  })

  it('the two directions are genuinely different sentences', () => {
    // Guards against a "fix" that returns the same string either way and
    // satisfies the negative assertion by accident.
    const example = def.detect(input({ isSavedExample: true }))!.copy.lead
    const own = def.detect(input({ isSavedExample: false }))!.copy.lead
    expect(example).not.toBe(own)
  })
})
