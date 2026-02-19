/**
 * PipelineTab Tests — Pipeline observability audit
 *
 * Tests for the 4 new observability sections:
 * - Pipeline path indicator
 * - Enrichment call count
 * - CEE repair summary
 * - STRP mutations
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PipelineTab } from '../tabs/PipelineTab'
import type { DebugData } from '../hooks/useDebugData'

// =============================================================================
// Fixtures
// =============================================================================

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
      isl_data_source: 'none' as const,
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

// =============================================================================
// Pipeline path indicator
// =============================================================================

describe('Pipeline path indicator', () => {
  it('renders stages from cee_provenance.pipeline_path', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
        cee_provenance: { pipeline_path: 'cee_v3 → enrich → repair → plot_v2' },
      },
    })
    render(<PipelineTab data={data} />)
    const section = screen.getByTestId('pipeline-path-indicator')
    expect(section).toHaveTextContent('cee_v3')
    expect(section).toHaveTextContent('enrich')
    expect(section).toHaveTextContent('repair')
    expect(section).toHaveTextContent('plot_v2')
  })

  it('derives fallback path from field presence', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
        enrich: { called_count: 1 },
        repair: { applied: [] },
      },
    })
    render(<PipelineTab data={data} />)
    const section = screen.getByTestId('pipeline-path-indicator')
    expect(section).toHaveTextContent('cee')
    expect(section).toHaveTextContent('enrich')
    expect(section).toHaveTextContent('repair')
    expect(section).toHaveTextContent('plot_v2')
  })

  it('shows minimal path when no trace data', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
      },
    })
    render(<PipelineTab data={data} />)
    const section = screen.getByTestId('pipeline-path-indicator')
    expect(section).toHaveTextContent('cee')
    expect(section).toHaveTextContent('plot_v2')
  })

  it('splits on -> delimiter without spaces', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
        cee_provenance: { pipeline_path: 'cee_v3->enrich->plot_v2' },
      },
    })
    render(<PipelineTab data={data} />)
    const section = screen.getByTestId('pipeline-path-indicator')
    expect(section).toHaveTextContent('cee_v3')
    expect(section).toHaveTextContent('enrich')
    expect(section).toHaveTextContent('plot_v2')
  })

  it('splits on → delimiter without spaces', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
        cee_provenance: { pipeline_path: 'cee_v3→enrich→plot_v2' },
      },
    })
    render(<PipelineTab data={data} />)
    const section = screen.getByTestId('pipeline-path-indicator')
    expect(section).toHaveTextContent('cee_v3')
    expect(section).toHaveTextContent('enrich')
    expect(section).toHaveTextContent('plot_v2')
  })
})

// =============================================================================
// Enrichment section
// =============================================================================

describe('Enrichment section', () => {
  it('displays count and mode when present', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
        enrich: { called_count: 1, extraction_mode: 'llm', factors_added: 3 },
      },
    })
    render(<PipelineTab data={data} />)
    const section = screen.getByTestId('enrichment-section')
    expect(section).toHaveTextContent('1')
    expect(section).toHaveTextContent('llm')
    expect(section).toHaveTextContent('3')
  })

  it('hides when enrich is missing', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
      },
    })
    render(<PipelineTab data={data} />)
    expect(screen.queryByTestId('enrichment-section')).not.toBeInTheDocument()
  })
})

// =============================================================================
// CEE repair summary
// =============================================================================

describe('CEE repair summary', () => {
  it('shows applied list', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
        repair: {
          applied: [{ field: 'edges[0].strength', from: 1.5, to: 1.0, reason: 'normalization' }],
        },
      },
    })
    render(<PipelineTab data={data} />)
    const section = screen.getByTestId('cee-repair-summary')
    expect(section).toHaveTextContent('edges[0].strength')
    expect(section).toHaveTextContent('normalization')
  })

  it('shows skipped list', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
        repair: {
          skipped: ['field_y', 'field_z'],
        },
      },
    })
    render(<PipelineTab data={data} />)
    const section = screen.getByTestId('cee-repair-summary')
    expect(section).toHaveTextContent('field_y')
    expect(section).toHaveTextContent('field_z')
  })

  it('shows empty state', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
        repair: {},
      },
    })
    render(<PipelineTab data={data} />)
    const section = screen.getByTestId('cee-repair-summary')
    expect(section).toHaveTextContent('No CEE repairs applied')
  })
})

// =============================================================================
// STRP mutations
// =============================================================================

describe('STRP mutations', () => {
  it('shows mutations list', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
        strp: {
          mutations: [{ path: '/nodes/0/observed_state/std', action: 'replace', reason: 'std floor' }],
        },
      },
    })
    render(<PipelineTab data={data} />)
    const section = screen.getByTestId('strp-mutations')
    expect(section).toHaveTextContent('/nodes/0/observed_state/std')
    expect(section).toHaveTextContent('replace')
    expect(section).toHaveTextContent('std floor')
  })

  it('shows empty state', () => {
    const data = makeDebugData({
      pipeline: {
        status: 'success',
        stages: [],
        strp: {},
      },
    })
    render(<PipelineTab data={data} />)
    const section = screen.getByTestId('strp-mutations')
    expect(section).toHaveTextContent('No STRP mutations')
  })
})
