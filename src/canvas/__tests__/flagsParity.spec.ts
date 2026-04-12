/**
 * Flags-off parity — ensures Phase 2B flag is OFF by default.
 * Phase 2A flags (modelCardLite, causalClaims) retired in C5 Batch 1.
 */

import { describe, it, expect } from 'vitest'
import {
  isPreAnalysisEnrichedEnabled,
} from '../../flags'

describe('Phase 2B flags — default OFF', () => {
  it('preAnalysisEnriched is OFF by default', () => {
    expect(isPreAnalysisEnrichedEnabled()).toBe(false)
  })
})
