/**
 * VITE_V5_CANONICAL_ANALYSIS flag — default-off + storage override tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

beforeEach(() => {
  // Clear any localStorage overrides between cases.
  try { localStorage.clear() } catch { /* ignore */ }
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isV5CanonicalAnalysisEnabled', () => {
  it('defaults OFF when env var is unset and no localStorage override', async () => {
    vi.stubEnv('VITE_V5_CANONICAL_ANALYSIS', undefined as unknown as string)
    const { isV5CanonicalAnalysisEnabled } = await import('../flags')
    expect(isV5CanonicalAnalysisEnabled()).toBe(false)
  })

  it('enables when env var is "1"', async () => {
    vi.stubEnv('VITE_V5_CANONICAL_ANALYSIS', '1')
    vi.resetModules()
    const { isV5CanonicalAnalysisEnabled } = await import('../flags')
    expect(isV5CanonicalAnalysisEnabled()).toBe(true)
  })

  it('enables when localStorage override is set', async () => {
    try { localStorage.setItem('feature.v5CanonicalAnalysis', '1') } catch { /* ignore */ }
    vi.stubEnv('VITE_V5_CANONICAL_ANALYSIS', undefined as unknown as string)
    vi.resetModules()
    const { isV5CanonicalAnalysisEnabled } = await import('../flags')
    expect(isV5CanonicalAnalysisEnabled()).toBe(true)
  })

  it('localStorage "0" override disables even when env is "1"', async () => {
    try { localStorage.setItem('feature.v5CanonicalAnalysis', '0') } catch { /* ignore */ }
    vi.stubEnv('VITE_V5_CANONICAL_ANALYSIS', '1')
    vi.resetModules()
    const { isV5CanonicalAnalysisEnabled } = await import('../flags')
    expect(isV5CanonicalAnalysisEnabled()).toBe(false)
  })
})
