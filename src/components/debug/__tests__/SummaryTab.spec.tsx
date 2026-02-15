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
