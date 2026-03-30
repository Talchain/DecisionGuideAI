import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryTab } from '../tabs/SummaryTab'
import type { DebugData } from '../hooks/useDebugData'

function makeDebugData(overrides: Partial<DebugData> = {}): DebugData {
  return {
    overall: { status: 'success', total_duration_ms: 1000, request_id: 'req-123' },
    services: {
      cee: { name: 'CEE', status: 200, success: true, duration_ms: 120, endpoint: '/bff/cee/draft-graph' },
      plot: { name: 'PLoT', status: 200, success: true, duration_ms: 150, endpoint: '/bff/plot/v2/run' },
      isl: { name: 'ISL', status: 200, success: true, duration_ms: 90, endpoint: '/isl/simulate' },
    },
    error: null,
    builds: { ui: 'test', cee: 'test', plot: 'test', isl: 'test' },
    diagnostics: {
      plot_has_downstream_calls: true,
      downstream_calls_path_found: null,
      downstream_calls_paths_checked: [],
      isl_data_source: 'none',
      cee_trace_present: true,
      cee_degraded: false,
      llm_raw_available: false,
      llm_raw_path_found: null,
      e_values_present: false,
      evpi_present: false,
      confidence_differentiated: false,
      confidence_unique_values: [],
      confidence_source_bootstrap: false,
      intercept_populated: false,
      epsilon_std_present: false,
      response_hash_present: false,
      mca_computed: false,
    },
    ceeTrace: null,
    corrections: [],
    correctionsSummary: null,
    pipeline: {
      status: 'success',
      stages: [],
      connectivity: { decision_count: 1, option_count: 2, goal_count: 1, factor_count: 2, edge_count: 3 },
    },
    payloads: {},
    gates: [],
    validation: { summary: { errors: 0, warnings: 0, info: 0 }, issues: [] },
    winningOption: null,
    robustness: { status: 'unavailable', stability: null, context_label: 'N/A', description: '' },
    hasData: true,
    orchestrator: null,
    v12_4_checks: null,
    request_id_chain: null,
    feature_flags_at_request: null,
    timing: null,
    schema_versions: null,
    cee_observability: null,
    m1_coaching: null,
    m2_review: null,
    cee_downstream: null,
    cee_operations: null,
    ...overrides,
  }
}

describe('SummaryTab pipeline path pill', () => {
  it('shows Unified pipeline when pipeline path is unified', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
        cee_provenance: { pipeline_path: 'unified' },
      },
    })

    render(<SummaryTab data={data} />)

    expect(screen.getByTestId('summary-pipeline-path-pill')).toHaveTextContent('Unified pipeline')
  })

  it('shows Legacy (A) when pipeline path is A', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
        cee_provenance: { pipeline_path: 'A' },
      },
    })

    render(<SummaryTab data={data} />)

    expect(screen.getByTestId('summary-pipeline-path-pill')).toHaveTextContent('Legacy (A)')
  })

  it('shows Unknown pipeline when pipeline path is absent', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
      },
    })

    render(<SummaryTab data={data} />)

    expect(screen.getByTestId('summary-pipeline-path-pill')).toHaveTextContent('Unknown pipeline')
  })
})

// =============================================================================
// Timeout budget indicator
// =============================================================================

describe('SummaryTab timeout budget', () => {
  it('renders timeout budget section when services have duration_ms', () => {
    const data = makeDebugData()
    render(<SummaryTab data={data} />)
    expect(screen.getByTestId('timeout-budget-section')).toBeInTheDocument()
  })

  it('shows green color for budget usage under 80%', () => {
    const data = makeDebugData({
      services: {
        cee: { name: 'CEE', status: 200, success: true, duration_ms: 10000, endpoint: '/bff/cee/draft-graph' },
        plot: null,
        isl: null,
      },
    })
    render(<SummaryTab data={data} />)
    // 10000 / 120000 = 8.3% — green (#16a34a → rgb(22, 163, 74))
    const bar = screen.getByTestId('budget-bar-cee')
    expect(bar.style.background).toBe('rgb(22, 163, 74)')
  })

  it('shows amber color for budget usage between 80% and 95%', () => {
    const data = makeDebugData({
      services: {
        cee: null,
        plot: { name: 'PLoT', status: 200, success: true, duration_ms: 25000, endpoint: '/bff/plot/v2/run' },
        isl: null,
      },
    })
    render(<SummaryTab data={data} />)
    // 25000 / 30000 = 83% — amber (#d97706 → rgb(217, 119, 6))
    const bar = screen.getByTestId('budget-bar-plot')
    expect(bar.style.background).toBe('rgb(217, 119, 6)')
  })

  it('shows red color for budget usage over 95%', () => {
    const data = makeDebugData({
      services: {
        cee: null,
        plot: { name: 'PLoT', status: 200, success: true, duration_ms: 29000, endpoint: '/bff/plot/v2/run' },
        isl: null,
      },
    })
    render(<SummaryTab data={data} />)
    // 29000 / 30000 = 96.7% — red (#dc2626 → rgb(220, 38, 38))
    const bar = screen.getByTestId('budget-bar-plot')
    expect(bar.style.background).toBe('rgb(220, 38, 38)')
  })

  it('bar is clamped at 100% width but text shows actual percentage for overbudget', () => {
    const data = makeDebugData({
      services: {
        cee: null,
        plot: { name: 'PLoT', status: 200, success: true, duration_ms: 35000, endpoint: '/bff/plot/v2/run' },
        isl: null,
      },
    })
    render(<SummaryTab data={data} />)
    // 35000 / 30000 = 117% — bar clamped at 100%
    const bar = screen.getByTestId('budget-bar-plot')
    expect(bar.style.width).toBe('100%')
    // Text should show "117%"
    expect(screen.getByTestId('timeout-budget-section')).toHaveTextContent('117%')
  })

  it('hides timeout budget section when no service data', () => {
    const data = makeDebugData({
      services: { cee: null, plot: null, isl: null },
    })
    render(<SummaryTab data={data} />)
    expect(screen.queryByTestId('timeout-budget-section')).not.toBeInTheDocument()
  })
})

// =============================================================================
// Constraint status badge
// =============================================================================

describe('SummaryTab constraint status badge', () => {
  it('renders constraint badge when constraints_status present in plot response', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: { analysis_status: 'computed', constraints_status: 'computed' },
      },
    })
    render(<SummaryTab data={data} />)
    expect(screen.getByText('Computed')).toBeInTheDocument()
  })

  it('does not render constraint badge when constraints_status absent', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: { analysis_status: 'computed' },
      },
    })
    render(<SummaryTab data={data} />)
    // "Constraints" label should not appear since no constraints_status
    const allText = document.body.textContent ?? ''
    // Check there's no "Constraints" KPI card (but allow "Constraint" in other contexts)
    expect(screen.queryByText('Constraints')).not.toBeInTheDocument()
  })
})

// =============================================================================
// Review status badge
// =============================================================================

describe('SummaryTab review status badge', () => {
  it('renders review badge showing Complete for success status', () => {
    const data = makeDebugData({
      m2_review: {
        status: 'success',
        skip_reason: null,
        duration_ms: 5000,
        headline: 'Test',
        bullets_count: 3,
        bias_insights_count: 1,
        error: null,
        raw_response: null,
      },
    })
    render(<SummaryTab data={data} />)
    // "Review" label should be present as a KPI card
    expect(screen.getByText('Review')).toBeInTheDocument()
    // The value should be "Complete" — use getAllByText since "Complete" may appear in chain too
    const completeElements = screen.getAllByText('Complete')
    expect(completeElements.length).toBeGreaterThan(0)
  })
})
