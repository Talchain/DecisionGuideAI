 import { describe, it, expect, beforeEach, vi } from 'vitest'
 import '@testing-library/jest-dom/vitest'
 import { render, screen, fireEvent, act } from '@testing-library/react'
 import { OutputsDock } from '../OutputsDock'
 import { useCanvasStore } from '../../store'
 import { STORAGE_KEY as RUN_HISTORY_STORAGE_KEY, type StoredRun } from '../../store/runHistory'
 import { __resetTelemetryCounters, __getTelemetryCounters } from '../../../lib/telemetry'

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

  beforeEach(() => {
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
