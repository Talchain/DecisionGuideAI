 import { describe, it, expect, beforeEach, vi } from 'vitest'
 import '@testing-library/jest-dom/vitest'
 import { render, screen, fireEvent, act } from '@testing-library/react'
 import { OutputsDock } from '../OutputsDock'
 import { useCanvasStore } from '../../store'
 import { STORAGE_KEY as RUN_HISTORY_STORAGE_KEY, type StoredRun } from '../../store/runHistory'
 import { __resetTelemetryCounters, __getTelemetryCounters } from '../../../lib/telemetry'

 // Mock flags module with all required exports
 vi.mock('../../../flags', () => ({
   isDecisionReviewEnabled: vi.fn(() => true),
   isTelemetryEnabled: () => true,
   isCompareEnabled: () => true,
 }))

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}

describe('OutputsDock DOM', () => {
  const STORAGE_KEY = 'canvas.outputsDock.v1'

  beforeEach(async () => {
    ensureMatchMedia()
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
    try {
      window.history.replaceState({}, '', '/canvas')
    } catch {}
    try {
      localStorage.removeItem(RUN_HISTORY_STORAGE_KEY)
    } catch {}
    useCanvasStore.setState({
      currentScenarioFraming: null,
      currentScenarioLastResultHash: null,
      hasCompletedFirstRun: false,
    } as any)

    // Reset the flag mock to default (true) before each test
    const { isDecisionReviewEnabled } = await import('../../../flags')
    vi.mocked(isDecisionReviewEnabled).mockReturnValue(true)
  })

  it('renders with correct ARIA attributes and sections', () => {
    render(<OutputsDock />)

    const aside = screen.getByLabelText('Outputs dock')
    expect(aside).toBeInTheDocument()

    const tabs = screen.getAllByRole('button', {
      name: /Results|Insights|Compare|Diagnostics/,
    })

    expect(tabs.map(tab => tab.textContent)).toEqual([
      'Results',
      'Insights',
      'Compare',
      'Diagnostics',
    ])
  })

  it('shows a collapsed icon strip when closed and reopens on icon click', () => {
    render(<OutputsDock />)

    const collapseButton = screen.getByRole('button', { name: 'Collapse outputs dock' })
    fireEvent.click(collapseButton)

    expect(screen.queryByTestId('outputs-dock-body')).toBeNull()

    const resultsIcon = screen.getByRole('button', { name: 'Results' })
    const insightsIcon = screen.getByRole('button', { name: 'Insights' })
    const compareIcon = screen.getByRole('button', { name: 'Compare' })
    const diagnosticsIcon = screen.getByRole('button', { name: 'Diagnostics' })

    expect(resultsIcon).toBeInTheDocument()
    expect(insightsIcon).toBeInTheDocument()
    expect(compareIcon).toBeInTheDocument()
    expect(diagnosticsIcon).toBeInTheDocument()

    fireEvent.click(diagnosticsIcon)

    const headerLabel = screen.getByText('Diagnostics', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })

  it('persists active tab and open state via useDockState', () => {
    const { unmount } = render(<OutputsDock />)

    // Switch to Compare tab and leave dock open
    const compareTab = screen.getByRole('button', { name: 'Compare' })
    fireEvent.click(compareTab)

    // Unmount and remount to verify persisted state
    unmount()

    render(<OutputsDock />)

    const aside = screen.getByLabelText('Outputs dock') as HTMLElement
    // Width style should reflect expanded state via CSS variable
    expect(aside.style.width).toContain('var(--dock-right-expanded')
    // Dock should reserve space for the bottom toolbar via CSS variable in height calculation
    expect(aside.style.height).toContain('var(--bottombar-h)')

    // Header label (aria-live) should reflect active tab
    const headerLabel = screen.getByText('Compare', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })

  it('reads initial active tab from ?tab= query parameter', () => {
    try {
      window.history.replaceState({}, '', '/canvas?tab=insights')
    } catch {}

    render(<OutputsDock />)

    const headerLabel = screen.getByText('Insights', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })

  it('updates ?tab= query parameter when tabs are clicked', () => {
    render(<OutputsDock />)

    // Switch to Diagnostics tab
    const diagnosticsTab = screen.getByRole('button', { name: 'Diagnostics' })
    fireEvent.click(diagnosticsTab)

    let params = new URLSearchParams(window.location.search)
    expect(params.get('tab')).toBe('diagnostics')

    // Switch back to Results tab, which should clear the tab parameter
    const resultsTab = screen.getByRole('button', { name: 'Results' })
    fireEvent.click(resultsTab)

    params = new URLSearchParams(window.location.search)
    expect(params.get('tab')).toBeNull()
  })

  it('emits sandbox.compare.opened when Compare tab is opened', () => {
    try {
      localStorage.setItem('feature.telemetry', '1')
    } catch {}
    __resetTelemetryCounters()

    render(<OutputsDock />)

    const compareTab = screen.getByRole('button', { name: 'Compare' })
    fireEvent.click(compareTab)

    const counters = __getTelemetryCounters()
    expect(counters['sandbox.compare.opened']).toBe(1)
  })

  it('shows pre-run messaging without CTA before first analysis', () => {
    render(<OutputsDock />)

    expect(screen.getByText('Results appear here after your first analysis.')).toBeInTheDocument()
    expect(
      screen.getByText('Run your first analysis from the toolbar above.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open results panel' })).not.toBeInTheDocument()
  })

  it('auto-switches back to Results tab when results become active', () => {
    render(<OutputsDock />)

    // Move away from Results tab
    const diagnosticsTab = screen.getByRole('button', { name: 'Diagnostics' })
    fireEvent.click(diagnosticsTab)

    const diagnosticsHeader = screen.getByText('Diagnostics', {
      selector: 'span[aria-live="polite"]',
    })
    expect(diagnosticsHeader).toBeInTheDocument()

    // Simulate results starting to stream
    const currentResults = useCanvasStore.getState().results
    act(() => {
      useCanvasStore.setState({
        results: { ...currentResults, status: 'streaming' },
      } as any)
    })

    const resultsHeader = screen.getByText('Results', {
      selector: 'span[aria-live="polite"]',
    })
    expect(resultsHeader).toBeInTheDocument()
  })

  it('shows an inline summary in the Results tab when a completed report is available', () => {
    const baseResults = useCanvasStore.getState().results
    const fakeReport: any = {
      results: {
        conservative: 10,
        likely: 20,
        optimistic: 30,
        units: 'percent',
        unitSymbol: '%',
      },
      run: {
        bands: { p10: 10, p50: 20, p90: 30 },
      },
    }

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReport,
      },
    } as any)

    render(<OutputsDock />)

    const summary = screen.getByTestId('outputs-inline-summary')
    expect(summary).toBeInTheDocument()
    expect(screen.getByText('Expected Value')).toBeInTheDocument()
  })

  it('renders Decision Review ready state in Results tab when ceeReview is present', () => {
    const baseResults = useCanvasStore.getState().results

    const fakeReport: any = {
      results: {
        conservative: 10,
        likely: 20,
        optimistic: 30,
        units: 'percent',
        unitSymbol: '%',
      },
      run: {
        bands: { p10: 10, p50: 20, p90: 30 },
      },
    }

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReport,
      },
      runMeta: {
        ceeReview: {
          story: {
            headline: 'CEE Ready Headline',
            key_drivers: [],
            next_actions: [],
          },
          journey: { is_complete: true, missing_envelopes: [] },
        },
      } as any,
    } as any)

    render(<OutputsDock />)

    const container = screen.getByTestId('outputs-decision-review')
    expect(container).toBeInTheDocument()

    const headline = screen.getByTestId('decision-review-headline')
    expect(headline).toHaveTextContent('CEE Ready Headline')
  })

  it('renders Decision Review error state with trace ID in Results tab when ceeError is present', () => {
    const baseResults = useCanvasStore.getState().results

    const fakeReport: any = {
      results: {
        conservative: 10,
        likely: 20,
        optimistic: 30,
        units: 'percent',
        unitSymbol: '%',
      },
      run: {
        bands: { p10: 10, p50: 20, p90: 30 },
      },
    }

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReport,
      },
      runMeta: {
        ceeError: {
          code: 'CEE_TEMPORARY',
          retryable: true,
          traceId: 'trace-xyz',
          suggestedAction: 'retry',
        },
        ceeTrace: {
          requestId: 'req-xyz',
          degraded: false,
          timestamp: '2025-11-20T18:30:00Z',
        },
      } as any,
    } as any)

    render(<OutputsDock />)

    const container = screen.getByTestId('outputs-decision-review')
    expect(container).toBeInTheDocument()

    const errorPanel = screen.getByTestId('decision-review-error')
    expect(errorPanel).toBeInTheDocument()

    const trace = screen.getByTestId('decision-review-trace-id')
    expect(trace).toHaveTextContent('req-xyz')
  })

  it('does NOT render Decision Review when feature flag is disabled', async () => {
    // Mock the flag to return false for this test
    const { isDecisionReviewEnabled } = await import('../../../flags')
    vi.mocked(isDecisionReviewEnabled).mockReturnValue(false)

    const baseResults = useCanvasStore.getState().results

    const fakeReport: any = {
      results: {
        conservative: 10,
        likely: 20,
        optimistic: 30,
        units: 'percent',
        unitSymbol: '%',
      },
      run: {
        bands: { p10: 10, p50: 20, p90: 30 },
      },
    }

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReport,
      },
      runMeta: {
        ceeReview: {
          story: {
            headline: 'This should not render',
            key_drivers: [],
            next_actions: [],
          },
          journey: { is_complete: true, missing_envelopes: [] },
        },
      } as any,
    } as any)

    render(<OutputsDock />)

    // Decision Review section should not exist in DOM when flag is off
    expect(screen.queryByTestId('outputs-decision-review')).not.toBeInTheDocument()
    expect(screen.queryByText('Decision Review')).not.toBeInTheDocument()
  })

  it('renders Decision Review empty state when ceeTrace exists but no review or error', () => {
    const baseResults = useCanvasStore.getState().results

    const fakeReport: any = {
      results: {
        conservative: 10,
        likely: 20,
        optimistic: 30,
        units: 'percent',
        unitSymbol: '%',
      },
      run: {
        bands: { p10: 10, p50: 20, p90: 30 },
      },
    }

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReport,
      },
      runMeta: {
        // ceeTrace present but no ceeReview or ceeError
        ceeTrace: {
          requestId: 'req-abc',
          degraded: false,
          timestamp: '2025-11-20T18:30:00Z',
        },
      } as any,
    } as any)

    render(<OutputsDock />)

    const container = screen.getByTestId('outputs-decision-review')
    expect(container).toBeInTheDocument()

    // Should show empty state message
    const emptyState = screen.getByTestId('decision-review-empty')
    expect(emptyState).toBeInTheDocument()
  })

  it('shows empty compare state when there are no runs yet', () => {
    render(<OutputsDock />)

    openCompareTab()

    expect(screen.getByTestId('compare-tab-empty')).toHaveTextContent('No runs to compare yet')
  })

  it('shows single-run hint when only one run is stored', () => {
    seedRunHistory([
      buildRun({
        id: 'run-1',
        ts: Date.parse('2025-11-18T10:00:00Z'),
        hash: 'aaaa1111aaaa1111',
        p50: 150,
      }),
    ])

    render(<OutputsDock />)

    openCompareTab()

    const single = screen.getByTestId('compare-tab-single')
    expect(single).toHaveTextContent('Only one run is available')
    expect(single).toHaveTextContent('aaaa1111')
  })

  it('defaults baseline/current selections based on scenario context', () => {
    seedRunHistory([
      buildRun({ id: 'run-1', ts: Date.parse('2025-11-18T10:00:00Z'), hash: 'aaaa1111aaaa1111', p50: 120 }),
      buildRun({ id: 'run-2', ts: Date.parse('2025-11-18T11:00:00Z'), hash: 'bbbb2222bbbb2222', p50: 220 }),
    ])

    useCanvasStore.setState({
      currentScenarioFraming: { title: 'Choose pricing strategy' },
      currentScenarioLastResultHash: 'bbbb2222bbbb2222',
    } as any)

    render(<OutputsDock />)

    openCompareTab()

    const baselineSelect = screen.getByTestId('compare-baseline-select') as HTMLSelectElement
    const currentSelect = screen.getByTestId('compare-current-select') as HTMLSelectElement

    expect(currentSelect.value).toBe('run-2')
    expect(baselineSelect.value).toBe('run-1')

    expect(screen.getByTestId('compare-context')).toHaveTextContent('Choose pricing strategy')
    expect(screen.getByTestId('compare-delta-text')).toHaveTextContent('increased by +100.0%')
  })

  it('falls back to current results hash when scenario last result hash is missing', () => {
    seedRunHistory([
      buildRun({
        id: 'run-1',
        ts: Date.parse('2025-11-18T10:00:00Z'),
        hash: 'aaaa1111aaaa1111',
        p50: 120,
      }),
      buildRun({
        id: 'run-2',
        ts: Date.parse('2025-11-18T11:00:00Z'),
        hash: 'bbbb2222bbbb2222',
        p50: 220,
      }),
    ])

    useCanvasStore.setState({
      currentScenarioFraming: { title: 'Choose pricing strategy' },
      currentScenarioLastResultHash: null,
      results: { seed: undefined, hash: 'bbbb2222bbbb2222' },
    } as any)

    render(<OutputsDock />)

    openCompareTab()

    const baselineSelect = screen.getByTestId('compare-baseline-select') as HTMLSelectElement
    const currentSelect = screen.getByTestId('compare-current-select') as HTMLSelectElement

    expect(currentSelect.value).toBe('run-2')
    expect(baselineSelect.value).toBe('run-1')
    expect(screen.getByTestId('compare-delta-text')).toHaveTextContent('increased by +100.0%')
  })

  it('updates delta messaging when the baseline selection changes', () => {
    seedRunHistory([
      buildRun({ id: 'run-1', ts: Date.parse('2025-11-18T10:00:00Z'), hash: 'aaaa1111aaaa1111', p50: 120 }),
      buildRun({ id: 'run-2', ts: Date.parse('2025-11-18T11:00:00Z'), hash: 'bbbb2222bbbb2222', p50: 220 }),
      buildRun({ id: 'run-3', ts: Date.parse('2025-11-18T12:00:00Z'), hash: 'cccc3333cccc3333', p50: 20 }),
    ])

    useCanvasStore.setState({
      currentScenarioLastResultHash: 'bbbb2222bbbb2222',
    } as any)

    render(<OutputsDock />)
    openCompareTab()

    const baselineSelect = screen.getByTestId('compare-baseline-select') as HTMLSelectElement
    fireEvent.change(baselineSelect, { target: { value: 'run-3' } })

    expect(screen.getByTestId('compare-delta-text')).toHaveTextContent('increased by +200.0%')
  })

  it('uses canonical bands even when null and does not fall back to legacy results in compare', () => {
    const baseline = buildRun({
      id: 'run-a',
      ts: Date.parse('2025-11-18T09:00:00Z'),
      hash: 'aaaa1111aaaa1111',
      p10: 10,
      p50: 20,
      p90: 30,
    })

    const current = buildRun({
      id: 'run-b',
      ts: Date.parse('2025-11-18T10:00:00Z'),
      hash: 'bbbb2222bbbb2222',
      p10: 40,
      p50: 50,
      p90: 60,
    })

    // Override canonical bands to be explicitly null while keeping legacy results distinct
    ;(current.report as any).run = {
      responseHash: current.hash,
      bands: { p10: null, p50: null, p90: null },
    }
    ;(current.report as any).results = {
      conservative: 999,
      likely: 888,
      optimistic: 777,
      units: 'percent',
      unitSymbol: '%',
    }

    seedRunHistory([baseline, current])

    render(<OutputsDock />)
    openCompareTab()

    // Make sure the current run in the comparison is the one with canonical-null bands
    const currentSelect = screen.getByTestId('compare-current-select') as HTMLSelectElement
    fireEvent.change(currentSelect, { target: { value: 'run-b' } })

    const outcome = screen.getByTestId('compare-outcome')

    // Outcome cards should respect canonical nulls and show placeholders ("—")
    expect(outcome).toHaveTextContent('Most likely')
    expect(outcome).toHaveTextContent('—')

    // Legacy results.likely (888) must not leak into the displayed values
    expect(outcome).not.toHaveTextContent('888.0%')

    // Delta text should treat null p50 as non-comparable
    const delta = screen.getByTestId('compare-delta-text')
    expect(delta).toHaveTextContent('Most likely outcome could not be compared for these runs.')
  })
})

it('shows graph health unknown message in Diagnostics tab when no health is available', () => {
  render(<OutputsDock />)

  openDiagnosticsTab()

  expect(screen.getByTestId('graph-health-card')).toBeInTheDocument()
  expect(screen.getByText('Health: Unknown')).toBeInTheDocument()
  expect(screen.getByText('No recent health check. Run diagnostics to analyse this graph.')).toBeInTheDocument()
})

it('shows graph health summary and opens Issues panel from Diagnostics tab', () => {
  const setShowIssuesPanelSpy = vi.spyOn(useCanvasStore.getState(), 'setShowIssuesPanel')

  useCanvasStore.setState({
    graphHealth: {
      status: 'errors',
      score: 40,
      issues: [
        { id: 'i1', type: 'cycle', severity: 'error', message: 'Cycle detected' },
        { id: 'i2', type: 'dangling_edge', severity: 'warning', message: 'Dangling edge' },
      ],
    },
  } as any)

  render(<OutputsDock />)

  openDiagnosticsTab()

  expect(screen.getByTestId('graph-health-card')).toBeInTheDocument()
  expect(screen.getByText('Health: Errors')).toBeInTheDocument()
  expect(screen.getByText('Score: 40/100 • 2 issues')).toBeInTheDocument()

  const cta = screen.getByTestId('graph-health-open-issues')
  fireEvent.click(cta)

  expect(setShowIssuesPanelSpy).toHaveBeenCalledWith(true)
})

// Phase 1 Section 3.3: Non-blocking CEE and degraded banner tests
it('shows degraded banner when ceeTrace.degraded is true', () => {
  const baseResults = useCanvasStore.getState().results

  const fakeReport: any = {
    results: {
      conservative: 10,
      likely: 20,
      optimistic: 30,
      units: 'percent',
      unitSymbol: '%',
    },
    run: {
      bands: { p10: 10, p50: 20, p90: 30 },
    },
  }

  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    results: {
      ...baseResults,
      status: 'complete',
      report: fakeReport,
    },
    runMeta: {
      ceeReview: {
        story: {
          headline: 'Test Review',
          key_drivers: [],
          next_actions: [],
        },
      },
      ceeTrace: {
        requestId: 'req-degraded',
        degraded: true, // CEE ran in degraded mode
        timestamp: '2025-11-20T18:30:00Z',
      },
    } as any,
  } as any)

  render(<OutputsDock />)

  // Degraded banner should appear
  const banner = screen.getByTestId('cee-degraded-banner')
  expect(banner).toBeInTheDocument()
  expect(banner).toHaveTextContent('Partial analysis:')
  expect(banner).toHaveTextContent('Decision Review ran with reduced functionality')
  expect(banner).toHaveAttribute('role', 'alert')

  // Decision Review should still render (non-blocking)
  expect(screen.getByTestId('decision-review-ready')).toBeInTheDocument()
})

it('does NOT show degraded banner when ceeTrace.degraded is false', () => {
  const baseResults = useCanvasStore.getState().results

  const fakeReport: any = {
    results: {
      conservative: 10,
      likely: 20,
      optimistic: 30,
      units: 'percent',
      unitSymbol: '%',
    },
    run: {
      bands: { p10: 10, p50: 20, p90: 30 },
    },
  }

  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    results: {
      ...baseResults,
      status: 'complete',
      report: fakeReport,
    },
    runMeta: {
      ceeReview: {
        story: {
          headline: 'Test Review',
          key_drivers: [],
          next_actions: [],
        },
      },
      ceeTrace: {
        requestId: 'req-normal',
        degraded: false, // CEE ran normally
        timestamp: '2025-11-20T18:30:00Z',
      },
    } as any,
  } as any)

  render(<OutputsDock />)

  // Banner should NOT appear
  expect(screen.queryByTestId('cee-degraded-banner')).not.toBeInTheDocument()

  // Decision Review should still render
  expect(screen.getByTestId('decision-review-ready')).toBeInTheDocument()
})

it('renders Results immediately without waiting for CEE (non-blocking verification)', () => {
  const baseResults = useCanvasStore.getState().results

  const fakeReport: any = {
    results: {
      conservative: 10,
      likely: 20,
      optimistic: 30,
      units: 'percent',
      unitSymbol: '%',
    },
    run: {
      bands: { p10: 10, p50: 20, p90: 30 },
    },
  }

  // Set up Results as complete, but CEE still loading (no ceeReview/ceeError, only ceeTrace)
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    results: {
      ...baseResults,
      status: 'complete', // Results are complete
      report: fakeReport,
    },
    runMeta: {
      // CEE engaged but no review/error yet (simulates CEE still processing)
      ceeTrace: {
        requestId: 'req-processing',
        degraded: false,
        timestamp: '2025-11-20T18:30:00Z',
      },
    } as any,
  } as any)

  render(<OutputsDock />)

  // Results should render immediately (non-blocking)
  const summary = screen.getByTestId('outputs-inline-summary')
  expect(summary).toBeInTheDocument()
  expect(screen.getByText('Expected Value')).toBeInTheDocument()

  // Verify the KPI values are rendered (multiple instances OK - one in headline, one in range chips)
  expect(screen.getAllByText('20.0%').length).toBeGreaterThan(0)

  // Decision Review shows empty state (CEE engaged but no review yet)
  expect(screen.getByTestId('decision-review-empty')).toBeInTheDocument()

  // Core results are fully accessible - not blocked by CEE
  expect(screen.getByText('Range')).toBeInTheDocument()
})

// Phase 2 Sprint 1B: Slow-run UX feedback tests
it('shows "Taking longer than expected..." message after 20 seconds', async () => {
  vi.useFakeTimers()

  render(<OutputsDock />)

  // Simulate a long-running analysis
  const currentResults = useCanvasStore.getState().results
  act(() => {
    useCanvasStore.setState({
      results: { ...currentResults, status: 'streaming' },
      hasCompletedFirstRun: true,
    } as any)
  })

  // Initially no message
  expect(screen.queryByTestId('slow-run-message')).not.toBeInTheDocument()

  // After 20 seconds, show first message
  act(() => {
    vi.advanceTimersByTime(20000)
  })

  expect(screen.getByTestId('slow-run-message')).toBeInTheDocument()
  expect(screen.getByText('Taking longer than expected...')).toBeInTheDocument()

  vi.useRealTimers()
})

it('escalates to "Still working..." message after 40 seconds', async () => {
  vi.useFakeTimers()

  render(<OutputsDock />)

  // Simulate a long-running analysis
  const currentResults = useCanvasStore.getState().results
  act(() => {
    useCanvasStore.setState({
      results: { ...currentResults, status: 'streaming' },
      hasCompletedFirstRun: true,
    } as any)
  })

  // After 40 seconds, show escalated message
  act(() => {
    vi.advanceTimersByTime(40000)
  })

  expect(screen.getByTestId('slow-run-message')).toBeInTheDocument()
  expect(screen.getByText('Still working...')).toBeInTheDocument()

  vi.useRealTimers()
})

it('clears slow-run message when analysis completes', async () => {
  vi.useFakeTimers()

  render(<OutputsDock />)

  // Simulate a long-running analysis
  const currentResults = useCanvasStore.getState().results
  act(() => {
    useCanvasStore.setState({
      results: { ...currentResults, status: 'streaming' },
      hasCompletedFirstRun: true,
    } as any)
  })

  // Advance to 20s to show message
  act(() => {
    vi.advanceTimersByTime(20000)
  })

  expect(screen.getByTestId('slow-run-message')).toBeInTheDocument()
  expect(screen.getByText('Taking longer than expected...')).toBeInTheDocument()

  // Complete the analysis
  act(() => {
    useCanvasStore.setState({
      results: { ...currentResults, status: 'complete' },
    } as any)
  })

  // Message should be cleared
  expect(screen.queryByTestId('slow-run-message')).not.toBeInTheDocument()

  vi.useRealTimers()
})

it('slow-run message has proper accessibility attributes', async () => {
  vi.useFakeTimers()

  render(<OutputsDock />)

  // Simulate a long-running analysis
  const currentResults = useCanvasStore.getState().results
  act(() => {
    useCanvasStore.setState({
      results: { ...currentResults, status: 'streaming' },
      hasCompletedFirstRun: true,
    } as any)
  })

  // Advance to 20s to show message
  act(() => {
    vi.advanceTimersByTime(20000)
  })

  const message = screen.getByTestId('slow-run-message')
  expect(message).toHaveAttribute('role', 'status')
  expect(message).toHaveAttribute('aria-live', 'polite')

  vi.useRealTimers()
})

function seedRunHistory(runs: StoredRun[]): void {
  localStorage.setItem(RUN_HISTORY_STORAGE_KEY, JSON.stringify(runs))
}

interface BuildRunOptions {
  id: string
  ts: number
  hash: string
  p10?: number
  p50?: number
  p90?: number
  units?: 'currency' | 'percent' | 'count'
}

function buildRun({ id, ts, hash, p10 = 100, p50 = 200, p90 = 300, units = 'percent' }: BuildRunOptions): StoredRun {
  const unitSymbol = units === 'currency' ? '$' : undefined
  return {
    id,
    ts,
    seed: 1,
    hash,
    adapter: 'mock',
    summary: 'Mock summary',
    graphHash: `graph-${id}`,
    report: {
      schema: 'report.v1',
      meta: { seed: 1, response_id: `response-${id}`, elapsed_ms: 500 },
      model_card: { response_hash: hash, response_hash_algo: 'sha256', normalized: true },
      results: {
        conservative: p10,
        likely: p50,
        optimistic: p90,
        units,
        unitSymbol,
      },
      confidence: { level: 'medium', why: 'Mock run' },
      drivers: [],
      run: {
        responseHash: hash,
        bands: { p10, p50, p90 },
      },
    },
  }
}

function openCompareTab() {
  const compareTab = screen.getByRole('button', { name: 'Compare' })
  fireEvent.click(compareTab)
}

function openDiagnosticsTab() {
  const diagnosticsTab = screen.getByRole('button', { name: 'Diagnostics' })
  fireEvent.click(diagnosticsTab)
}
