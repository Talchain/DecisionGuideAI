/**
 * StaleAnalysisBadge canonical-routing tests.
 *
 * v5-canonical-analysis brief P1 follow-up: the "Rerun" affordance in the
 * stale-analysis badge is a user-visible analysis trigger and must respect
 * the canonical flag. When the flag is on AND V5 is eligible, it must
 * dispatch the same chip-shaped action OutputsDock uses — never call
 * runV2Analysis directly.
 */
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const {
  mockUseV2Run,
  mockIsV5CanonicalAnalysisEnabled,
  mockIsV5Eligible,
  mockUseStaleGuard,
} = vi.hoisted(() => ({
  mockUseV2Run: vi.fn(() => ({ runV2Analysis: vi.fn(), isRunning: false })),
  mockIsV5CanonicalAnalysisEnabled: vi.fn(() => false),
  mockIsV5Eligible: vi.fn(() => ({ eligible: false, reason: 'flag_off' })),
  mockUseStaleGuard: vi.fn(() => ({ isStale: true })),
}))

vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => mockUseV2Run(),
}))

vi.mock('../../ui/inspector-v2/useStaleGuard', () => ({
  useStaleGuard: () => mockUseStaleGuard(),
}))

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isV5CanonicalAnalysisEnabled: mockIsV5CanonicalAnalysisEnabled,
  }
})

vi.mock('../../../v5/eligibility', () => ({
  isV5Eligible: mockIsV5Eligible,
}))

import { StaleAnalysisBadge } from '../StaleAnalysisBadge'
import { useGuidanceStore } from '../../stores/guidanceStore'

beforeEach(() => {
  vi.clearAllMocks()
  mockUseStaleGuard.mockReturnValue({ isStale: true })
  mockIsV5CanonicalAnalysisEnabled.mockReturnValue(false)
  mockIsV5Eligible.mockReturnValue({ eligible: false, reason: 'flag_off' } as any)
  useGuidanceStore.setState({ _dispatchAction: null } as any)
})

describe('StaleAnalysisBadge — Rerun routing', () => {
  it('fires chip-shaped dispatchAction when canonical flag is on AND V5 eligible', () => {
    const dispatchAction = vi.fn()
    const runV2Analysis = vi.fn()
    mockUseV2Run.mockReturnValue({ runV2Analysis, isRunning: false })
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
    mockIsV5Eligible.mockReturnValue({ eligible: true } as any)

    useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)

    render(<StaleAnalysisBadge />)
    fireEvent.click(screen.getByTestId('ai-panel-v2-stale-rerun'))

    expect(dispatchAction).toHaveBeenCalledTimes(1)
    const call = dispatchAction.mock.calls[0][0]
    expect(call.action_type).toBe('run_analysis')
    expect(call.source).toBe('chip')
    expect(call.label).toBe('Run analysis')
    expect(runV2Analysis).not.toHaveBeenCalled()
  })

  it('falls back to direct V2 when canonical flag is off', () => {
    const dispatchAction = vi.fn()
    const runV2Analysis = vi.fn()
    mockUseV2Run.mockReturnValue({ runV2Analysis, isRunning: false })
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(false)
    mockIsV5Eligible.mockReturnValue({ eligible: true } as any)

    useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)

    render(<StaleAnalysisBadge />)
    fireEvent.click(screen.getByTestId('ai-panel-v2-stale-rerun'))

    expect(runV2Analysis).toHaveBeenCalledTimes(1)
    expect(dispatchAction).not.toHaveBeenCalled()
  })

  it('falls back to direct V2 when canonical flag is on but no _dispatchAction registered', () => {
    const runV2Analysis = vi.fn()
    mockUseV2Run.mockReturnValue({ runV2Analysis, isRunning: false })
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
    mockIsV5Eligible.mockReturnValue({ eligible: true } as any)

    useGuidanceStore.setState({ _dispatchAction: null } as any)

    render(<StaleAnalysisBadge />)
    fireEvent.click(screen.getByTestId('ai-panel-v2-stale-rerun'))

    expect(runV2Analysis).toHaveBeenCalledTimes(1)
  })

  it('is no-op while isRunning=true', () => {
    const dispatchAction = vi.fn()
    const runV2Analysis = vi.fn()
    mockUseV2Run.mockReturnValue({ runV2Analysis, isRunning: true })
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
    mockIsV5Eligible.mockReturnValue({ eligible: true } as any)

    useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)

    render(<StaleAnalysisBadge />)
    fireEvent.click(screen.getByTestId('ai-panel-v2-stale-rerun'))

    expect(dispatchAction).not.toHaveBeenCalled()
    expect(runV2Analysis).not.toHaveBeenCalled()
  })
})
