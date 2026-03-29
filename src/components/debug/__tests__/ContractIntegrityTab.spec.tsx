/**
 * ContractIntegrityTab Tests
 *
 * Tests for the Contract Integrity tab in the debug panel.
 * Covers all five sections, missing-data handling, status derivation,
 * structural edge exclusion, from_plot passthrough, and scoring.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContractIntegrityTab, deriveRequestChainStatus, deriveValidationStatus } from '../tabs/ContractIntegrityTab'
import type { DebugData, RequestIdChain } from '../hooks/useDebugData'
import { redactPayload } from '../../../utils/payloadRedaction'

// =============================================================================
// Fixtures
// =============================================================================

/** Build a well-typed RequestIdChain with from_plot passthrough */
function makeChain(overrides: {
  ui_generated?: string | null
  /** When true (default), from_plot is populated with IDs */
  plot_chain_present?: boolean
  ui?: string | null
  plot?: string | null
  isl?: string | null
  isl_echoed?: string | null
  cee_trace?: string | null
  all_match?: boolean
  chain_complete?: boolean
} = {}): RequestIdChain {
  const ui_generated = overrides.ui_generated ?? null
  const cee_trace = overrides.cee_trace ?? null
  const plot_chain_present = overrides.plot_chain_present ?? true
  const all_match = overrides.all_match ?? false
  const chain_complete = overrides.chain_complete ?? true

  return {
    ui_generated,
    from_plot: plot_chain_present
      ? {
          ui: overrides.ui ?? ui_generated,
          plot: overrides.plot ?? ui_generated,
          isl: overrides.isl ?? ui_generated,
          isl_echoed: overrides.isl_echoed ?? ui_generated,
          all_match,
          chain_complete,
        }
      : null,
    plot_chain_present,
    draft_trace: { cee_trace },
  }
}

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
      e_values_present: false,
      evpi_present: false,
      confidence_differentiated: false,
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
          { from: 'f1', to: 'f2', strength: { mean: 0.7, std: 0.1 } },
          { from: 'f2', to: 'f3', strength: { mean: 0.5, std: 0.125 } },
          { from: 'f3', to: 'f4', strength: { mean: -0.5, std: 0.125 } },
          { from: 'f1', to: 'f4', strength: { mean: 0.3, std: 0.2 } },
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
  request_id_chain: makeChain({
    ui_generated: 'req-123',
    ui: 'req-123',
    plot: 'req-123',
    isl: 'req-123',
    isl_echoed: 'req-123',
    cee_trace: 'req-123',
    all_match: true,
    chain_complete: true,
  }),
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
      const unavailableElements = screen.getAllByText('Data not available')
      expect(unavailableElements.length).toBeGreaterThan(0)
    })

    it('shows unavailable status when seed_used is missing', () => {
      const data = makeDebugData({
        payloads: {
          plot_response: {
            meta: { seed_source: 'client_provided' },
          },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('client_provided')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Section 2: Strength audit
  // -------------------------------------------------------------------------

  describe('Strength audit section', () => {
    it('counts defaulted causal edges correctly', () => {
      render(<ContractIntegrityTab data={fullFixture} />)
      // 4 causal edges (no node kind data → all causal), 2 defaulted (f2→f3 and f3→f4)
      expect(screen.getByText('4')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('50.0%')).toBeInTheDocument()
    })

    it('shows strength warnings from CEE response', () => {
      render(<ContractIntegrityTab data={fullFixture} />)
      const matches = screen.getAllByText('STRENGTH_DEFAULT_APPLIED')
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })

    it('shows pass when < 50% defaulted and no warnings', () => {
      const data = makeDebugData({
        payloads: {
          cee_response: {
            edges: [
              { from: 'f1', to: 'f2', strength: { mean: 0.7, std: 0.1 } },
              { from: 'f2', to: 'f3', strength: { mean: 0.3, std: 0.2 } },
              { from: 'f3', to: 'f4', strength: { mean: 0.5, std: 0.125 } },
            ],
          },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('33.3%')).toBeInTheDocument()
    })

    it('excludes structural edges (decision/option from-nodes) from default count', () => {
      const data = makeDebugData({
        payloads: {
          cee_response: {
            nodes: [
              { id: 'd1', kind: 'decision' },
              { id: 'o1', kind: 'option' },
              { id: 'f1', kind: 'factor' },
              { id: 'f2', kind: 'factor' },
              { id: 'f3', kind: 'factor' },
            ],
            edges: [
              // Structural wiring (from decision/option) — should be excluded
              { from: 'd1', to: 'o1', strength_mean: 0.5, strength_std: 0.125 },
              { from: 'o1', to: 'f1', strength_mean: 0.5, strength_std: 0.125 },
              // Causal edges (from factor)
              { from: 'f1', to: 'f2', strength_mean: 0.5, strength_std: 0.125 },  // defaulted
              { from: 'f2', to: 'f3', strength_mean: 0.7, strength_std: 0.1 },    // not defaulted
            ],
          },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      // Causal edges: 2 (f1→f2, f2→f3). Defaulted: 1 (f1→f2). Percentage: 50.0%
      expect(screen.getByText('Causal edges')).toBeInTheDocument()
      // 2 causal edges
      expect(screen.getByText('2')).toBeInTheDocument()
      // 1 defaulted
      expect(screen.getByText('1')).toBeInTheDocument()
      // Structural wiring excluded: 2
      expect(screen.getByText('Structural wiring excluded: 2')).toBeInTheDocument()
    })

    it('uses details.structural_edges_excluded from CEE warning when present', () => {
      const data = makeDebugData({
        payloads: {
          cee_response: {
            edges: [
              { from: 'f1', to: 'f2', strength_mean: 0.5, strength_std: 0.125 },
              { from: 'f2', to: 'f3', strength_mean: 0.7, strength_std: 0.1 },
            ],
            validation_warnings: [
              {
                code: 'STRENGTH_MEAN_DEFAULT_DOMINANT',
                message: '60% of causal edges use default',
                severity: 'warning',
                details: {
                  total_edges: 5,
                  structural_edges_excluded: 3,
                  defaulted_edge_ids: ['f1->f2', 'f4->f5', 'f6->f7'],
                },
              },
            ],
          },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      // Should use pre-computed values from details
      expect(screen.getByText('5')).toBeInTheDocument() // total_edges from details
      expect(screen.getByText('3')).toBeInTheDocument() // defaulted count from details.defaulted_edge_ids
      expect(screen.getByText('Structural wiring excluded: 3')).toBeInTheDocument()
    })

    it('falls back to local derivation when details only has total_edges (no structural_edges_excluded)', () => {
      const data = makeDebugData({
        payloads: {
          cee_response: {
            nodes: [
              { id: 'd1', kind: 'decision' },
              { id: 'f1', kind: 'factor' },
              { id: 'f2', kind: 'factor' },
            ],
            edges: [
              { from: 'd1', to: 'f1', strength_mean: 0.5, strength_std: 0.125 }, // structural
              { from: 'f1', to: 'f2', strength_mean: 0.5, strength_std: 0.125 }, // causal, defaulted
            ],
            validation_warnings: [
              {
                code: 'STRENGTH_DEFAULT_APPLIED',
                message: 'some defaults',
                severity: 'warning',
                details: {
                  total_edges: 10, // only total, no structural_edges_excluded
                },
              },
            ],
          },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      // Should use local derivation (1 causal edge, 1 structural) not precomputed total of 10
      // "Causal edges" stat box should show 1, but "1" appears multiple times — use structural line as proof
      expect(screen.getByText('Structural wiring excluded: 1')).toBeInTheDocument()
      // Precomputed total_edges=10 should NOT appear since structural_edges_excluded is missing
      expect(screen.queryByText('10')).not.toBeInTheDocument()
    })

    it('displays defaulted edge IDs as "from → to" format', () => {
      const data = makeDebugData({
        payloads: {
          cee_response: {
            edges: [
              { from: 'nodeA', to: 'nodeB', strength_mean: 0.5, strength_std: 0.125 },
            ],
          },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('nodeA \u2192 nodeB')).toBeInTheDocument()
    })

    it('handles missing edges gracefully', () => {
      const data = makeDebugData({ payloads: { cee_response: {} } })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('Strength audit')).toBeInTheDocument()
    })

    it('shows enrichment calls row with Pass when called_count is 1', () => {
      const data = makeDebugData({
        payloads: {
          cee_response: {
            edges: [{ from: 'f1', to: 'f2', strength_mean: 0.7, strength_std: 0.1 }],
          },
        },
        pipeline: {
          status: 'success',
          stages: [],
          connectivity: { decision_count: 0, option_count: 0, goal_count: 0, factor_count: 0, edge_count: 0 },
          enrich: { called_count: 1 },
        },
      })

      render(<ContractIntegrityTab data={data} />)

      expect(screen.getByText('Enrichment calls')).toBeInTheDocument()
      expect(screen.getByTestId('contract-integrity-enrichment-status')).toHaveTextContent('Pass')
    })

    it('shows enrichment calls row with Warn when called_count is greater than 1', () => {
      const data = makeDebugData({
        payloads: {
          cee_response: {
            edges: [{ from: 'f1', to: 'f2', strength_mean: 0.7, strength_std: 0.1 }],
          },
        },
        pipeline: {
          status: 'success',
          stages: [],
          connectivity: { decision_count: 0, option_count: 0, goal_count: 0, factor_count: 0, edge_count: 0 },
          enrich: { called_count: 2 },
        },
      })

      render(<ContractIntegrityTab data={data} />)

      expect(screen.getByText('Enrichment calls')).toBeInTheDocument()
      expect(screen.getByTestId('contract-integrity-enrichment-status')).toHaveTextContent('Warn')
    })

    it('shows enrichment calls row with N/A when called_count is absent', () => {
      const data = makeDebugData({
        payloads: {
          cee_response: {
            edges: [{ from: 'f1', to: 'f2', strength_mean: 0.7, strength_std: 0.1 }],
          },
        },
      })

      render(<ContractIntegrityTab data={data} />)

      expect(screen.getByText('Enrichment calls')).toBeInTheDocument()
      expect(screen.getByTestId('contract-integrity-enrichment-status')).toHaveTextContent('N/A')
    })
  })

  // -------------------------------------------------------------------------
  // Section 3: Request chain
  // -------------------------------------------------------------------------

  describe('Request chain section', () => {
    it('displays from_plot and draft-graph trace sub-sections', () => {
      render(<ContractIntegrityTab data={fullFixture} />)
      expect(screen.getByText('From PLoT')).toBeInTheDocument()
      expect(screen.getByText('UI generated')).toBeInTheDocument()
      expect(screen.getByText('UI (observed by PLoT)')).toBeInTheDocument()
      expect(screen.getByText('ISL echoed')).toBeInTheDocument()
      expect(screen.getByText(/Draft-graph trace/)).toBeInTheDocument()
      expect(screen.getByText('CEE trace')).toBeInTheDocument()
    })

    it('handles null request_id_chain gracefully', () => {
      const data = makeDebugData({ request_id_chain: null })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('Request chain')).toBeInTheDocument()
    })

    it('shows from_plot values when PLoT returns chain', () => {
      const data = makeDebugData({
        request_id_chain: makeChain({
          ui_generated: 'abc-123',
          ui: 'abc-123',
          plot: 'abc-123',
          isl: 'abc-123',
          isl_echoed: 'abc-123',
          all_match: true,
          chain_complete: true,
        }),
      })
      render(<ContractIntegrityTab data={data} />)
      // ui_generated + from_plot.ui + from_plot.plot + from_plot.isl + from_plot.isl_echoed = 5
      expect(screen.getAllByText('abc-123').length).toBeGreaterThanOrEqual(4)
    })

    it('shows from_plot values from _meta (passthrough)', () => {
      // The tab component reads data.request_id_chain which is already extracted.
      // _meta fallback is handled in useDebugData extraction. Here we verify rendering.
      const data = makeDebugData({
        request_id_chain: makeChain({
          ui_generated: 'def-456',
          ui: 'def-456',
          plot: 'def-456',
          isl: 'def-456',
          isl_echoed: 'def-456',
          all_match: true,
          chain_complete: true,
        }),
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getAllByText('def-456').length).toBeGreaterThanOrEqual(4)
    })

    it('shows hint when PLoT did not return a request_id_chain', () => {
      const data = makeDebugData({
        request_id_chain: makeChain({
          ui_generated: 'ghi-789',
          plot_chain_present: false,
        }),
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('ghi-789')).toBeInTheDocument()
      expect(screen.getByText('PLoT did not return a request ID chain')).toBeInTheDocument()
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
  // Section 4b: Model adjustments (CEE STRP/repair mutations)
  // -------------------------------------------------------------------------

  describe('Model adjustments section', () => {
    it('renders model adjustments when present in cee_response.analysis_ready', () => {
      const data = makeDebugData({
        payloads: {
          cee_response: {
            analysis_ready: {
              model_adjustments: [
                { type: 'strp_repair', target: 'edge_e1', detail: 'Restored dropped edge' },
                { type: 'category_infer', field: 'category', detail: 'Inferred controllable' },
              ],
            },
          },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('Model adjustments')).toBeInTheDocument()
      expect(screen.getByText('strp_repair')).toBeInTheDocument()
      expect(screen.getByText('category_infer')).toBeInTheDocument()
      expect(screen.getByText(/Restored dropped edge/)).toBeInTheDocument()
      expect(screen.getByText(/Inferred controllable/)).toBeInTheDocument()
    })

    it('does not render section when model_adjustments is absent', () => {
      const data = makeDebugData({
        payloads: {
          cee_response: {
            analysis_ready: {
              options: [],
              goal_node_id: 'g1',
            },
          },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.queryByText('Model adjustments')).not.toBeInTheDocument()
    })

    it('does not render section when model_adjustments is empty', () => {
      const data = makeDebugData({
        payloads: {
          cee_response: {
            analysis_ready: {
              model_adjustments: [],
            },
          },
        },
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.queryByText('Model adjustments')).not.toBeInTheDocument()
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

  it('returns pass when from_plot.all_match and chain_complete are true', () => {
    expect(deriveRequestChainStatus(makeChain({
      ui_generated: 'a', all_match: true, chain_complete: true,
    }))).toBe('pass')
  })

  it('returns warn when chain_complete is false', () => {
    expect(deriveRequestChainStatus(makeChain({
      ui_generated: 'a', all_match: true, chain_complete: false,
    }))).toBe('warn')
  })

  it('returns fail when from_plot.all_match is false', () => {
    expect(deriveRequestChainStatus(makeChain({
      ui_generated: 'a', all_match: false, chain_complete: true,
    }))).toBe('fail')
  })

  it('returns unavailable when plot_chain_present is false (draft flow)', () => {
    expect(deriveRequestChainStatus(makeChain({
      ui_generated: 'a', plot_chain_present: false,
    }))).toBe('unavailable')
  })

  it('CEE trace mismatch does NOT affect chain status', () => {
    const chain = makeChain({
      ui_generated: 'a',
      cee_trace: 'different-cee-id',
      all_match: true,
      chain_complete: true,
    })
    expect(deriveRequestChainStatus(chain)).toBe('pass')
  })

  it('from_plot.all_match false causes fail even when draft trace matches', () => {
    const chain = makeChain({
      ui_generated: 'a',
      cee_trace: 'a',
      all_match: false,
      chain_complete: true,
    })
    expect(deriveRequestChainStatus(chain)).toBe('fail')
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

// =============================================================================
// Overall status badge
// =============================================================================

describe('overall status badge', () => {
  it('reflects worst status across sections', () => {
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
              { from: 'f1', to: 'f2', strength: { mean: 0.7, std: 0.1 } },
            ],
          },
        },
        cee_response: {},
      },
      request_id_chain: makeChain({
        ui_generated: 'a', all_match: true, chain_complete: true,
      }),
    })
    render(<ContractIntegrityTab data={data} />)
    expect(screen.getByText(/Contract integrity: pass/)).toBeInTheDocument()
  })

  it('CEE trace mismatch does NOT cause overall Contract Integrity fail', () => {
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
              { from: 'f1', to: 'f2', strength: { mean: 0.7, std: 0.1 } },
            ],
          },
        },
        cee_response: {},
      },
      request_id_chain: makeChain({
        ui_generated: 'a',
        cee_trace: 'completely-different-id',
        all_match: true,
        chain_complete: true,
      }),
    })
    render(<ContractIntegrityTab data={data} />)
    // CEE trace is different but from_plot chain is fine → should be pass
    expect(screen.getByText(/Contract integrity: pass/)).toBeInTheDocument()
  })

  it('from_plot.all_match false DOES cause overall fail', () => {
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
              { from: 'f1', to: 'f2', strength: { mean: 0.7, std: 0.1 } },
            ],
          },
        },
        cee_response: {},
      },
      request_id_chain: makeChain({
        ui_generated: 'a',
        all_match: false,
        chain_complete: true,
      }),
    })
    render(<ContractIntegrityTab data={data} />)
    expect(screen.getByText(/Contract integrity: fail/)).toBeInTheDocument()
  })

  it('validation warnings (STRENGTH_MEAN_DEFAULT_DOMINANT) produce overall "warn" badge, not "fail"', () => {
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
              { from: 'f1', to: 'f2', strength: { mean: 0.5, std: 0.125 } },
            ],
          },
        },
        cee_response: {
          validation_warnings: [
            { code: 'STRENGTH_MEAN_DEFAULT_DOMINANT', message: '100% defaulted', severity: 'warning' },
          ],
        },
      },
      request_id_chain: makeChain({
        ui_generated: 'a', all_match: true, chain_complete: true,
      }),
    })
    render(<ContractIntegrityTab data={data} />)
    // Strength audit has 100% defaulted + STRENGTH_MEAN_DEFAULT_DOMINANT → warn, not fail
    expect(screen.getByText(/Contract integrity: warn/)).toBeInTheDocument()
  })
})

// =============================================================================
// Bundle completeness indicator
// =============================================================================

describe('bundle completeness indicator', () => {
  it('shows "Bundle complete" when plot_request, plot_response, isl_response, and request_id are present', () => {
    const data = makeDebugData({
      payloads: {
        plot_request: { seed: 1 },
        plot_response: { meta: {} },
        isl_response: { options: [] },
      },
      overall: { status: 'success', total_duration_ms: 500, request_id: 'req-abc' },
    })
    render(<ContractIntegrityTab data={data} />)
    const el = screen.getByTestId('bundle-completeness')
    expect(el.textContent).toMatch(/Bundle complete/)
  })

  it('shows "Bundle incomplete" with missing items when payloads are empty', () => {
    const data = makeDebugData({
      payloads: {},
      overall: { status: 'success', total_duration_ms: 500, request_id: null },
    })
    render(<ContractIntegrityTab data={data} />)
    const el = screen.getByTestId('bundle-completeness')
    expect(el.textContent).toMatch(/Bundle incomplete/)
    expect(el.textContent).toMatch(/PLoT request/)
    expect(el.textContent).toMatch(/PLoT response/)
    expect(el.textContent).toMatch(/ISL response/)
    expect(el.textContent).toMatch(/Request ID/)
  })

  it('does NOT affect overall contract integrity status', () => {
    // Missing isl_response but other sections all pass → overall should still be pass
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
              { from: 'f1', to: 'f2', strength: { mean: 0.7, std: 0.1 } },
            ],
          },
        },
        cee_response: {},
        // isl_response intentionally missing
      },
      request_id_chain: makeChain({
        ui_generated: 'a', all_match: true, chain_complete: true,
      }),
    })
    render(<ContractIntegrityTab data={data} />)
    // Bundle shows incomplete
    const bundle = screen.getByTestId('bundle-completeness')
    expect(bundle.textContent).toMatch(/Bundle incomplete/)
    // But overall status is still pass (bundle is informational only)
    expect(screen.getByText(/Contract integrity: pass/)).toBeInTheDocument()
  })
})

// =============================================================================
// Redaction: llm_raw.text exemption
// =============================================================================

describe('llm_raw.text redaction exemption', () => {
  it('does not truncate text key when neverTruncateKeys includes "text"', () => {
    const longText = 'A'.repeat(5000) // 5000 chars, well above max_string_length: 1000
    const payload = {
      pipeline: {
        llm_raw: {
          text: longText,
          model: 'gpt-4',
        },
      },
    }

    const redacted = redactPayload(payload, {
      maxStringLength: 1000,
      maxDepth: 8,
      neverTruncateKeys: ['text'],
    }) as Record<string, unknown>

    const pipeline = redacted.pipeline as Record<string, unknown>
    const llmRaw = pipeline.llm_raw as Record<string, unknown>
    // text should be preserved in full (not truncated to 1000)
    expect(typeof llmRaw.text).toBe('string')
    expect((llmRaw.text as string).length).toBe(5000)
    expect(llmRaw.text).toBe(longText)
  })

  it('still truncates non-exempt string keys', () => {
    const payload = {
      pipeline: {
        llm_raw: {
          text: 'A'.repeat(5000),
          some_other_field: 'B'.repeat(2000),
        },
      },
    }

    const redacted = redactPayload(payload, {
      maxStringLength: 1000,
      maxDepth: 8,
      neverTruncateKeys: ['text'],
    }) as Record<string, unknown>

    const pipeline = redacted.pipeline as Record<string, unknown>
    const llmRaw = pipeline.llm_raw as Record<string, unknown>
    // text preserved, other field truncated
    expect((llmRaw.text as string).length).toBe(5000)
    expect((llmRaw.some_other_field as string).length).toBeLessThan(2000)
    expect((llmRaw.some_other_field as string)).toContain('truncated_by: bundle_redaction')
  })
})

// =============================================================================
// Repairs applied section (observability audit)
// =============================================================================

describe('Repairs applied section', () => {
  it('shows pass badge when repairs_applied is empty array', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: { repairs_applied: [], analysis_status: 'computed' },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const section = screen.getByTestId('repairs-applied-section')
    // Section is collapsed when empty — check badge text
    expect(section).toHaveTextContent('Pass')
    // Expand to verify empty state message
    fireEvent.click(screen.getAllByText('Repairs applied')[0])
    expect(section).toHaveTextContent('No repairs needed')
  })

  it('shows warn badge and table rows when repairs are populated', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          repairs_applied: [
            { code: 'NORM_001', layer: 'normalization', field_path: 'edges[0].strength', before: 1.5, after: 1.0, severity: 'warn' },
          ],
        },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    expect(screen.getByText('NORM_001')).toBeInTheDocument()
    expect(screen.getByText('normalization')).toBeInTheDocument()
  })

  it('shows unavailable when plot_response is missing', () => {
    const data = makeDebugData({ payloads: {} })
    render(<ContractIntegrityTab data={data} />)
    const section = screen.getByTestId('repairs-applied-section')
    expect(section).toHaveTextContent('N/A')
    // Expand to verify content
    fireEvent.click(screen.getAllByText('Repairs applied')[0])
    expect(section).toHaveTextContent('Data not available')
  })

  it('renders constraint PU injection sub-row', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          repairs_applied: [
            { type: 'constraint_parameter_injection', node_id: 'factor_revenue', value: 500, source: 'goal_constraint' },
          ],
        },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const injectionRow = screen.getByTestId('constraint-pu-injection')
    expect(injectionRow).toHaveTextContent('factor_revenue')
    expect(injectionRow).toHaveTextContent('Constraint PU injected')
  })
})

// =============================================================================
// Constraint pipeline section
// =============================================================================

describe('Constraint pipeline section', () => {
  it('shows pass badge when constraints_status is computed', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          constraints_status: 'computed',
          _meta: { filtered_constraints: [], constraint_sources: {} },
        },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const section = screen.getByTestId('constraint-pipeline-section')
    expect(section).toHaveTextContent('Pass')
    // Expand to verify content
    fireEvent.click(screen.getByText('Constraint pipeline'))
    expect(section).toHaveTextContent('computed')
  })

  it('shows filtered constraints count when present', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          constraints_status: 'computed',
          _meta: {
            filtered_constraints: [
              { constraint_id: 'c1', reason: 'duplicate' },
              { constraint_id: 'c2', reason: 'invalid' },
            ],
            constraint_sources: {},
          },
        },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    // Expand section
    fireEvent.click(screen.getByText('Constraint pipeline'))
    const section = screen.getByTestId('constraint-pipeline-section')
    expect(section).toHaveTextContent('2 constraints filtered')
  })

  it('shows unavailable when constraints_status is missing', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: { analysis_status: 'computed' },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const section = screen.getByTestId('constraint-pipeline-section')
    // Expand section
    fireEvent.click(screen.getByText('Constraint pipeline'))
    expect(section).toHaveTextContent('No constraints in this run')
  })
})

// =============================================================================
// Decision review section
// =============================================================================

describe('Decision review section', () => {
  it('maps complete status with no warnings to pass "Complete"', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          review_status: 'complete',
          review_warnings: [],
        },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const section = screen.getByTestId('decision-review-section')
    expect(section).toHaveTextContent('Pass')
    // Expand to see label
    fireEvent.click(screen.getByText('Decision review'))
    expect(section).toHaveTextContent('Complete')
    // Ensure it doesn't say "Complete with warnings"
    expect(section).not.toHaveTextContent('Complete with warnings')
  })

  it('maps complete with warnings to warn "Complete with warnings"', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          review_status: 'complete',
          review_warnings: ['UNGROUNDED_NUMBER', 'MISSING_BRIEF_EVIDENCE'],
        },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const section = screen.getByTestId('decision-review-section')
    expect(section).toHaveTextContent('Complete with warnings')
    expect(section).toHaveTextContent('UNGROUNDED_NUMBER')
    expect(section).toHaveTextContent('MISSING_BRIEF_EVIDENCE')
  })

  it('maps failed status to fail badge', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          review_status: 'failed',
          review_failure_codes: ['MODIFIED_VALUES'],
        },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const section = screen.getByTestId('decision-review-section')
    expect(section).toHaveTextContent('Failed')
    expect(section).toHaveTextContent('MODIFIED_VALUES')
  })

  it('shows unavailable "Not run" when review_status is absent', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: { analysis_status: 'computed' },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const section = screen.getByTestId('decision-review-section')
    expect(section).toHaveTextContent('N/A')
    // Expand to see content
    fireEvent.click(screen.getByText('Decision review'))
    expect(section).toHaveTextContent('Not run')
  })

  it('shows human-readable explanation for known warning codes', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          review_status: 'complete',
          review_warnings: ['UNGROUNDED_NUMBER'],
        },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    expect(screen.getByText('Number not traceable to brief')).toBeInTheDocument()
  })

  it('shows "(unknown code)" fallback for unrecognised warning codes', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          review_status: 'complete',
          review_warnings: ['TOTALLY_NEW_CODE'],
        },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    expect(screen.getByText('(unknown code)')).toBeInTheDocument()
    expect(screen.getByText('TOTALLY_NEW_CODE')).toBeInTheDocument()
  })

  it('normalises mixed-case review_status to lowercase match', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          review_status: 'Complete',
          review_warnings: [],
        },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const section = screen.getByTestId('decision-review-section')
    expect(section).toHaveTextContent('Pass')
    fireEvent.click(screen.getByText('Decision review'))
    expect(section).toHaveTextContent('Complete')
    expect(section).not.toHaveTextContent('Not run')
  })

  it('normalises whitespace-padded review_status', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          review_status: '  failed  ',
          review_failure_codes: [],
        },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const section = screen.getByTestId('decision-review-section')
    expect(section).toHaveTextContent('Failed')
  })
})

// =============================================================================
// Critiques section
// =============================================================================

describe('Critiques section', () => {
  it('shows pass badge when critiques is empty', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: { analysis_status: 'computed', critiques: [] },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const section = screen.getByTestId('critiques-section')
    expect(section).toHaveTextContent('Pass')
    // Expand to see content
    fireEvent.click(screen.getByText('Critiques'))
    expect(section).toHaveTextContent('No critiques')
  })

  it('shows warn with severity pills when critiques are populated', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          critiques: [
            { code: 'LOW_DATA', severity: 'warning', message: 'Insufficient data for factor X' },
          ],
        },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const section = screen.getByTestId('critiques-section')
    expect(section).toHaveTextContent('LOW_DATA')
    expect(section).toHaveTextContent('Insufficient data for factor X')
  })
})

// =============================================================================
// Overall status aggregation includes new sections
// =============================================================================

describe('Overall status with new sections', () => {
  it('propagates fail from decision review to overall status', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          meta: { seed_source: 'client_provided', seed_used: 42 },
          repairs_applied: [],
          review_status: 'failed',
          review_failure_codes: ['MODIFIED_VALUES'],
          critiques: [],
        },
        plot_request: { seed: 42, graph: { edges: [] } },
        isl_request: { seed: 42 },
      },
      request_id_chain: makeChain({ ui_generated: 'req-1', all_match: true, chain_complete: true }),
    })
    render(<ContractIntegrityTab data={data} />)
    // Overall should show fail because decision review is fail
    expect(screen.getByText(/Contract integrity: fail/i)).toBeInTheDocument()
  })
})

// =============================================================================
// Optional field coverage display
// =============================================================================

describe('Optional field coverage in CIL tab', () => {
  it('displays optional field coverage with partial fields', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: {
          analysis_status: 'computed',
          repairs_applied: [],
          critiques: [],
        },
        plot_request: { seed: 42, graph: { edges: [] } },
        isl_response: { option_comparison: [] },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const coverage = screen.getByTestId('optional-field-coverage')
    expect(coverage).toHaveTextContent('Optional fields: 2/4 present')
    expect(coverage).toHaveTextContent('Repairs applied')
    expect(coverage).toHaveTextContent('Critiques')
  })

  it('displays all-absent optional fields', () => {
    const data = makeDebugData({
      payloads: {
        plot_response: { analysis_status: 'computed' },
        plot_request: { seed: 42, graph: { edges: [] } },
        isl_response: { option_comparison: [] },
      },
    })
    render(<ContractIntegrityTab data={data} />)
    const coverage = screen.getByTestId('optional-field-coverage')
    expect(coverage).toHaveTextContent('Optional fields: 0/4 present')
  })
})
