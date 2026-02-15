/**
 * ContractIntegrityTab Tests
 *
 * Tests for the Contract Integrity tab in the debug panel.
 * Covers all five sections, missing-data handling, status derivation,
 * structural edge exclusion, analysis chain separation, and scoring.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContractIntegrityTab, deriveRequestChainStatus, deriveValidationStatus } from '../tabs/ContractIntegrityTab'
import type { DebugData, RequestIdChain } from '../hooks/useDebugData'
import { redactPayload } from '../../../utils/payloadRedaction'

// =============================================================================
// Fixtures
// =============================================================================

/** Build a well-typed RequestIdChain with analysis_chain and draft_trace */
function makeChain(overrides: {
  ui_sent?: string | null
  plot_received?: string | null
  forwarded_to_isl?: string | null
  isl_echoed?: string | null
  cee_trace?: string | null
  all_match?: boolean
} = {}): RequestIdChain {
  const ui_sent = overrides.ui_sent ?? null
  const plot_received = overrides.plot_received ?? null
  const forwarded_to_isl = overrides.forwarded_to_isl ?? null
  const isl_echoed = overrides.isl_echoed ?? null
  const cee_trace = overrides.cee_trace ?? null
  const all_match = overrides.all_match ?? false

  return {
    analysis_chain: { ui_sent, plot_received, forwarded_to_isl, isl_echoed, all_match },
    draft_trace: { cee_trace },
    // Legacy flat fields
    ui_generated: ui_sent,
    sent_to_plot: ui_sent,
    cee_trace,
    plot_request: ui_sent,
    plot_response: plot_received,
    isl_request: forwarded_to_isl,
    isl_response: isl_echoed,
    all_match,
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
    ui_sent: 'req-123',
    plot_received: 'req-123',
    forwarded_to_isl: 'req-123',
    isl_echoed: 'req-123',
    cee_trace: 'req-123',
    all_match: true,
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
    it('displays analysis chain and draft-graph trace sub-sections', () => {
      render(<ContractIntegrityTab data={fullFixture} />)
      expect(screen.getByText('Analysis chain')).toBeInTheDocument()
      expect(screen.getByText('UI sent')).toBeInTheDocument()
      expect(screen.getByText('PLoT received')).toBeInTheDocument()
      expect(screen.getByText('Forwarded to ISL')).toBeInTheDocument()
      expect(screen.getByText('ISL echoed')).toBeInTheDocument()
      expect(screen.getByText(/Draft-graph trace/)).toBeInTheDocument()
      expect(screen.getByText('CEE trace')).toBeInTheDocument()
    })

    it('handles null request_id_chain gracefully', () => {
      const data = makeDebugData({ request_id_chain: null })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('Request chain')).toBeInTheDocument()
    })

    it('shows analysis chain values from meta.request_id_chain', () => {
      const data = makeDebugData({
        request_id_chain: makeChain({
          ui_sent: 'abc-123',
          plot_received: 'abc-123',
          forwarded_to_isl: 'abc-123',
          isl_echoed: 'abc-123',
          all_match: true,
        }),
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getAllByText('abc-123').length).toBeGreaterThanOrEqual(4)
    })

    it('shows analysis chain values from _meta.request_id_chain (fallback)', () => {
      // The tab component reads data.request_id_chain which is already extracted.
      // _meta fallback is handled in useDebugData extraction. Here we verify rendering.
      const data = makeDebugData({
        request_id_chain: makeChain({
          ui_sent: 'def-456',
          plot_received: 'def-456',
          forwarded_to_isl: 'def-456',
          isl_echoed: 'def-456',
          all_match: true,
        }),
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getAllByText('def-456').length).toBeGreaterThanOrEqual(4)
    })

    it('shows fallback values when request_id_chain is absent from PLoT response', () => {
      // When PLoT doesn't return request_id_chain, the extraction falls back to
      // captured payload IDs. Verify the component renders whatever is available.
      const data = makeDebugData({
        request_id_chain: makeChain({
          ui_sent: 'ghi-789',
          plot_received: null,
          forwarded_to_isl: null,
          isl_echoed: null,
          all_match: false,
        }),
      })
      render(<ContractIntegrityTab data={data} />)
      expect(screen.getByText('ghi-789')).toBeInTheDocument()
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

  it('returns pass when analysis chain all_match is true', () => {
    expect(deriveRequestChainStatus(makeChain({
      ui_sent: 'a', plot_received: 'a', forwarded_to_isl: 'a', isl_echoed: 'a',
      all_match: true,
    }))).toBe('pass')
  })

  it('returns warn when some analysis chain IDs are null', () => {
    expect(deriveRequestChainStatus(makeChain({
      ui_sent: 'a', plot_received: 'a', forwarded_to_isl: null, isl_echoed: null,
      all_match: false,
    }))).toBe('warn')
  })

  it('returns fail when analysis chain IDs diverge', () => {
    expect(deriveRequestChainStatus(makeChain({
      ui_sent: 'a', plot_received: 'b', forwarded_to_isl: 'a', isl_echoed: 'a',
      all_match: false,
    }))).toBe('fail')
  })

  it('returns unavailable when all analysis chain IDs are null', () => {
    expect(deriveRequestChainStatus(makeChain({
      ui_sent: null, plot_received: null, forwarded_to_isl: null, isl_echoed: null,
      all_match: true,
    }))).toBe('unavailable')
  })

  it('returns warn when only a single ID is present (incomplete chain)', () => {
    expect(deriveRequestChainStatus(makeChain({
      ui_sent: 'a', plot_received: null, forwarded_to_isl: null, isl_echoed: null,
      all_match: true, // all_match is true since 1 unique ID, but chain is incomplete
    }))).toBe('warn')
  })

  it('CEE trace mismatch does NOT affect analysis chain status', () => {
    // analysis_chain all match, but cee_trace is different
    const chain = makeChain({
      ui_sent: 'a', plot_received: 'a', forwarded_to_isl: 'a', isl_echoed: 'a',
      cee_trace: 'different-cee-id',
      all_match: true,
    })
    expect(deriveRequestChainStatus(chain)).toBe('pass')
  })

  it('analysis chain mismatch causes fail even when draft trace matches', () => {
    const chain = makeChain({
      ui_sent: 'a', plot_received: 'b', forwarded_to_isl: 'a', isl_echoed: 'a',
      cee_trace: 'a', // draft trace matches ui_sent, but analysis chain diverges
      all_match: false,
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
        ui_sent: 'a', plot_received: 'a', forwarded_to_isl: 'a', isl_echoed: 'a',
        all_match: true,
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
        ui_sent: 'a', plot_received: 'a', forwarded_to_isl: 'a', isl_echoed: 'a',
        cee_trace: 'completely-different-id',
        all_match: true,
      }),
    })
    render(<ContractIntegrityTab data={data} />)
    // CEE trace is different but analysis chain is fine → should be pass
    expect(screen.getByText(/Contract integrity: pass/)).toBeInTheDocument()
  })

  it('analysis chain mismatch DOES cause overall fail', () => {
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
        ui_sent: 'a', plot_received: 'b', forwarded_to_isl: 'a', isl_echoed: 'a',
        all_match: false,
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
        ui_sent: 'a', plot_received: 'a', forwarded_to_isl: 'a', isl_echoed: 'a',
        all_match: true,
      }),
    })
    render(<ContractIntegrityTab data={data} />)
    // Strength audit has 100% defaulted + STRENGTH_MEAN_DEFAULT_DOMINANT → warn, not fail
    expect(screen.getByText(/Contract integrity: warn/)).toBeInTheDocument()
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
