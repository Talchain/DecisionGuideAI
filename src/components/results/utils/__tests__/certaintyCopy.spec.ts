/**
 * certaintyCopy — the tier × stability softening gate (Brief 5.5 §2.7 lock).
 *
 * Run-4 judge, DL ruling (12 Oct, the class): `buildCertaintyCopy` and its decision table are DELETED (its headlines
 * were leader claims from a win share, and it had no production caller), so the table's rows went with it. The gate it
 * shared with `getStabilityDisplayLabel` stays, and is pinned here.
 */

import { describe, it, expect } from 'vitest'
import * as certaintyCopy from '../certaintyCopy'
import { shouldSoftenPhrasing } from '../certaintyCopy'

describe('buildCertaintyCopy is gone (run-4 judge, the class)', () => {
  it('the module no longer exports a leader headline builder', () => {
    expect(certaintyCopy).not.toHaveProperty('buildCertaintyCopy')
  })
})

// ---------------------------------------------------------------------------
// shouldSoftenPhrasing — direct helper coverage (read by getStabilityDisplayLabel)
// ---------------------------------------------------------------------------

describe('shouldSoftenPhrasing — tier × stability gate', () => {
  it('returns true for needs_work + absent/low stability', () => {
    expect(shouldSoftenPhrasing('needs_work', undefined)).toBe(true)
    expect(shouldSoftenPhrasing('needs_work', 0.70)).toBe(true)
    expect(shouldSoftenPhrasing('needs_work', 0.84)).toBe(true)
  })

  it('returns true for fair + absent/low stability (new per §2.7)', () => {
    expect(shouldSoftenPhrasing('fair', undefined)).toBe(true)
    expect(shouldSoftenPhrasing('fair', 0.50)).toBe(true)
    expect(shouldSoftenPhrasing('fair', 0.84)).toBe(true)
  })

  it('returns false for any tier at stability ≥ 0.85 (override)', () => {
    expect(shouldSoftenPhrasing('needs_work', 0.85)).toBe(false)
    expect(shouldSoftenPhrasing('needs_work', 1.0)).toBe(false)
    expect(shouldSoftenPhrasing('fair', 0.85)).toBe(false)
    expect(shouldSoftenPhrasing('fair', 0.95)).toBe(false)
  })

  it('returns false for strong at any stability (readiness never softens)', () => {
    expect(shouldSoftenPhrasing('strong', undefined)).toBe(false)
    expect(shouldSoftenPhrasing('strong', 0.10)).toBe(false)
    expect(shouldSoftenPhrasing('strong', 0.95)).toBe(false)
  })

  it('returns false for unknown or undefined tier at any stability', () => {
    expect(shouldSoftenPhrasing('unknown', 0.50)).toBe(false)
    expect(shouldSoftenPhrasing(undefined, 0.50)).toBe(false)
    expect(shouldSoftenPhrasing(undefined, undefined)).toBe(false)
  })
})
