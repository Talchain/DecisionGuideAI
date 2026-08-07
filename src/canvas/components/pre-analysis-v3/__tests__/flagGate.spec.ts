/**
 * Pins the rollback lever. Local dev may set VITE_FEATURE_PRE_ANALYSIS_V3 in
 * a gitignored .env.local (vitest inherits it via import.meta.env), so the
 * committed default is pinned at the source level, and the localStorage
 * override is verified to win in BOTH directions — '0' restores the legacy
 * panel even when a local env var switches the panel on.
 */

import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { isPreAnalysisV3Enabled } from '../../../../flags'
import { makeFlag } from '../../../../lib/flagFactory'

describe('preAnalysisV3 flag — reinstatement lever', () => {
  afterEach(() => {
    localStorage.removeItem('feature.preAnalysisV3')
  })

  it('the committed default is off (no defaultValue override in flags.ts)', () => {
    const flagsSource = fs.readFileSync(
      path.resolve(__dirname, '../../../../flags.ts'),
      'utf8',
    )
    const entry = flagsSource.match(/preAnalysisV3:\s*\{[^}]*\}/)?.[0] ?? ''
    expect(entry).toContain('VITE_FEATURE_PRE_ANALYSIS_V3')
    expect(entry).not.toContain('defaultValue')
  })

  it('an unset env var and no localStorage means off (factory default)', () => {
    const probe = makeFlag({
      envKey: 'VITE_FEATURE_PRE_ANALYSIS_V3_NONEXISTENT_PROBE',
      storageKey: 'feature.preAnalysisV3NonexistentProbe',
    })
    expect(probe()).toBe(false)
  })

  it('localStorage "1" enables the v3 panel', () => {
    localStorage.setItem('feature.preAnalysisV3', '1')
    expect(isPreAnalysisV3Enabled()).toBe(true)
  })

  it('localStorage "0" restores the legacy panel even over an env override', () => {
    localStorage.setItem('feature.preAnalysisV3', '0')
    expect(isPreAnalysisV3Enabled()).toBe(false)
  })
})
