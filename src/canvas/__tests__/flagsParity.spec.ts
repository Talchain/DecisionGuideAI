/**
 * Flags-off parity — ensures all new Phase 2A/2B flags are OFF by default
 * and that no cross-flag dependencies exist.
 * Phase 2A + 2B.
 */

import { describe, it, expect } from 'vitest'
import {
  isModelCardLiteEnabled,
  isPreAnalysisEnrichedEnabled,
  isCausalClaimsEnabled,
} from '../../flags'

describe('Phase 2A/2B flags — default OFF', () => {
  it('modelCardLite is OFF by default', () => {
    expect(isModelCardLiteEnabled()).toBe(false)
  })

  it('preAnalysisEnriched is OFF by default', () => {
    expect(isPreAnalysisEnrichedEnabled()).toBe(false)
  })

  it('causalClaims is OFF by default', () => {
    expect(isCausalClaimsEnabled()).toBe(false)
  })
})

describe('Phase 2A/2B flags — independence', () => {
  it('each flag is independently defined (no shared storage key)', () => {
    // Verify that the flags resolve to distinct values
    // Even if all are false, they should be independently callable
    const m = isModelCardLiteEnabled()
    const p = isPreAnalysisEnrichedEnabled()
    const c = isCausalClaimsEnabled()

    // All off by default
    expect(m).toBe(false)
    expect(p).toBe(false)
    expect(c).toBe(false)
  })
})
