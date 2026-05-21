/**
 * AnalysisOrphanBanner — render-state tests.
 *
 * v5-canonical-analysis brief PR 1 (item 5) requires the orphan banner to
 * render ONLY when the canonical flag is on AND a results report exists
 * without a successful V5 run_analysis fact attached to the current
 * scenario. The flag being off is NOT an orphan state (correction 2).
 *
 * The "Run analysis" button must fire the SAME chip-action dispatch
 * payload OutputsDock + suggested chips use (action_type:'run_analysis',
 * source:'chip') — never a free-text path (correction 1).
 */
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockIsV5CanonicalAnalysisEnabled } = vi.hoisted(() => ({
  mockIsV5CanonicalAnalysisEnabled: vi.fn(() => true),
}))

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isV5CanonicalAnalysisEnabled: mockIsV5CanonicalAnalysisEnabled,
  }
})

import { AnalysisOrphanBanner } from '../AnalysisOrphanBanner'
import { useCanvasStore } from '../../../canvas/store'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import type { V5AnalysisFactState } from '../../../canvas/store'

beforeEach(() => {
  vi.clearAllMocks()
  mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
  // Seed a results.report so the source classifier can be exercised; the
  // V5 fact slice is the lever each test flips to choose orphan vs not.
  useCanvasStore.setState({
    results: { status: 'complete', report: { schema: 'report.v1' } as any, hash: 'hash-A' },
    currentScenarioId: 'scenario-A',
    v5AnalysisFact: null,
  } as any)
  useGuidanceStore.setState({ _dispatchAction: null } as any)
})

describe('AnalysisOrphanBanner', () => {
  it('renders when canonical flag is on AND no V5 fact attached', () => {
    render(<AnalysisOrphanBanner />)
    expect(screen.getByTestId('analysis-orphan-banner')).toBeInTheDocument()
    // Single-row strip: action-led title + dot-separator + secondary copy.
    expect(screen.getByText('Refresh analysis')).toBeInTheDocument()
    expect(screen.getByText(/Coaching may be out of date/)).toBeInTheDocument()
    const banner = screen.getByTestId('analysis-orphan-banner')
    expect(banner.textContent ?? '').toMatch(/Refresh analysis\s*·\s*Coaching may be out of date/)
    expect(screen.getByTestId('analysis-orphan-banner-run')).toBeInTheDocument()
    // Slimmed copy — the legacy second sentence is gone.
    expect(banner.textContent ?? '').not.toMatch(/Re-run analysis to attach/)
  })

  it('does NOT render when canonical flag is off (direct_plot_legacy, not orphan)', () => {
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(false)
    render(<AnalysisOrphanBanner />)
    expect(screen.queryByTestId('analysis-orphan-banner')).not.toBeInTheDocument()
  })

  it('does NOT render when a V5 fact is attached to the current scenario', () => {
    const fact: V5AnalysisFactState = {
      scenarioId: 'scenario-A',
      analysisHash: 'hash-A',
      hasRunAnalysisFact: true,
      freshness: 'fresh',
      freshnessReason: null,
      rawBlocks: [],
      writtenAt: Date.now(),
    }
    useCanvasStore.setState({ v5AnalysisFact: fact } as any)
    render(<AnalysisOrphanBanner />)
    expect(screen.queryByTestId('analysis-orphan-banner')).not.toBeInTheDocument()
  })

  it('does NOT render when no results report exists (source=none)', () => {
    useCanvasStore.setState({
      results: { status: 'idle' },
    } as any)
    render(<AnalysisOrphanBanner />)
    expect(screen.queryByTestId('analysis-orphan-banner')).not.toBeInTheDocument()
  })

  it('renders for cross-scenario fact (scenarioId mismatch = orphan for current scenario)', () => {
    const fact: V5AnalysisFactState = {
      scenarioId: 'scenario-B', // different from currentScenarioId
      analysisHash: 'hash-A',
      hasRunAnalysisFact: true,
      freshness: 'fresh',
      freshnessReason: null,
      rawBlocks: [],
      writtenAt: Date.now(),
    }
    useCanvasStore.setState({ v5AnalysisFact: fact } as any)
    render(<AnalysisOrphanBanner />)
    expect(screen.getByTestId('analysis-orphan-banner')).toBeInTheDocument()
  })

  it('Run-analysis button fires chip-shaped dispatchAction (correction 1)', () => {
    const dispatchAction = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)

    render(<AnalysisOrphanBanner />)
    fireEvent.click(screen.getByTestId('analysis-orphan-banner-run'))

    expect(dispatchAction).toHaveBeenCalledTimes(1)
    const call = dispatchAction.mock.calls[0][0]
    expect(call.action_type).toBe('run_analysis')
    expect(call.source).toBe('chip')
    expect(call.label).toBe('Run analysis')
    expect(typeof call.message).toBe('string')
    expect(call.message.length).toBeGreaterThan(0)
  })

  it('Run button is disabled when dispatchAction is not yet registered', () => {
    useGuidanceStore.setState({ _dispatchAction: null } as any)
    render(<AnalysisOrphanBanner />)
    const button = screen.getByTestId('analysis-orphan-banner-run') as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('copy is free of forbidden tokens (no winner/em-dash/emoji/internal-terms)', () => {
    render(<AnalysisOrphanBanner />)
    const banner = screen.getByTestId('analysis-orphan-banner')
    const text = banner.textContent ?? ''
    expect(text).not.toMatch(/winner|winning|recommendation|recommended/i)
    expect(text).not.toMatch(/—/)
    expect(text).not.toMatch(/validator|schema|dispatcher|handler|trace|payload/i)
    // Emoji block — quick sanity check against common ranges; the banner
    // should be plain text only.
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  })
})
