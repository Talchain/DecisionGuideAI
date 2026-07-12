/**
 * Wave F-B — the hero Rerun routes through the canonical runner. Its old
 * PRIVATE useV2Run instance bypassed the run gate and V5 fact persistence
 * (audit: no cross-instance mutex).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useAnalysisHero } from '../useAnalysisHero'
import {
  registerCanonicalRunner,
  __resetCanonicalRunnerForTests,
} from '../../../../canvas/analysis/canonicalRunRegistry'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const data = {
  recommendation: { allOptions: [], flipThresholds: [], flipThresholdsStatus: 'unavailable' },
  drivers: { drivers: [] },
  confidence: {},
  improvements: {},
  isLoading: false,
  isError: false,
  goalLabel: null,
  goalNodeId: null,
} as unknown as ResultsSectionDataReturn

beforeEach(() => __resetCanonicalRunnerForTests())
afterEach(() => __resetCanonicalRunnerForTests())

describe('useAnalysisHero — canonical rerun (Wave F-B)', () => {
  it('onRerun executes the canonical runner', async () => {
    const runner = vi.fn(async (_opts?: import('../../../../canvas/analysis/canonicalRunRegistry').CanonicalRunOptions) => ({ status: 'dispatched' as const }))
    registerCanonicalRunner(runner)
    const { result } = renderHook(() => useAnalysisHero(data))
    await act(async () => { result.current.onRerun() })
    expect(runner).toHaveBeenCalledTimes(1)
    expect(runner.mock.calls[0][0]).toMatchObject({ source: 'analysis-hero' })
  })
})
