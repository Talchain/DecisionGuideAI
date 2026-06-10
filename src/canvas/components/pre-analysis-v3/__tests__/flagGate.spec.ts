/**
 * Pins the rollback lever: `preAnalysisV3` defaults off, and the localStorage
 * override ('feature.preAnalysisV3') switches the OutputsDock gate between
 * the v3 and legacy panels. Reinstatement = '0' or removal (design doc §14).
 */

import { describe, it, expect, afterEach } from 'vitest'
import { isPreAnalysisV3Enabled } from '../../../../flags'

describe('preAnalysisV3 flag — reinstatement lever', () => {
  afterEach(() => {
    localStorage.removeItem('feature.preAnalysisV3')
  })

  it('defaults off (legacy panel renders)', () => {
    localStorage.removeItem('feature.preAnalysisV3')
    expect(isPreAnalysisV3Enabled()).toBe(false)
  })

  it('localStorage "1" enables the v3 panel', () => {
    localStorage.setItem('feature.preAnalysisV3', '1')
    expect(isPreAnalysisV3Enabled()).toBe(true)
  })

  it('localStorage "0" restores the legacy panel', () => {
    localStorage.setItem('feature.preAnalysisV3', '0')
    expect(isPreAnalysisV3Enabled()).toBe(false)
  })
})
