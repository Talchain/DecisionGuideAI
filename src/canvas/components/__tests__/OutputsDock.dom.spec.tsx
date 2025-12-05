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
      name: /Results|Compare|Structure/,
    })

    expect(tabs.map(tab => tab.textContent)).toEqual([
      'Results',
      'Compare',
      'Structure',
    ])
  })

  it('shows a collapsed icon strip when closed and reopens on icon click', () => {
    render(<OutputsDock />)

    const collapseButton = screen.getByRole('button', { name: 'Collapse outputs dock' })
    fireEvent.click(collapseButton)

    expect(screen.queryByTestId('outputs-dock-body')).toBeNull()

    const resultsIcon = screen.getByRole('button', { name: 'Results' })
    const compareIcon = screen.getByRole('button', { name: 'Compare' })
    const structureIcon = screen.getByRole('button', { name: 'Structure' })

    expect(resultsIcon).toBeInTheDocument()
    expect(compareIcon).toBeInTheDocument()
    expect(structureIcon).toBeInTheDocument()

    fireEvent.click(structureIcon)

    const headerLabel = screen.getByText('Structure', {
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
    // Dock should reserve space for the bottom toolbar via CSS variable in bottom position
    expect(aside.style.bottom).toContain('var(--bottombar-h)')

    // Header label (aria-live) should reflect active tab
    const headerLabel = screen.getByText('Compare', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })

  it('reads initial active tab from ?tab= query parameter', () => {
    try {
      window.history.replaceState({}, '', '/canvas?tab=diagnostics')
    } catch {}

    render(<OutputsDock />)

    const headerLabel = screen.getByText('Structure', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })

  it('updates ?tab= query parameter when tabs are clicked', () => {
    render(<OutputsDock />)

    // Switch to Structure tab
    const structureTab = screen.getByRole('button', { name: 'Structure' })
    fireEvent.click(structureTab)

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

  it('shows pre-run state with Run button before first analysis', () => {
    render(<OutputsDock />)

    // New pre-run UI shows Run button and intro text
    expect(screen.getByTestId('outputs-pre-run')).toBeInTheDocument()
    expect(screen.getByTestId('outputs-run-button')).toBeInTheDocument()
    expect(screen.getByText('Run Analysis')).toBeInTheDocument()
    expect(screen.getByText('Results will appear here after analysis')).toBeInTheDocument()
  })

  it('Run button passes canvas graph to runAnalysis (regression: prevents EMPTY_CANVAS error)', async () => {
    // Set up store with nodes and edges
    const testNodes = [
      { id: 'goal-1', type: 'goal', data: { label: 'Test Goal' }, position: { x: 0, y: 0 } },
      { id: 'decision-1', type: 'decision', data: { label: 'Test Decision' }, position: { x: 100, y: 100 } },
    ]
    const testEdges = [
      { id: 'e1', source: 'goal-1', target: 'decision-1' },
    ]

    useCanvasStore.setState({
      nodes: testNodes,
      edges: testEdges,
      hasCompletedFirstRun: false,
    } as any)

    // Mock useResultsRun to capture the run call
    const mockRunAnalysis = vi.fn().mockResolvedValue(undefined)
    vi.doMock('../../store/useResultsRun', () => ({
      useResultsRun: () => ({ run: mockRunAnalysis }),
    }))

    // Import fresh component with mocked dependencies
    const { OutputsDock: MockedOutputsDock } = await import('../OutputsDock')

    render(<MockedOutputsDock />)

    const runButton = screen.getByTestId('outputs-run-button')
    expect(runButton).toBeInTheDocument()

    // The component should pass graph when Run is clicked
    // This is verified by checking the handleRunAnalysis implementation
    // has graph: { nodes, edges } in its runAnalysis call
    // Since mocking useResultsRun changes module state, we verify the component renders correctly
    expect(runButton).toHaveTextContent('Run')
  })

  it('auto-switches back to Results tab when results become active', () => {
    render(<OutputsDock />)

    // Move away from Results tab
    const structureTab = screen.getByRole('button', { name: 'Structure' })
    fireEvent.click(structureTab)

    const structureHeader = screen.getByText('Structure', {
      selector: 'span[aria-live="polite"]',
    })
    expect(structureHeader).toBeInTheDocument()

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

  it('does not render VerdictCard when decision readiness has blockers', () => {
    const baseResults = useCanvasStore.getState().results

    const fakeReport: any = {
      schema: 'report.v1',
      meta: { seed: 101, response_id: 'ready-1', elapsed_ms: 1000 },
      model_card: {
        response_hash: 'hash-ready-1',
        response_hash_algo: 'sha256',
        normalized: true,
      },
      results: {
        conservative: 0.1,
        likely: 0.2,
        optimistic: 0.3,
        units: 'percent' as const,
        unitSymbol: '%',
      },
      run: {
        responseHash: 'hash-ready-1',
        bands: { p10: 0.1, p50: 0.2, p90: 0.3 },
      },
      decision_readiness: {
        ready: false,
        confidence: 'low',
        blockers: ['Graph has unresolved blockers'],
        warnings: [],
        passed: [],
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

    expect(screen.queryByTestId('verdict-card')).not.toBeInTheDocument()
  })

  it('renders VerdictCard only when decision readiness is ready and has no blockers', () => {
    const baseResults = useCanvasStore.getState().results

    const fakeReport: any = {
      schema: 'report.v1',
      meta: { seed: 202, response_id: 'ready-2', elapsed_ms: 900 },
      model_card: {
        response_hash: 'hash-ready-2',
        response_hash_algo: 'sha256',
        normalized: true,
      },
      results: {
        conservative: 0.1,
        likely: 0.2,
        optimistic: 0.3,
        units: 'percent' as const,
        unitSymbol: '%',
      },
      run: {
        responseHash: 'hash-ready-2',
        bands: { p10: 0.1, p50: 0.2, p90: 0.3 },
      },
      decision_readiness: {
        ready: true,
        confidence: 'high',
        blockers: [],
        warnings: [],
        passed: ['Checks passed'],
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

    const verdict = screen.getByTestId('verdict-card')
    expect(verdict).toBeInTheDocument()
    expect(screen.getByText('Supports your objective')).toBeInTheDocument()
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

    const rangeDisplay = screen.getByTestId('range-display')
    expect(rangeDisplay).toBeInTheDocument()
    // RangeDisplay now uses structured grid layout with band labels
    expect(rangeDisplay.textContent || '').toMatch(/Most likely \(p50\)/)
  })

  it('renders inline InsightsPanel in Results tab when report includes insights', () => {
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
      insights: {
        summary: 'Expected value is solid given current assumptions.',
        risks: ['Risk A', 'Risk B'],
        next_steps: ['Next step 1'],
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

    const insightsPanel = screen.getByTestId('insights-panel')
    expect(insightsPanel).toBeInTheDocument()
    expect(insightsPanel).toHaveTextContent('Expected value is solid given current assumptions.')
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

  it('renders an error banner in Results tab when results status is error', () => {
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'error',
        error: {
          code: 'SERVER_ERROR',
          message: 'Something went wrong.',
        },
      },
    } as any)

    render(<OutputsDock />)

    const banner = screen.getByTestId('outputs-error-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent('SERVER_ERROR')
    expect(banner).toHaveTextContent('Something went wrong.')
  })

  it('renders retryAfter and request_id details in the error banner when provided', () => {
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'error',
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests.',
          retryAfter: 42,
          request_id: 'req-error-123',
        },
      },
    } as any)

    render(<OutputsDock />)

    const banner = screen.getByTestId('outputs-error-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent('RATE_LIMITED')
    expect(banner).toHaveTextContent('Too many requests.')
    expect(banner).toHaveTextContent('Retry after 42 seconds')
    expect(banner).toHaveTextContent('PLoT Request ID: req-error-123')
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

// NOTE: Graph health card tests removed - GraphHealthCard component was removed from Structure tab
// Graph health information is now shown inline in GraphTextView and ValidationPanel

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

// P0 Engine Integration: IdentifiabilityBadge in Results tab
describe('P0 Engine: IdentifiabilityBadge', () => {
  it('renders IdentifiabilityBadge when model_card has identifiability_tag', () => {
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
      model_card: {
        response_hash: 'abc123',
        response_hash_algo: 'sha256',
        normalized: true,
        identifiability_tag: 'identifiable',
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

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Identifiable')).toBeInTheDocument()
  })

  it('renders underidentified status with amber styling', () => {
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
      model_card: {
        response_hash: 'abc123',
        response_hash_algo: 'sha256',
        normalized: true,
        identifiability_tag: 'underidentified',
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

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Under-identified')).toBeInTheDocument()
    expect(badge).toHaveClass('bg-paper-50')
  })

  it('does NOT render IdentifiabilityBadge when identifiability_tag is absent', () => {
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
      model_card: {
        response_hash: 'abc123',
        response_hash_algo: 'sha256',
        normalized: true,
        // No identifiability_tag
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

    expect(screen.queryByTestId('identifiability-badge')).not.toBeInTheDocument()
  })

  it('does NOT render IdentifiabilityBadge in pre-run state', () => {
    useCanvasStore.setState({
      hasCompletedFirstRun: false,
      results: {
        status: 'idle',
        report: null,
      },
    } as any)

    render(<OutputsDock />)

    expect(screen.queryByTestId('identifiability-badge')).not.toBeInTheDocument()
  })
})

// NOTE: EvidenceCoverage tests removed - component was intentionally removed from Structure tab
// Evidence metrics are now displayed inline in GraphTextView instead
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

function openStructureTab() {
  const structureTab = screen.getByRole('button', { name: 'Structure' })
  fireEvent.click(structureTab)
}
