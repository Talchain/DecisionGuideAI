/**
 * Debug Bundle v2.0 UI Tests
 *
 * Tests for LLM Calls tab rendering with diagnostic trace data,
 * and fallback trace warning in Summary tab.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DebugData, RequestIdChain } from '../hooks/useDebugData'
import { LLMCallsTab } from '../tabs/LLMCallsTab'
import { SummaryTab } from '../tabs/SummaryTab'

// Mock components used by SummaryTab
vi.mock('../components', () => ({
  KpiCard: ({ label, value }: { label: string; value: string }) => (
    <div data-testid={`kpi-${label}`}>{value}</div>
  ),
  ServiceChain: () => <div data-testid="service-chain" />,
}))

vi.mock('../utils', () => ({
  formatDuration: (ms: number | null) => ms != null ? `${ms}ms` : '—',
}))

vi.mock('../constants/errorCodes', () => ({
  getErrorInfo: () => null,
}))

// Ensure v2 flag is ON for all UI tests
beforeEach(() => {
  import.meta.env.VITE_DEBUG_BUNDLE_V2 = 'true'
})

// =============================================================================
// Helpers
// =============================================================================

function makeDebugData(overrides: Partial<DebugData> = {}): DebugData {
  return {
    overall: { status: 'success', total_duration_ms: 1200, request_id: 'req-1' },
    services: {
      cee: { name: 'CEE', status: 200, success: true, duration_ms: 245, endpoint: '/cee/draft-graph' },
      plot: null,
      isl: null,
    },
    error: null,
    builds: { ui: 'test', cee: null, plot: null, isl: null },
    diagnostics: {
      plot_has_downstream_calls: false,
      downstream_calls_path_found: null,
      downstream_calls_paths_checked: [],
      isl_data_source: 'none',
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
      total_duration_ms: 1200,
      stages: [],
      llm_metadata: null,
      llm_raw: null,
      node_extraction: null,
      connectivity: { decision_count: 0, option_count: 0, goal_count: 0, factor_count: 0, edge_count: 0 },
    },
    payloads: {
      cee_request: null,
      cee_response: null,
      plot_request: null,
      plot_response: null,
      isl_request: null,
      isl_response: null,
    },
    gates: [],
    validation: { summary: { errors: 0, warnings: 0, info: 0 }, issues: [] },
    winningOption: null,
    robustness: { status: 'unavailable', stability: null, context_label: '', description: '' },
    hasData: true,
    orchestrator: null,
    v12_4_checks: null,
    request_id_chain: { ui_generated: null, from_plot: null, plot_chain_present: false, draft_trace: { cee_trace: null } } as RequestIdChain,
    feature_flags_at_request: null,
    timing: null,
    schema_versions: null,
    cee_observability: null,
    m1_coaching: null,
    m2_review: null,
    cee_downstream: null,
    cee_operations: null,
    diagnostic_trace: null,
    ...overrides,
  }
}

// =============================================================================
// LLM Calls Tab Tests
// =============================================================================

describe('LLMCallsTab with diagnostic trace', () => {
  it('renders LLM calls from diagnostic trace', () => {
    const data = makeDebugData({
      diagnostic_trace: {
        llm_calls: [
          {
            role: 'orchestrator',
            model: 'claude-sonnet-4-20250514',
            provider: 'anthropic',
            tokens: { input: 12500, output: 3200, total: 15700 },
            latency_ms: 4200,
            success: true,
            started_at: '2026-03-23T12:00:00Z',
            stop_reason: 'end_turn',
            thinking_enabled: true,
          },
        ],
      },
    })

    render(<LLMCallsTab data={data} />)

    expect(screen.getByText('orchestrator')).toBeTruthy()
    expect(screen.getByText('claude-sonnet-4-20250514')).toBeTruthy()
    expect(screen.getByText('anthropic')).toBeTruthy()
  })

  it('renders error case from diagnostic trace', () => {
    const data = makeDebugData({
      diagnostic_trace: {
        llm_calls: [
          {
            role: 'draft_graph',
            model: 'claude-sonnet-4-20250514',
            provider: 'anthropic',
            tokens: { input: 5000, output: 0, total: 5000 },
            latency_ms: 1200,
            success: false,
            error: 'Structured outputs validation failed',
            started_at: '2026-03-23T12:00:00Z',
          },
        ],
      },
    })

    render(<LLMCallsTab data={data} />)

    expect(screen.getByText('draft_graph')).toBeTruthy()
    // Error badge should render
    const errorBadges = screen.getAllByText(/error/)
    expect(errorBadges.length).toBeGreaterThan(0)
  })

  it('renders error details when error is an object (not string)', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const data = makeDebugData({
      diagnostic_trace: {
        llm_calls: [
          {
            role: 'orchestrator',
            model: 'claude-sonnet-4-20250514',
            provider: 'anthropic',
            tokens: { input: 5000, output: 0, total: 5000 },
            latency_ms: 1200,
            success: false,
            // Error is an object, not a string — message should be extracted
            error: { status: 400, type: 'invalid_request_error', message: 'Structured outputs validation failed' },
            started_at: '2026-03-23T12:00:00Z',
          },
        ],
      },
    })

    render(<LLMCallsTab data={data} />)

    // Error badge should render in table
    const errorBadges = screen.getAllByText(/error/)
    expect(errorBadges.length).toBeGreaterThan(0)

    // Click the row to expand and see error details
    const row = screen.getByText('orchestrator').closest('tr')!
    fireEvent.click(row)

    // The message should be extracted from the object error and shown
    expect(screen.getByText('Structured outputs validation failed')).toBeTruthy()
    // Object error details should be rendered
    expect(screen.getByText(/Status: 400/)).toBeTruthy()
    expect(screen.getByText(/Type: invalid_request_error/)).toBeTruthy()
  })

  it('renders with no diagnostic trace (empty state)', () => {
    const data = makeDebugData()

    render(<LLMCallsTab data={data} />)

    expect(screen.getByText(/Diagnostic trace not available/)).toBeTruthy()
  })

  it('prefers diagnostic trace over cee_observability when both present', () => {
    const data = makeDebugData({
      diagnostic_trace: {
        llm_calls: [
          {
            role: 'from_trace',
            model: 'trace-model',
            provider: 'trace-provider',
            tokens: { input: 100, output: 50, total: 150 },
            latency_ms: 500,
            success: true,
          },
        ],
      },
      cee_observability: {
        llm_calls: [{
          id: 'obs-1',
          step: 'draft_graph',
          model: 'obs-model',
          provider: 'anthropic',
          tokens: { input: 200, output: 100, total: 300 },
          latency_ms: 1000,
          attempt: 1,
          success: true,
          started_at: '2026-03-23T12:00:00Z',
          completed_at: '2026-03-23T12:00:01Z',
        }],
        validation: null,
        orchestrator: null,
        totals: null,
        graph_metrics: null,
        graph_diffs: [],
        request_id: null,
        raw_io_included: false,
        repair_summary: null,
      },
    })

    render(<LLMCallsTab data={data} />)

    // Should show trace data, not observability data
    expect(screen.getByText('trace-model')).toBeTruthy()
    expect(screen.queryByText('obs-model')).toBeNull()
  })
})

// =============================================================================
// Fallback Trace Tests
// =============================================================================

describe('SummaryTab fallback trace warning', () => {
  it('renders fallback trace warning when present', () => {
    const data = makeDebugData({
      diagnostic_trace: {
        fallback_trace: [
          {
            stage: 'structured_outputs',
            reason: 'HTTP 400 from provider',
            action: 'retry_without_structured_outputs',
            succeeded: false,
          },
        ],
      },
    })

    render(<SummaryTab data={data} />)

    expect(screen.getByText('Fallback triggered')).toBeTruthy()
    expect(screen.getByText('structured_outputs')).toBeTruthy()
    expect(screen.getByText('HTTP 400 from provider')).toBeTruthy()
    expect(screen.getByText('no')).toBeTruthy()
  })

  it('does not render fallback section when trace is absent', () => {
    const data = makeDebugData()

    render(<SummaryTab data={data} />)

    expect(screen.queryByText('Fallback triggered')).toBeNull()
  })

  it('does not render fallback section when fallback_trace is empty', () => {
    const data = makeDebugData({
      diagnostic_trace: {
        fallback_trace: [],
      },
    })

    render(<SummaryTab data={data} />)

    expect(screen.queryByText('Fallback triggered')).toBeNull()
  })
})
