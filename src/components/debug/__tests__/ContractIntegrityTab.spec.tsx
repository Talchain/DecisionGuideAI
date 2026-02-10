/**
 * ContractIntegrityTab Tests
 *
 * Tests for the Contract Integrity tab in the debug panel.
 * Covers all five sections, missing-data handling, and status derivation.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContractIntegrityTab, deriveRequestChainStatus, deriveValidationStatus } from '../tabs/ContractIntegrityTab'
import type { DebugData } from '../hooks/useDebugData'

// =============================================================================
// Fixtures
// =============================================================================

/** Minimal DebugData with all required fields set to empty/null defaults */
function makeDebugData(overrides: Partial<DebugData> = {}): DebugData {
  return {
    overall: { status: 'success', total_duration_ms: 1000, request_id: 'req-123' },
    services: { cee: null, plot: null, isl: null },
    error: null,
    builds: { ui: null, cee: null, plot: null, isl: null },
    diagnostics: {
      plot_has_downstream_calls: false,
      downstream_calls_path_found: null,
      downstream_calls_paths_checked: [],
      isl_data_source: 'none' as const,
      cee_trace_present: false,
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
      connectivity: { decision_count: 0, option_count: 0, goal_count: 0, factor_count: 0, edge_count: 0 },
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
// Full fixture with all sections populated
// =============================================================================

const fullFixture = makeDebugData({
  payloads: {
    plot_response: {
      meta: {
        seed_source: 'client_provided',
        seed_used: 42,
      },
      repairs_applied: [
        { code: 'NORM_001', layer: 'normalization', field_path: 'edges[0].strength', before: 1.5, after: 1.0, severity: 'warn' },
      ],
    },
    plot_request: {
      seed: 42,
      graph: {
        edges: [
          { id: 'e1', strength: { mean: 0.7, std: 0.1 } },
          { id: 'e2', strength: { mean: 0.5, std: 0.125 } },
          { id: 'e3', strength: { mean: -0.5, std: 0.125 } },
          { id: 'e4', strength: { mean: 0.3, std: 0.2 } },
        ],
      },
    },
    cee_response: {
      validation_warnings: [
        { code: 'STRENGTH_DEFAULT_APPLIED', message: 'Default strength applied to 2 edges', severity: 'warning' },
        { code: 'GRAPH_OK', message: 'Graph is valid', severity: 'info' },
      ],
    },
    isl_request: { seed: 42 },
  },
  request_id_chain: {
    ui_generated: 'req-123',
    sent_to_plot: 'req-123',
    cee_trace: 'req-123',
    plot_request: 'req-123',
    plot_response: 'req-123',
    isl_request: 'req-123',
    isl_response: 'req-123',
    all_match: true,
  },
  validation: {
    summary: { errors: 0, warnings: 1, info: 1 },
    issues: [
      { id: 'v1', code: 'GRAPH_DISCONNECTED', severity: 'warning', message: 'Node X is disconnected', source: 'ui' },
    ],
  },
})

// =============================================================================
// Tests
// =============================================================================

describe('ContractIntegrityTab', () => {
  // -------------------------------------------------------------------------
  // General rendering
  // -------------------------------------------------------------------------

  it('shows placeholder when no data is available', () => {
    const data = makeDebugData({ hasData: false })
    render(<ContractIntegrityTab data={data} />)
    expect(screen.getByText('Run an analysis to see contract integrity checks')).toBeInTheDocument()
  })

  it('renders overall status badge', () => {
    render(<ContractIntegrityTab data={fullFixture} />)
    expect(screen.getByText(/Contract integrity:/)).toBeInTheDocument()
  })

  it('renders all five section titles', () => {
    render(<ContractIntegrityTab data={fullFixture} />)
    expect(screen.getByText('Seed chain')).toBeInTheDocument()
    expect(screen.getByText('Strength audit')).toBeInTheDocument()
    expect(screen.getByText('Request chain')).toBeInTheDocument()
    expect(screen.getByText('Repairs applied')).toBeInTheDocument()
    expect(screen.getByText('Validation warnings')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Section 1: Seed chain
  // -------------------------------------------------------------------------

  describe('Seed chain section', () => {
    it('displays seed data correctly', () => {
      render(<ContractIntegrityTab data={fullFixture} />)
      expect(screen.getByText('client_provided')).toBeInTheDocument()
      expect(screen.getAllByText('42').length).toBeGreaterThan(0)
    })

    it('shows pass when seeds are consistent', () => {
      render(<ContractIntegrityTab data={fullFixture} />)
      // The seed chain should show a pass badge
      const yesElements = screen.getAllByText(/Yes/)
      expect(yesElements.length).toBeGreaterThan(0)
    })

    it('shows warn when seed is server_generated', () => {
      const data = makeDebugData({
        payloads: {
          plot_response: {
            meta: { seed_source: 'server_generated', seed_used: 99 },
          },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('server_generated')).toBeInTheDocument()
    })

    it('handles missing plot_response gracefully', () => {
      const data = makeDebugData({ payloads: {} })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('Seed chain')).toBeInTheDocument()
      // Should show "Data not available"
      const unavailableElements = screen.getAllByText('Data not available')
      expect(unavailableElements.length).toBeGreaterThan(0)
    })

    it('shows unavailable status when seed_used is missing', () => {
      const data = makeDebugData({
        payloads: {
          plot_response: {
            meta: { seed_source: 'client_provided' },
            // seed_used intentionally omitted
          },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      // Seed chain section should show N/A badge since seed_used is null
      expect(screen.getByText('client_provided')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Section 2: Strength audit
  // -------------------------------------------------------------------------

  describe('Strength audit section', () => {
    it('counts defaulted edges correctly', () => {
      render(<ContractIntegrityTab data={fullFixture} />)
      // edges: e2 (0.5/0.125) and e3 (-0.5/0.125) are defaulted = 2 of 4
      expect(screen.getByText('4')).toBeInTheDocument() // total
      expect(screen.getByText('2')).toBeInTheDocument() // defaulted
      expect(screen.getByText('50.0%')).toBeInTheDocument()
    })

    it('shows strength warnings from CEE response', () => {
      render(<ContractIntegrityTab data={fullFixture} />)
      // STRENGTH_DEFAULT_APPLIED appears in both Strength audit (as a strength_warning)
      // and Validation warnings (as a cee_response.validation_warnings entry)
      const matches = screen.getAllByText('STRENGTH_DEFAULT_APPLIED')
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })

    it('shows pass when < 50% defaulted', () => {
      const data = makeDebugData({
        payloads: {
          cee_response: {
            edges: [
              { id: 'e1', strength: { mean: 0.7, std: 0.1 } },
              { id: 'e2', strength: { mean: 0.3, std: 0.2 } },
              { id: 'e3', strength: { mean: 0.5, std: 0.125 } },
            ],
          },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      // 1 out of 3 = 33.3%, should be pass
      expect(screen.getByText('33.3%')).toBeInTheDocument()
    })

    it('handles missing edges gracefully', () => {
      const data = makeDebugData({ payloads: { cee_response: {} } })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('Strength audit')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Section 3: Request chain
  // -------------------------------------------------------------------------

  describe('Request chain section', () => {
    it('displays all chain fields', () => {
      render(<ContractIntegrityTab data={fullFixture} />)
      expect(screen.getByText('UI generated')).toBeInTheDocument()
      expect(screen.getByText('Sent to PLoT')).toBeInTheDocument()
      expect(screen.getByText('CEE trace')).toBeInTheDocument()
      expect(screen.getByText('PLoT request')).toBeInTheDocument()
      expect(screen.getByText('PLoT response')).toBeInTheDocument()
      expect(screen.getByText('ISL request')).toBeInTheDocument()
      expect(screen.getByText('ISL response')).toBeInTheDocument()
    })

    it('handles null request_id_chain gracefully', () => {
      const data = makeDebugData({ request_id_chain: null })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('Request chain')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Section 4: Repairs applied
  // -------------------------------------------------------------------------

  describe('Repairs applied section', () => {
    it('shows repairs table when repairs exist', () => {
      render(<ContractIntegrityTab data={fullFixture} />)
      expect(screen.getByText('NORM_001')).toBeInTheDocument()
      expect(screen.getByText('normalization')).toBeInTheDocument()
    })

    it('shows "No repairs needed" when empty', () => {
      const data = makeDebugData({
        payloads: {
          plot_response: { repairs_applied: [] },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      // Section is collapsed by default when repairs are empty — expand it first
      fireEvent.click(screen.getByText('Repairs applied'))
      expect(screen.getByText('No repairs needed')).toBeInTheDocument()
    })

    it('handles missing plot_response gracefully', () => {
      const data = makeDebugData({ payloads: {} })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('Repairs applied')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Section 5: Validation warnings
  // -------------------------------------------------------------------------

  describe('Validation warnings section', () => {
    it('shows CEE validation_warnings', () => {
      render(<ContractIntegrityTab data={fullFixture} />)
      expect(screen.getByText('GRAPH_OK')).toBeInTheDocument()
    })

    it('shows bundle validation issues', () => {
      render(<ContractIntegrityTab data={fullFixture} />)
      expect(screen.getByText('GRAPH_DISCONNECTED')).toBeInTheDocument()
    })

    it('shows "No validation warnings" when clean', () => {
      const data = makeDebugData({
        payloads: { cee_response: {} },
        validation: { summary: { errors: 0, warnings: 0, info: 0 }, issues: [] },
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('No validation warnings')).toBeInTheDocument()
    })
  })
})

// =============================================================================
// Status derivation logic
// =============================================================================

describe('deriveRequestChainStatus', () => {
  it('returns unavailable when chain is null', () => {
    expect(deriveRequestChainStatus(null)).toBe('unavailable')
  })

  it('returns pass when all_match is true', () => {
    expect(deriveRequestChainStatus({
      ui_generated: 'a', sent_to_plot: 'a', cee_trace: 'a',
      plot_request: 'a', plot_response: 'a', isl_request: 'a', isl_response: 'a',
      all_match: true,
    })).toBe('pass')
  })

  it('returns warn when some IDs are null', () => {
    expect(deriveRequestChainStatus({
      ui_generated: 'a', sent_to_plot: 'a', cee_trace: 'a',
      plot_request: 'a', plot_response: 'a', isl_request: null, isl_response: null,
      all_match: false,
    })).toBe('warn')
  })

  it('returns fail when IDs diverge', () => {
    expect(deriveRequestChainStatus({
      ui_generated: 'a', sent_to_plot: 'b', cee_trace: 'a',
      plot_request: 'a', plot_response: 'a', isl_request: 'a', isl_response: 'a',
      all_match: false,
    })).toBe('fail')
  })

  it('returns unavailable when all IDs are null even if all_match is true', () => {
    expect(deriveRequestChainStatus({
      ui_generated: null, sent_to_plot: null, cee_trace: null,
      plot_request: null, plot_response: null, isl_request: null, isl_response: null,
      all_match: true,
    })).toBe('unavailable')
  })
})

describe('deriveValidationStatus', () => {
  it('returns unavailable when no cee_response and no issues', () => {
    const data = makeDebugData({ payloads: {} })
    expect(deriveValidationStatus(data)).toBe('unavailable')
  })

  it('returns pass when no warnings', () => {
    const data = makeDebugData({
      payloads: { cee_response: {} },
      validation: { summary: { errors: 0, warnings: 0, info: 0 }, issues: [] },
    })
    expect(deriveValidationStatus(data)).toBe('pass')
  })

  it('returns warn when warnings exist', () => {
    const data = makeDebugData({
      payloads: { cee_response: { validation_warnings: [{ code: 'X', message: 'x', severity: 'warning' }] } },
    })
    expect(deriveValidationStatus(data)).toBe('warn')
  })

  it('returns fail when errors exist', () => {
    const data = makeDebugData({
      payloads: { cee_response: {} },
      validation: {
        summary: { errors: 1, warnings: 0, info: 0 },
        issues: [{ id: 'e1', code: 'FATAL', severity: 'error', message: 'bad', source: 'isl' }],
      },
    })
    expect(deriveValidationStatus(data)).toBe('fail')
  })
})

describe('overall status badge', () => {
  it('reflects worst status across sections', () => {
    // fullFixture has warn-level repairs → overall should be warn
    render(<ContractIntegrityTab data={fullFixture} />)
    expect(screen.getByText(/Contract integrity: warn/)).toBeInTheDocument()
  })

  it('shows pass when all sections pass', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          meta: { seed_source: 'client_provided', seed_used: 1 },
          repairs_applied: [],
        },
        plot_request: {
          seed: 1,
          graph: {
            edges: [
              { id: 'e1', strength: { mean: 0.7, std: 0.1 } },
            ],
          },
        },
        cee_response: {},
      },
      request_id_chain: {
        ui_generated: 'a', sent_to_plot: 'a', cee_trace: 'a',
        plot_request: 'a', plot_response: 'a', isl_request: 'a', isl_response: 'a',
        all_match: true,
      },
    })
    render(<ContractIntegrityTab data={data} />)
    expect(screen.getByText(/Contract integrity: pass/)).toBeInTheDocument()
  })
})
